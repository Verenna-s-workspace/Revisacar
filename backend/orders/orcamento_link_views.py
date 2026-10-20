"""
Link público do orçamento — Fase 6 (parte A).

A oficina gera um link pro orçamento ENVIADO e manda pro cliente (WhatsApp, e-mail…).
O cliente abre no celular, SEM conta, vê o orçamento e aprova ou recusa. A decisão roda
nas mesmas funções SQL da aprovação da oficina (Financeiro, reserva de Estoque, status
da OS) — ver backend/sql/orcamento_link.sql.

Rotas da OFICINA (login):
  GET    /orcamentos/<id>/link    (ordens.ver)     {link: {...} | null} — o link atual e se o cliente abriu/respondeu
  POST   /orcamentos/<id>/link    (ordens.editar)  {renovar?: bool} gera o link (ou devolve o ativo);
                                                   `renovar` revoga o atual e cria outro. 201 novo, 200 já existia.
  DELETE /orcamentos/<id>/link    (ordens.editar)  revoga (o link deixa de funcionar). 204.

Rotas PÚBLICAS (sem login; o token é a credencial):
  GET  /publico/orcamentos/<token>          o orçamento como o cliente vê (SEM custo, margem,
                                            vínculos internos, telefone ou documento do cliente)
  GET  /publico/orcamentos/<token>/pdf      o PDF (o mesmo que a oficina manda)
  POST /publico/orcamentos/<token>/aprovar  {nome, aceito: true, observacao?}
  POST /publico/orcamentos/<token>/recusar  {motivo?}

Segurança
  • O token = id do link + HMAC (chave secreta do servidor). NÃO fica no banco: vazar o
    banco não dá nenhum link. Token inválido é descartado ANTES de tocar no banco e responde
    sempre o mesmo 404 (não revela se o link existe).
  • Só decide orçamento "enviado", dentro da validade, com link ativo; link revogado ou
    expirado → 410. Decidir de novo → 409 (o cliente vê o estado final).
  • Limite de tentativas por IP e por link (em memória, por processo — melhor esforço).
  • Respostas com `Cache-Control: no-store`, `X-Robots-Tag: noindex` e `Referrer-Policy: no-referrer`.
  • A mensagem de erro pública nunca traz detalhe interno (status da OS, scripts SQL…).
"""
import base64
import hashlib
import hmac
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.http import HttpResponse
from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import ordem_status as os_status
from . import visao_geral_views as vg
from .estoque_views import _corpo_valido, _jsonb, _negado, _nao_encontrado
from .orcamento_views import (
    _buscar_orcamento, _conteudo_pdf, _itens_de, _payload_da_ordem, _tentar_pdf, item_para_api,
    _num,
)
from .serializers import AprovacaoPublicaSerializer, LinkOrcamentoSerializer, OrcamentoRecusaSerializer
from .views import supabase, require_auth, _now, _oficina_doc_do_token

logger = logging.getLogger(__name__)

LINKS = "orcamento_links"
LINK_DIAS = 30
FUSO_PADRAO = "America/Sao_Paulo"

# Objeto do banco que não existe = orcamento_link.sql (ou orcamentos.sql) não foi rodado.
OBJETO_INEXISTENTE = {"42P01", "42883", "PGRST205", "PGRST202", "42703", "PGRST204"}


# ── Token ─────────────────────────────────────────────────────────────────────

