"""
Fotos obrigatórias da entrada do veículo (registro de confiabilidade).

São 5 itens fixos por OS (`SLOTS`): hodômetro (painel aceso, com os avisos), frente,
traseira, lateral direita e lateral esquerda. Cada item fica RESOLVIDO quando tem foto
ou foi pulado com um motivo curto. Fotos adicionais livres seguem em `ordens.fotos_paths`.

Rotas (JSON camelCase):
  GET  /ordens/<id>/fotos-obrigatorias                  (ordens.ver)
       Estado dos 5 itens + `total`, `resolvidas`, `completo` e `faltam` (ids dos pendentes).
  PUT  /ordens/<id>/fotos-obrigatorias/<slot>           (ordens.editar OU ordens.criar)
       multipart, campo `file` (uma foto por vez). Tirar de novo SUBSTITUI a anterior (a foto
       velha sai do Storage e `refeitas` soma 1); também troca um item "pulado" por foto.
  POST /ordens/<id>/fotos-obrigatorias/<slot>/pular     (ordens.editar OU ordens.criar)
       {"motivo": "carro trancado"}  — motivo obrigatório, 3 a 120 caracteres. Pular conta como
       resolvido. Se havia foto, ela é removida (o item passa a "pulado").

Todas respondem com o item alterado (`item`) e o resumo atualizado, para a tela mostrar o
"3 de 5" sem outra chamada.

Quem tirou/pulou e quando vêm do TOKEN e do relógio do servidor, nunca do corpo da requisição.

Só dá para mexer nos itens enquanto a OS está em rascunho ou em orçamento (antes do orçamento
ser enviado): depois disso o registro é um documento e fica como está (409 `os_status`).

Regra de avanço (`fotos_pendentes`, usada por PUT /ordens/<id>): uma OS em RASCUNHO só passa para
`em_orcamento` com os 5 itens resolvidos. Se faltar algum, o salvamento NÃO falha: os dados são
gravados e a OS continua em rascunho (a resposta traz `fotos_obrigatorias_pendentes`).
Limitação conhecida: criar a OS direto como `em_orcamento` (POST /ordens) não passa por essa
regra, porque a OS ainda não existe pra ter fotos; a tela sempre cria como rascunho antes.

Script ausente (`ordens_fotos.sql` não rodado): as rotas respondem 503 com a instrução e a
regra de avanço simplesmente não vale (o resto do sistema segue funcionando).
"""
import logging
import re
import time
import uuid

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from . import ordem_status as os_status
from .views import (
    BUCKET, MAX_FOTO_SIZE_BYTES, _get_ordem_or_404, _now, _oficina_doc_do_token,
    _ordens_precisam_do_sql, _require_auth, supabase,
)

logger = logging.getLogger(__name__)

# O storage às vezes falha por um instante (visto no teste em escala: 1 em ~40 fotos).
# O caminho tem uuid, então repetir o envio não sobrescreve nada.
TENTATIVAS_STORAGE = 2
ESPERA_ENTRE_TENTATIVAS_S = 0.5

# (id, rótulo, dica). A tela tem a mesma lista (com ícones) em
# frontend/src/utils/fotos_obrigatorias.ts — manter as duas iguais.
SLOTS = (
    ("hodometro", "Hodômetro", "Painel aceso, mostrando também os avisos"),
    ("frente", "Frente", ""),
    ("traseira", "Traseira", ""),
    ("lateral_direita", "Lateral direita", ""),
    ("lateral_esquerda", "Lateral esquerda", ""),
)
SLOT_IDS = tuple(s[0] for s in SLOTS)

MOTIVO_MIN = 3
MOTIVO_MAX = 120

# Tabela ausente = ordens_fotos.sql não foi rodado (42P01 = Postgres, PGRST205 = PostgREST).
TABELA_AUSENTE = {"42P01", "PGRST205"}

_BRANDS_HEIF = {b"heic", b"heix", b"heim", b"heis", b"hevc", b"hevx", b"mif1", b"msf1"}