def _b64(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _mac(link_id: uuid.UUID) -> bytes:
    chave = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(chave, b"orcamento-link:" + link_id.bytes, hashlib.sha256).digest()[:24]


def token_do_link(link_id) -> str:
    """Token que vai na URL: id do link + HMAC. Determinístico: a oficina revê o mesmo link."""
    lid = uuid.UUID(str(link_id))
    return f"{_b64(lid.bytes)}.{_b64(_mac(lid))}"


def id_do_token(token: str):
    """UUID do link se o token é autêntico; None se não for (formato errado, HMAC errado)."""
    try:
        if not isinstance(token, str) or len(token) > 80:
            return None
        parte_id, _, parte_mac = token.partition(".")
        if not parte_id or not parte_mac:
            return None
        pad = lambda s: s + "=" * (-len(s) % 4)  # noqa: E731
        lid = uuid.UUID(bytes=base64.urlsafe_b64decode(pad(parte_id)))
        recebido = base64.urlsafe_b64decode(pad(parte_mac))
    except Exception:  # noqa: BLE001 — qualquer lixo = inválido
        return None
    return lid if hmac.compare_digest(recebido, _mac(lid)) else None


# ── Limite de tentativas (em memória, por processo) ──────────────────────────

_lock = threading.Lock()
_marcas: dict = {}
_relogio = time.time          # os testes trocam isto


def _liberado(chave: str, limite: int, janela_s: int) -> bool:
    """Conta uma tentativa em `chave`; False se passou de `limite` na janela."""
    agora = _relogio()
    with _lock:
        recentes = [t for t in _marcas.get(chave, ()) if t > agora - janela_s]
        if len(recentes) >= limite:
            _marcas[chave] = recentes
            return False
        recentes.append(agora)
        _marcas[chave] = recentes
        if len(_marcas) > 20_000:          # não deixa a memória crescer sem fim
            for k in [k for k, v in _marcas.items() if not v or v[-1] < agora - 3600]:
                _marcas.pop(k, None)
    return True


def _ip(request) -> str:
    """IP de quem chamou. Atrás do proxy da hospedagem o último item de X-Forwarded-For é o que
    o PRÓPRIO proxy anotou (os anteriores o cliente pode forjar)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = xff.split(",")[-1].strip() if xff else request.META.get("REMOTE_ADDR", "")
    return (ip or "desconhecido")[:45]


def _muitas_tentativas():
    r = Response({"detail": "Muitas tentativas. Aguarde um pouco e tente de novo.", "codigo": "muitas_tentativas"},
                 status=http_status.HTTP_429_TOO_MANY_REQUESTS)
    r["Retry-After"] = "60"
    return r


# ── Respostas ────────────────────────────────────────────────────────────────

def _publica(resposta):
    """Cabeçalhos das respostas públicas: sem cache, sem indexação, sem referrer."""
    resposta["Cache-Control"] = "no-store"
    resposta["X-Robots-Tag"] = "noindex, nofollow"
    resposta["Referrer-Policy"] = "no-referrer"
    return resposta


def _erro_publico(status, detail, codigo):
    return _publica(Response({"detail": detail, "codigo": codigo}, status=status))


def _nao_achado_publico():
    return _erro_publico(http_status.HTTP_404_NOT_FOUND, "Link não encontrado.", "link_invalido")


def _erros_link(view_func):
    """Erros do banco → resposta. Pra oficina: manda rodar o script. Pro cliente: genérico."""
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            publico = request.path.startswith("/publico/")
            if codigo in OBJETO_INEXISTENTE:
                logger.error("Link do orçamento: objeto do banco ausente (%s): %s", codigo, getattr(e, "message", e))
                if publico:
                    return _erro_publico(http_status.HTTP_503_SERVICE_UNAVAILABLE,
                                         "Este serviço está indisponível no momento. Tente mais tarde.", "indisponivel")
                return Response({"detail": "O link do orçamento ainda não existe no banco. "
                                           "Rode backend/sql/orcamento_link.sql no SQL Editor do Supabase."},
                                status=http_status.HTTP_503_SERVICE_UNAVAILABLE)
            if codigo == "22P02":
                return _nao_achado_publico() if publico else _nao_encontrado("Orçamento não encontrado.")
            logger.exception("Link do orçamento: erro do banco (%s)", codigo)
            if publico:
                return _erro_publico(http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                                     "Não foi possível concluir agora. Tente de novo.", "erro")
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


# ── Acesso ao banco ──────────────────────────────────────────────────────────

def _dt(valor):
    if not valor:
        return None
    try:
        d = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _agora_utc() -> datetime:
    return vg._agora(timezone.utc)


def _hoje_padrao():
    return vg._agora(ZoneInfo(FUSO_PADRAO)).date()


def _link_por_id(link_id):
    res = supabase.table(LINKS).select("*").eq("id", str(link_id)).limit(1).execute()
    return res.data[0] if res.data else None


def _links_do_orcamento(oficina_doc, orcamento_id) -> list:
    """Links do orçamento, o mais novo primeiro."""
    linhas = (
        supabase.table(LINKS).select("*").eq("oficina_doc", oficina_doc)
        .eq("orcamento_id", orcamento_id).order("created_at", desc=True).execute().data or []
    )
    return linhas


def _link_atual(linhas):
    """O link ativo (não revogado), se houver."""
    return next((l for l in linhas if not l.get("revogado_em")), None)


def link_para_api(link: dict, agora=None) -> dict:
    agora = agora or _agora_utc()
    expira = _dt(link.get("expira_em"))
    out = {
        "id": str(link["id"]),
        "token": token_do_link(link["id"]),
        "criadoEm": link["created_at"],
        "expiraEm": link["expira_em"],
        "ativo": not link.get("revogado_em") and (expira is None or expira > agora),
        "acessos": link.get("acessos") or 0,
    }
    for campo, chave in (
        ("primeiro_acesso_em", "primeiroAcessoEm"), ("ultimo_acesso_em", "ultimoAcessoEm"),
        ("decidido_em", "decididoEm"), ("decisao", "decisao"), ("decisao_nome", "decisaoNome"),
    ):
        if link.get(campo):
            out[chave] = link[campo]
    return out


# ── Rotas da oficina ─────────────────────────────────────────────────────────

@api_view(["GET", "POST", "DELETE"])
@require_auth
@_erros_link
def orcamento_link(request, orcamento_id):
    negado = _negado(request, "ordens.ver" if request.method == "GET" else "ordens.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    row = _buscar_orcamento(orcamento_id, oficina_doc)
    if row is None:
        return _nao_encontrado("Orçamento não encontrado.")

    if request.method == "GET":
        link = _link_atual(_links_do_orcamento(oficina_doc, str(row["id"])))
        return Response({"link": link_para_api(link) if link else None})

    if request.method == "DELETE":
        link = _link_atual(_links_do_orcamento(oficina_doc, str(row["id"])))
        if link:
            supabase.table(LINKS).update({"revogado_em": _now()}).eq("id", str(link["id"])).execute()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    dados = request.data if _corpo_valido(request) else {}
    serializer = LinkOrcamentoSerializer(data=dados)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    resultado = _jsonb(supabase.rpc("orcamento_link_criar", {
        "p_oficina_doc": oficina_doc,
        "p_orcamento_id": str(row["id"]),
        "p_nome": request.admin.get("nome", ""),
        "p_dias": LINK_DIAS,
        "p_renovar": serializer.validated_data["renovar"],
    }).execute().data)
    if not resultado["ok"]:
        codigo = resultado.get("codigo")
        corpo = {"detail": resultado.get("mensagem") or "Não foi possível gerar o link.", "codigo": codigo}
        if codigo == "status_invalido":
            corpo["status"] = resultado.get("status")
        return Response(corpo, status=http_status.HTTP_404_NOT_FOUND if codigo == "nao_encontrado"
                        else http_status.HTTP_409_CONFLICT)
    return Response({"link": link_para_api(resultado["link"])},
                    status=http_status.HTTP_201_CREATED if resultado["criado"] else http_status.HTTP_200_OK)


# ── Rotas públicas ───────────────────────────────────────────────────────────

def _entrada_publica(request, token, *, decisao=False):
    """Limites + token → (link, None) ou (None, resposta de erro). Não toca no banco com token falso."""
    ip = _ip(request)
    if not _liberado(f"pub:{ip}", 120, 60):
        return None, _publica(_muitas_tentativas())
    link_id = id_do_token(token)
    if link_id is None:
        if not _liberado(f"invalido:{ip}", 20, 600):
            return None, _publica(_muitas_tentativas())
        return None, _nao_achado_publico()
    if decisao and not (_liberado(f"decisao:{ip}", 10, 600) and _liberado(f"decisao:{link_id}", 20, 600)):
        return None, _publica(_muitas_tentativas())
    link = _link_por_id(link_id)
    if link is None:
        return None, _nao_achado_publico()
    if link.get("revogado_em"):
        return None, _erro_publico(http_status.HTTP_410_GONE,
                                   "Este link foi substituído. Peça um novo à oficina.", "link_revogado")
    expira = _dt(link.get("expira_em"))
    if expira is not None and expira <= _agora_utc():
        return None, _erro_publico(http_status.HTTP_410_GONE,
                                   "Este link expirou. Peça um novo à oficina.", "link_expirado")
    return link, None


def _contexto(link):
    """(orçamento, itens, ordem, nome da oficina) do link, ou None se sumiram."""
    oficina_doc = link["oficina_doc"]
    row = _buscar_orcamento(str(link["orcamento_id"]), oficina_doc)
    if row is None:
        return None
    itens = _itens_de([str(row["id"])]).get(str(row["id"]), [])
    ordem = (
        supabase.table("ordens").select("id,os_num,status,payload")
        .eq("id", row["ordem_id"]).eq("oficina_doc", oficina_doc).limit(1).execute().data or [{}]
    )[0]
    adm = supabase.table("admins").select("nome").eq("doc", oficina_doc).limit(1).execute().data
    return row, itens, ordem, (adm[0]["nome"] if adm else "") or "Oficina"


def _corpo_publico(link, row, itens, ordem, oficina_nome, hoje) -> dict:
    """SÓ o que o cliente pode ver (o mesmo do PDF). Nada de custo, margem, ids internos, telefone ou documento."""
    payload = _payload_da_ordem(ordem)
    cliente, veiculo = payload.get("cliente") or {}, payload.get("veiculo") or {}
    vencido = row["status"] == "enviado" and bool(row.get("validade_ate")) and row["validade_ate"] < hoje.isoformat()
    bloqueio = None
    if row["status"] != "enviado":
        bloqueio = row["status"]                      # aprovado | recusado | substituido
    elif vencido:
        bloqueio = "vencido"
    orc = {
        "versao": row["versao"], "status": row["status"], "total": _num(row["total"]),
        "validadeAte": row.get("validade_ate"), "vencido": vencido, "observacoes": row.get("observacoes") or "",
        "itens": [
            {k: v for k, v in item_para_api(i, False).items() if k in
             ("tipo", "descricao", "marca", "quantidade", "precoUnitario", "subtotal", "motivo")}
            for i in itens
        ],
    }
    for campo, chave in (("enviado_em", "enviadoEm"), ("aprovado_em", "aprovadoEm"), ("recusado_em", "recusadoEm")):
        if row.get(campo):
            orc[chave] = row[campo]
    if row.get("aprovado_por_nome") and row.get("aprovacao_canal") == "link":
        orc["aprovadoPorNome"] = row["aprovado_por_nome"]
    return {
        "oficina": {"nome": oficina_nome},
        "ordem": {
            "osNum": ordem.get("os_num") or "",
            "clienteNome": cliente.get("nome") or "",
            "veiculo": {k: veiculo.get(k) or "" for k in ("placa", "modelo", "ano", "cor")},
        },
        "orcamento": orc,
        "pdfDisponivel": bool(itens),
        "podeDecidir": bloqueio is None,
        "bloqueio": bloqueio,
    }


@api_view(["GET"])
@_erros_link
def publico_orcamento(request, token):
    link, erro = _entrada_publica(request, token)
    if erro:
        return erro
    ctx = _contexto(link)
    if ctx is None:
        return _nao_achado_publico()
    try:                                    # contar o acesso nunca derruba a página
        supabase.rpc("orcamento_link_acessou", {"p_link_id": str(link["id"])}).execute()
    except Exception as e:  # noqa: BLE001
        logger.warning("Link %s: não consegui contar o acesso: %s", link["id"], e)
    return _publica(Response(_corpo_publico(link, *ctx, _hoje_padrao())))


@api_view(["GET"])
@_erros_link
def publico_orcamento_pdf(request, token):
    link, erro = _entrada_publica(request, token)
    if erro:
        return erro
    ctx = _contexto(link)
    if ctx is None:
        return _nao_achado_publico()
    row, itens, _, _ = ctx
    if not itens:
        return _erro_publico(http_status.HTTP_404_NOT_FOUND, "Orçamento sem itens.", "sem_itens")
    conteudo = _conteudo_pdf(link["oficina_doc"], row, itens)
    resposta = HttpResponse(conteudo, content_type="application/pdf")
    resposta["Content-Disposition"] = f'inline; filename="orcamento-v{row["versao"]}.pdf"'
    return _publica(resposta)


MENSAGEM_PUBLICA = {
    "status_invalido": "Este orçamento já foi respondido.",
    "vencido": "Este orçamento venceu. Peça um novo à oficina.",
    "os_status": "Este orçamento não pode ser respondido agora. Fale com a oficina.",
    "link_revogado": "Este link foi substituído. Peça um novo à oficina.",
    "link_expirado": "Este link expirou. Peça um novo à oficina.",
}


def _decidir(request, token, decisao, dados_extra):
    link, erro = _entrada_publica(request, token, decisao=True)
    if erro:
        return erro
    novo = os_status.APROVADA if decisao == "aprovar" else os_status.RECUSADA
    resultado = _jsonb(supabase.rpc("orcamento_link_decidir", {
        "p_link_id": str(link["id"]),
        "p_decisao": decisao,
        "p_os_permitidos": os_status.origens_para(novo),
        "p_os_novo": novo,
        "p_hoje": _hoje_padrao().isoformat(),
        "p_nome": dados_extra.get("nome", ""),
        "p_obs": dados_extra.get("obs", ""),
        "p_ip": _ip(request),
        "p_agora": _now(),
    }).execute().data)
    if not resultado["ok"]:
        codigo = resultado.get("codigo")
        if codigo in ("link_invalido", "nao_encontrado"):
            return _nao_achado_publico()
        status = (http_status.HTTP_410_GONE if codigo in ("link_revogado", "link_expirado")
                  else http_status.HTTP_422_UNPROCESSABLE_ENTITY if codigo == "decisao_invalida"
                  else http_status.HTTP_409_CONFLICT)
        corpo = {"detail": MENSAGEM_PUBLICA.get(codigo, "Não foi possível registrar sua resposta."), "codigo": codigo}
        if codigo == "status_invalido":
            corpo["status"] = resultado.get("status")
        return _publica(Response(corpo, status=status))
    if decisao == "aprovar":
        _tentar_pdf(resultado["oficina_doc"], str(resultado["orcamento_id"]))    # melhor esforço, como na oficina
    ctx = _contexto(link)
    if ctx is None:
        return _nao_achado_publico()
    return _publica(Response(_corpo_publico(link, *ctx, _hoje_padrao())))


@api_view(["POST"])
@_erros_link
def publico_orcamento_aprovar(request, token):
    dados = request.data if _corpo_valido(request) else {}
    serializer = AprovacaoPublicaSerializer(data=dados)
    if not serializer.is_valid():
        # Valida o corpo ANTES de gastar tentativa do link; mas o limite por IP vale igual.
        if not _liberado(f"pub:{_ip(request)}", 120, 60):
            return _publica(_muitas_tentativas())
        return _publica(Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY))
    d = serializer.validated_data
    return _decidir(request, token, "aprovar", {"nome": d["nome"].strip(), "obs": (d.get("observacao") or "").strip()})


@api_view(["POST"])
@_erros_link
def publico_orcamento_recusar(request, token):
    dados = request.data if _corpo_valido(request) else {}
    serializer = OrcamentoRecusaSerializer(data=dados)
    if not serializer.is_valid():
        if not _liberado(f"pub:{_ip(request)}", 120, 60):
            return _publica(_muitas_tentativas())
        return _publica(Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY))
    return _decidir(request, token, "recusar", {"obs": (serializer.validated_data.get("motivo") or "").strip()})