def extensao_da_imagem(conteudo: bytes):
    """Extensão pelo conteúdo (magic bytes), ou None se não for uma imagem aceita."""
    if conteudo[:3] == b"\xff\xd8\xff":
        return "jpg"
    if conteudo[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "webp"
    if conteudo[4:8] == b"ftyp" and conteudo[8:12] in _BRANDS_HEIF:
        return "heic"
    return None


def _precisa_do_script(view_func):
    """Tabela das fotos obrigatórias ausente → 503 com a instrução em vez de um 500 genérico."""
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            if getattr(e, "code", None) in TABELA_AUSENTE:
                logger.error("Fotos obrigatórias: tabela ausente: %s", getattr(e, "message", e))
                return Response(
                    {"detail": "As fotos obrigatórias ainda não existem no banco. "
                               "Rode backend/sql/ordens_fotos.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            raise
    wrapper.__name__ = view_func.__name__
    return wrapper


# ── Leitura / resumo ──────────────────────────────────────────────────────────

def _linhas(cliente, oficina_doc, ordem_id):
    res = (
        cliente.table("ordem_fotos").select("*")
        .eq("oficina_doc", oficina_doc).eq("ordem_id", ordem_id).execute()
    )
    return {l["slot"]: l for l in (res.data or [])}


def _item(slot_id, rotulo, dica, linha):
    out = {"slot": slot_id, "rotulo": rotulo, "situacao": "pendente"}
    if dica:
        out["dica"] = dica
    if not linha:
        return out
    out["situacao"] = linha["situacao"]
    if linha.get("path"):
        out["path"] = linha["path"]
    if linha.get("motivo"):
        out["motivo"] = linha["motivo"]
    out["porNome"] = linha.get("por_nome") or ""
    out["porTipo"] = linha.get("por_tipo") or ""
    out["em"] = linha.get("em")
    if linha.get("refeitas"):
        out["refeitas"] = linha["refeitas"]
    return out


def resumo(linhas: dict) -> dict:
    itens = [_item(sid, rotulo, dica, linhas.get(sid)) for sid, rotulo, dica in SLOTS]
    faltam = [i["slot"] for i in itens if i["situacao"] == "pendente"]
    return {
        "itens": itens,
        "total": len(itens),
        "resolvidas": len(itens) - len(faltam),
        "completo": not faltam,
        "faltam": faltam,
    }


def fotos_pendentes(cliente, oficina_doc, ordem_id) -> list:
    """Ids dos itens obrigatórios ainda sem foto nem motivo. Sem o script rodado, devolve []
    (a regra só passa a valer depois que o banco tem a tabela)."""
    try:
        linhas = _linhas(cliente, oficina_doc, ordem_id)
    except APIError as e:
        if getattr(e, "code", None) in TABELA_AUSENTE:
            return []
        raise
    return resumo(linhas)["faltam"]


# ── Escrita ───────────────────────────────────────────────────────────────────

def _quem(payload: dict) -> dict:
    tipo = "dono" if payload.get("tipo") == "dono" else "funcionario"
    return {
        "por_nome": str(payload.get("nome") or "")[:120],
        "por_tipo": tipo,
        "por_id": (str(payload["id"]) if payload.get("id") else None),
    }


def _autorizar(request, escrita: bool):
    """Devolve (payload, None) ou (None, Response de erro)."""
    payload = _require_auth(request)
    if payload is None:
        return None, Response({"detail": "Token inválido ou expirado"}, status=http_status.HTTP_401_UNAUTHORIZED)
    permissoes = payload.get("permissoes", [])
    pode = ("ordens.editar" in permissoes or "ordens.criar" in permissoes) if escrita else ("ordens.ver" in permissoes)
    if not pode:
        return None, Response({"detail": "Você não tem permissão para isso"}, status=http_status.HTTP_403_FORBIDDEN)
    request.admin = payload
    return payload, None


def _slot_ou_404(slot):
    if slot not in SLOT_IDS:
        return Response({"detail": "Item de foto desconhecido"}, status=http_status.HTTP_404_NOT_FOUND)
    return None


def _os_editavel(ordem):
    """409 se a OS já passou da fase em que a entrada ainda pode mudar."""
    atual = ordem.get("status") or os_status.RASCUNHO
    if atual in os_status.PRE_ORCAMENTO:
        return None
    return Response(
        {"detail": "O registro de entrada não pode mais ser alterado: a OS já passou da fase de orçamento.",
         "codigo": "os_status", "osStatus": atual},
        status=http_status.HTTP_409_CONFLICT,
    )


def _remover_arquivo(caminho):
    if not caminho:
        return
    try:
        supabase.storage.from_(BUCKET).remove([caminho])
    except Exception as e:  # noqa: BLE001 — arquivo órfão não pode derrubar a resposta
        logger.error("Erro ao remover foto obrigatória antiga do storage (%s): %s", caminho, e)


def _gravar(oficina_doc, ordem_id, slot, existente, dados):
    linha = {
        "oficina_doc": oficina_doc,
        "ordem_id": ordem_id,
        "slot": slot,
        "em": _now(),
        "refeitas": (int(existente.get("refeitas") or 0) + 1) if existente else 0,
        **dados,
    }
    res = supabase.table("ordem_fotos").upsert(linha, on_conflict="ordem_id,slot").execute()
    return res.data[0]


def _resposta(oficina_doc, ordem_id, slot, linha):
    linhas = _linhas(supabase, oficina_doc, ordem_id)
    linhas[slot] = linha
    corpo = resumo(linhas)
    return {"item": next(i for i in corpo["itens"] if i["slot"] == slot), **corpo}


@api_view(["GET"])
@_ordens_precisam_do_sql
@_precisa_do_script
def fotos_obrigatorias(request, ordem_id):
    payload, erro = _autorizar(request, escrita=False)
    if erro:
        return erro
    oficina_doc = _oficina_doc_do_token(payload)
    _, erro = _get_ordem_or_404(ordem_id, oficina_doc)
    if erro:
        return erro
    return Response(resumo(_linhas(supabase, oficina_doc, ordem_id)))


@api_view(["PUT"])
@parser_classes([MultiPartParser])
@_ordens_precisam_do_sql
@_precisa_do_script
def foto_obrigatoria(request, ordem_id, slot):
    payload, erro = _autorizar(request, escrita=True)
    if erro:
        return erro
    erro = _slot_ou_404(slot)
    if erro:
        return erro
    oficina_doc = _oficina_doc_do_token(payload)
    ordem, erro = _get_ordem_or_404(ordem_id, oficina_doc)
    if erro:
        return erro
    erro = _os_editavel(ordem)
    if erro:
        return erro

    arquivo = request.FILES.get("file")
    if not arquivo:
        return Response({"detail": "Nenhum arquivo enviado (campo 'file')"}, status=http_status.HTTP_400_BAD_REQUEST)
    conteudo = arquivo.read()
    if len(conteudo) > MAX_FOTO_SIZE_BYTES:
        return Response(
            {"detail": f"Foto muito grande (máx {MAX_FOTO_SIZE_BYTES // (1024 * 1024)} MB)"},
            status=http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )
    extensao = extensao_da_imagem(conteudo)
    if extensao is None:
        return Response({"detail": "O arquivo não é uma imagem válida (JPEG, PNG, WebP ou HEIC)"},
                        status=http_status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)

    existentes = supabase.table("ordem_fotos").select("*").eq("oficina_doc", oficina_doc) \
        .eq("ordem_id", ordem_id).eq("slot", slot).execute().data
    existente = existentes[0] if existentes else None

    caminho = f"{ordem_id}/obrig-{slot}-{uuid.uuid4()}.{extensao}"
    for tentativa in range(1, TENTATIVAS_STORAGE + 1):
        try:
            supabase.storage.from_(BUCKET).upload(caminho, conteudo)
            break
        except Exception as e:  # noqa: BLE001
            logger.error("Erro ao enviar foto obrigatória ao storage (tentativa %s): %s", tentativa, e)
            if tentativa == TENTATIVAS_STORAGE:
                return Response({"detail": "Não foi possível guardar a foto. Tente de novo."},
                                status=http_status.HTTP_502_BAD_GATEWAY)
            time.sleep(ESPERA_ENTRE_TENTATIVAS_S)

    try:
        linha = _gravar(oficina_doc, ordem_id, slot, existente,
                        {"situacao": "foto", "path": caminho, "motivo": None, **_quem(payload)})
    except Exception:
        _remover_arquivo(caminho)      # não deixa arquivo órfão se o banco recusou
        raise

    if existente and existente.get("path") and existente["path"] != caminho:
        _remover_arquivo(existente["path"])
    return Response(_resposta(oficina_doc, ordem_id, slot, linha))


def _motivo_valido(corpo):
    bruto = corpo.get("motivo") if isinstance(corpo, dict) else None
    if not isinstance(bruto, str):
        return None, ["Informe o motivo."]
    motivo = re.sub(r"\s+", " ", bruto).strip()
    if len(motivo) < MOTIVO_MIN:
        return None, [f"O motivo precisa ter pelo menos {MOTIVO_MIN} caracteres."]
    if len(motivo) > MOTIVO_MAX:
        return None, [f"O motivo pode ter no máximo {MOTIVO_MAX} caracteres."]
    return motivo, None


@api_view(["POST"])
@_ordens_precisam_do_sql
@_precisa_do_script
def foto_obrigatoria_pular(request, ordem_id, slot):
    payload, erro = _autorizar(request, escrita=True)
    if erro:
        return erro
    erro = _slot_ou_404(slot)
    if erro:
        return erro
    oficina_doc = _oficina_doc_do_token(payload)
    ordem, erro = _get_ordem_or_404(ordem_id, oficina_doc)
    if erro:
        return erro
    erro = _os_editavel(ordem)
    if erro:
        return erro

    motivo, problemas = _motivo_valido(request.data)
    if problemas:
        return Response({"motivo": problemas}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    existentes = supabase.table("ordem_fotos").select("*").eq("oficina_doc", oficina_doc) \
        .eq("ordem_id", ordem_id).eq("slot", slot).execute().data
    existente = existentes[0] if existentes else None

    linha = _gravar(oficina_doc, ordem_id, slot, existente,
                    {"situacao": "pulada", "path": None, "motivo": motivo, **_quem(payload)})
    if existente and existente.get("path"):
        _remover_arquivo(existente["path"])
    return Response(_resposta(oficina_doc, ordem_id, slot, linha))
