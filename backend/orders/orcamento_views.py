"""
Orçamento da OS — versões e itens (Fase 1 do fluxo de orçamento).

Uma OS tem uma ou mais VERSÕES de orçamento. Refazer ou editar um orçamento já
enviado cria uma versão nova (rascunho); a anterior só vira 'substituido' quando
a nova é enviada. Status da versão: rascunho → enviado → aprovado | recusado |
substituido. As mudanças que também mexem no status da OS rodam em funções do
Postgres (atômicas) — ver backend/sql/orcamentos.sql.

Permissões (ver rbac.py):
  ordens.ver              → lê os orçamentos da OS
  ordens.editar           → cria versão, edita o rascunho, envia, aprova, recusa
  financeiro.ver_margem   → ver custo, custo total e margem (nunca vão pra quem
                            não tem; o preço cobrado é o único valor "público")

Rotas:
  GET   /ordens/<id>/orcamentos      versões da OS (a mais nova primeiro), com itens
  POST  /ordens/<id>/orcamentos      nova versão (rascunho; copia os itens da anterior)
  GET   /orcamentos/<id>             uma versão
  PATCH /orcamentos/<id>             edita o rascunho (itens: a lista enviada SUBSTITUI a anterior)
  POST  /orcamentos/<id>/enviar      rascunho → enviado (OS → pendente_aprovacao)
  POST  /orcamentos/<id>/aprovar     registra a aprovação do cliente (OS → aprovada)
  POST  /orcamentos/<id>/recusar     registra a recusa, com motivo (OS → recusada)

Convenções: JSON em camelCase; opcionais vazios são omitidos; 422 validação,
409 conflito de estado, 503 se orcamentos.sql não foi rodado. "Hoje" (validade)
vem do fuso do usuário (?tz=...), padrão America/Sao_Paulo.
"""
import logging
from decimal import Decimal, ROUND_HALF_UP

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import ordem_status as os_status
from . import visao_geral_views as vg
from .estoque_views import _corpo_valido, _jsonb, _listar_todos, _negado, _nao_encontrado, _uuid_valido
from .serializers import (
    OrcamentoAprovacaoSerializer, OrcamentoRecusaSerializer, OrcamentoSerializer,
)
from .views import supabase, require_auth, _oficina_doc_do_token, _now

logger = logging.getLogger(__name__)

ORCAMENTOS = "orcamentos"
ITENS = "orcamento_itens"

VALIDADE_PADRAO_DIAS = 7

# Tabela/função que o banco ainda não conhece = orcamentos.sql não foi rodado.
CODIGOS_OBJETO_INEXISTENTE = {"42P01", "42883", "PGRST205", "PGRST202"}

# Resposta HTTP para cada `codigo` de falha devolvido pelas funções SQL.
STATUS_POR_CODIGO = {
    "nao_encontrado": http_status.HTTP_404_NOT_FOUND,
    "sem_itens": http_status.HTTP_422_UNPROCESSABLE_ENTITY,
    "rascunho_existente": http_status.HTTP_409_CONFLICT,
    "status_invalido": http_status.HTTP_409_CONFLICT,
    "os_status": http_status.HTTP_409_CONFLICT,
    "vencido": http_status.HTTP_409_CONFLICT,
}


# ── Infra ─────────────────────────────────────────────────────────────────────

def _tratar_erros_banco(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            mensagem = str(getattr(e, "message", "") or "")
            if codigo in CODIGOS_OBJETO_INEXISTENTE or (
                codigo in ("42703", "PGRST204") and "oficina_doc" not in mensagem
            ):
                logger.error("Orçamentos: objeto do banco não encontrado (%s): %s", codigo, mensagem)
                return Response(
                    {"detail": "As tabelas de orçamento ainda não existem no banco. "
                               "Rode backend/sql/orcamentos.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo in ("42703", "PGRST204"):
                return Response(
                    {"detail": "A tabela de ordens ainda não tem a coluna da oficina. "
                               "Rode backend/sql/ordens_oficina.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo == "42501":
                logger.error("Orçamentos: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role.")
                return Response(
                    {"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            if codigo == "22P02":     # id/uuid malformado que escapou da validação
                return _nao_encontrado("Orçamento não encontrado.")
            logger.exception("Orçamentos: erro do banco (%s)", codigo)
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


def _hoje(request):
    """Data de hoje no fuso do usuário; (data, None) ou (None, Response 422)."""
    tz = vg._ler_tz(request)
    if tz is None:
        return None, Response(
            {"detail": f"Fuso horário desconhecido: '{request.query_params.get('tz')}'."},
            status=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return vg._agora(tz).date(), None


def _ver_margem(request) -> bool:
    return "financeiro.ver_margem" in request.admin.get("permissoes", [])


def _centavos(valor) -> Decimal:
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _num(valor):
    n = float(valor)
    return int(n) if n.is_integer() else n


# ── Mapeadores: linha do banco → JSON do frontend ─────────────────────────────

def item_para_api(row: dict, ver_margem: bool) -> dict:
    quantidade = Decimal(str(row["quantidade"]))
    preco = Decimal(str(row["preco_unitario"]))
    out = {
        "id": str(row["id"]),
        "tipo": row["tipo"],
        "descricao": row["descricao"],
        "marca": row.get("marca") or "",
        "quantidade": _num(row["quantidade"]),
        "precoUnitario": _num(row["preco_unitario"]),
        "subtotal": _num(_centavos(quantidade * preco)),
        "motivo": row.get("motivo") or "",
    }
    if row.get("estoque_item_id"):
        out["estoqueItemId"] = str(row["estoque_item_id"])
    if row.get("servico_id"):
        out["servicoId"] = str(row["servico_id"])
    if ver_margem and row.get("custo_unitario") is not None:
        out["custoUnitario"] = _num(row["custo_unitario"])
    return out


def orcamento_para_api(row: dict, itens: list, ver_margem: bool, hoje=None) -> dict:
    out = {
        "id": str(row["id"]),
        "ordemId": row["ordem_id"],
        "versao": row["versao"],
        "status": row["status"],
        "validadeDias": row["validade_dias"],
        "observacoes": row.get("observacoes") or "",
        "total": _num(row["total"]),
        "itens": [item_para_api(i, ver_margem) for i in itens],
        "criadoPorNome": row.get("criado_por_nome") or "",
        "createdAt": row["created_at"],
    }
    for campo, chave in (
        ("validade_ate", "validadeAte"), ("enviado_em", "enviadoEm"), ("aprovado_em", "aprovadoEm"),
        ("aprovado_por_nome", "aprovadoPorNome"), ("aprovacao_canal", "aprovacaoCanal"),
        ("aprovacao_obs", "aprovacaoObs"), ("recusado_em", "recusadoEm"),
        ("motivo_recusa", "motivoRecusa"), ("updated_at", "updatedAt"),
    ):
        if row.get(campo):
            out[chave] = row[campo]
    if hoje is not None and row["status"] == "enviado" and row.get("validade_ate"):
        out["vencido"] = row["validade_ate"] < hoje.isoformat()

    if ver_margem:
        custo = sum(
            (Decimal(str(i["quantidade"])) * Decimal(str(i["custo_unitario"]))
             for i in itens if i.get("custo_unitario") is not None),
            Decimal("0"),
        )
        custo = _centavos(custo)
        total = Decimal(str(row["total"]))
        out["custoTotal"] = _num(custo)
        out["margem"] = _num(total - custo)
        if total > 0:
            out["margemPercentual"] = round(float((total - custo) / total * 100), 1)
    return out


# ── Acesso ao banco ───────────────────────────────────────────────────────────

def _itens_de(ids: list) -> dict:
    """{orcamento_id: [linhas de item na ordem]} num lote só (paginado)."""
    if not ids:
        return {}
    linhas = _listar_todos(lambda: (
        supabase.table(ITENS).select("*").in_("orcamento_id", ids)
        .order("orcamento_id").order("posicao").order("id")
    ))
    por_orc = {i: [] for i in ids}
    for l in linhas:
        por_orc[str(l["orcamento_id"])].append(l)
    return por_orc


def _buscar_orcamento(orcamento_id: str, oficina_doc: str):
    if not _uuid_valido(orcamento_id):
        return None
    res = (
        supabase.table(ORCAMENTOS).select("*")
        .eq("id", orcamento_id).eq("oficina_doc", oficina_doc).limit(1).execute()
    )
    return res.data[0] if res.data else None


def _responder_orcamento(request, oficina_doc, orcamento_id, http=http_status.HTTP_200_OK, extra=None):
    """Relê a versão (já com o efeito da operação) e devolve no formato da API."""
    hoje, erro = _hoje(request)
    if erro:
        hoje = None
    row = _buscar_orcamento(str(orcamento_id), oficina_doc)
    if row is None:
        return _nao_encontrado("Orçamento não encontrado.")
    itens = _itens_de([str(row["id"])]).get(str(row["id"]), [])
    corpo = orcamento_para_api(row, itens, _ver_margem(request), hoje)
    if extra:
        corpo.update(extra)
    return Response(corpo, status=http)


def _falha_da_funcao(resultado: dict):
    """Resposta HTTP para um {ok: false, codigo, mensagem, ...} das funções SQL."""
    codigo = resultado.get("codigo")
    corpo = {"detail": resultado.get("mensagem") or "Operação não permitida.", "codigo": codigo}
    if codigo == "rascunho_existente":
        corpo["orcamentoId"] = str(resultado["orcamento_id"])
    if codigo == "os_status":
        corpo["osStatus"] = resultado.get("os_status")
    if codigo == "status_invalido":
        corpo["status"] = resultado.get("status")
    if codigo == "vencido":
        corpo["validadeAte"] = resultado.get("validade_ate")
    if codigo == "sem_itens":
        corpo["itens"] = [corpo["detail"]]
    return Response(corpo, status=STATUS_POR_CODIGO.get(codigo, http_status.HTTP_409_CONFLICT))


def _ordem_da_oficina(ordem_id: str, oficina_doc: str):
    res = (
        supabase.table("ordens").select("id,status")
        .eq("id", ordem_id).eq("oficina_doc", oficina_doc).limit(1).execute()
    )
    return res.data[0] if res.data else None


# ── Rotas ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@require_auth
@_tratar_erros_banco
def orcamentos_da_ordem(request, ordem_id):
    """
    GET  /ordens/<id>/orcamentos → versões da OS, a mais nova primeiro
    POST /ordens/<id>/orcamentos → cria o rascunho da próxima versão
    """
    negado = _negado(request, "ordens.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        negado = _negado(request, "ordens.editar")
        if negado:
            return negado
        resultado = _jsonb(supabase.rpc("orcamento_criar_versao", {
            "p_oficina_doc": oficina_doc,
            "p_ordem_id": ordem_id,
            "p_os_permitidos": list(os_status.ACEITAM_NOVO_ORCAMENTO),
            "p_agora": _now(),
            "p_nome": request.admin.get("nome", ""),
            "p_tipo": request.admin.get("tipo", ""),
        }).execute().data)
        if not resultado["ok"]:
            return _falha_da_funcao(resultado)
        return _responder_orcamento(
            request, oficina_doc, resultado["orcamento_id"], http_status.HTTP_201_CREATED,
            extra={"osStatus": resultado["os_status"]},
        )

    if _ordem_da_oficina(ordem_id, oficina_doc) is None:
        return _nao_encontrado("OS não encontrada.")
    hoje, erro = _hoje(request)
    if erro:
        return erro
    linhas = _listar_todos(lambda: (
        supabase.table(ORCAMENTOS).select("*")
        .eq("oficina_doc", oficina_doc).eq("ordem_id", ordem_id)
        .order("versao", desc=True)
    ))
    itens = _itens_de([str(l["id"]) for l in linhas])
    ver_margem = _ver_margem(request)
    return Response([
        orcamento_para_api(l, itens.get(str(l["id"]), []), ver_margem, hoje) for l in linhas
    ])


@api_view(["GET", "PATCH"])
@require_auth
@_tratar_erros_banco
def orcamento_detail(request, orcamento_id):
    """
    GET   /orcamentos/<id> → uma versão
    PATCH /orcamentos/<id> → edita o rascunho: {validadeDias?, observacoes?, itens?}
    """
    negado = _negado(request, "ordens.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    atual = _buscar_orcamento(orcamento_id, oficina_doc)
    if atual is None:
        return _nao_encontrado("Orçamento não encontrado.")
    if request.method == "GET":
        return _responder_orcamento(request, oficina_doc, atual["id"])

    negado = _negado(request, "ordens.editar")
    if negado:
        return negado
    if not _corpo_valido(request):
        return Response({"detail": "Corpo da requisição inválido."}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    serializer = OrcamentoSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    dados = serializer.validated_data

    itens_atuais = _itens_de([str(atual["id"])]).get(str(atual["id"]), [])
    if "itens" in dados:
        itens = _itens_para_banco(dados["itens"], itens_atuais)
    else:
        itens = [_linha_para_item(i, n) for n, i in enumerate(itens_atuais)]

    resultado = _jsonb(supabase.rpc("orcamento_salvar", {
        "p_oficina_doc": oficina_doc,
        "p_orcamento_id": str(atual["id"]),
        "p_validade_dias": dados.get("validadeDias", atual["validade_dias"]),
        "p_observacoes": (
            (dados.get("observacoes") or "").strip() if "observacoes" in dados else atual.get("observacoes") or ""
        ),
        "p_itens": itens,
        "p_agora": _now(),
    }).execute().data)
    if not resultado["ok"]:
        return _falha_da_funcao(resultado)
    return _responder_orcamento(request, oficina_doc, atual["id"])


def _linha_para_item(row: dict, posicao: int) -> dict:
    """Item já gravado → formato que a função orcamento_salvar espera (preserva tudo, inclusive custo)."""
    return {
        "posicao": posicao,
        "tipo": row["tipo"],
        "descricao": row["descricao"],
        "marca": row.get("marca") or "",
        "quantidade": row["quantidade"],
        "preco_unitario": row["preco_unitario"],
        "custo_unitario": row.get("custo_unitario"),
        "motivo": row.get("motivo") or "",
        "estoque_item_id": row.get("estoque_item_id"),
        "servico_id": row.get("servico_id"),
    }


def _itens_para_banco(itens_novos: list, itens_atuais: list) -> list:
    """Itens validados → lista pra orcamento_salvar.

    Custo: quem não tem financeiro.ver_margem nunca recebe o custo, então o
    cliente dele não consegue devolvê-lo. Item que chega com `id` conhecido e
    SEM `custoUnitario` mantém o custo gravado; `custoUnitario: null` limpa."""
    custo_por_id = {str(i["id"]): i.get("custo_unitario") for i in itens_atuais}
    saida = []
    for posicao, item in enumerate(itens_novos):
        if "custoUnitario" in item:
            custo = item["custoUnitario"]
        else:
            custo = custo_por_id.get(str(item["id"])) if item.get("id") else None
        saida.append({
            "posicao": posicao,
            "tipo": item["tipo"],
            "descricao": item["descricao"],
            "marca": (item.get("marca") or "").strip(),
            "quantidade": round(item["quantidade"], 3),
            "preco_unitario": round(item["precoUnitario"], 2),
            "custo_unitario": None if custo is None else round(float(custo), 2),
            "motivo": (item.get("motivo") or "").strip(),
            "estoque_item_id": str(item["estoqueItemId"]) if item.get("estoqueItemId") else None,
            "servico_id": str(item["servicoId"]) if item.get("servicoId") else None,
        })
    return saida


@api_view(["POST"])
@require_auth
@_tratar_erros_banco
def orcamento_enviar(request, orcamento_id):
    """POST /orcamentos/<id>/enviar — rascunho → enviado; versões ativas anteriores viram
    'substituido' e a OS vai para 'pendente_aprovacao'. A validade conta a partir de hoje."""
    negado = _negado(request, "ordens.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(orcamento_id):
        return _nao_encontrado("Orçamento não encontrado.")
    hoje, erro = _hoje(request)
    if erro:
        return erro

    resultado = _jsonb(supabase.rpc("orcamento_enviar", {
        "p_oficina_doc": oficina_doc,
        "p_orcamento_id": orcamento_id,
        "p_os_permitidos": os_status.origens_para(os_status.PENDENTE_APROVACAO),
        "p_os_novo": os_status.PENDENTE_APROVACAO,
        "p_hoje": hoje.isoformat(),
        "p_agora": _now(),
    }).execute().data)
    if not resultado["ok"]:
        return _falha_da_funcao(resultado)
    return _responder_orcamento(request, oficina_doc, orcamento_id, extra={"osStatus": resultado["os_status"]})


@api_view(["POST"])
@require_auth
@_tratar_erros_banco
def orcamento_aprovar(request, orcamento_id):
    """POST /orcamentos/<id>/aprovar  {canal?, observacao?} — registra a aprovação do cliente
    (ex.: resposta por WhatsApp). enviado → aprovado; OS → aprovada. Orçamento vencido não aprova."""
    negado = _negado(request, "ordens.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(orcamento_id):
        return _nao_encontrado("Orçamento não encontrado.")
    dados = request.data if _corpo_valido(request) else {}
    serializer = OrcamentoAprovacaoSerializer(data=dados)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    hoje, erro = _hoje(request)
    if erro:
        return erro

    resultado = _jsonb(supabase.rpc("orcamento_aprovar", {
        "p_oficina_doc": oficina_doc,
        "p_orcamento_id": orcamento_id,
        "p_os_permitidos": os_status.origens_para(os_status.APROVADA),
        "p_os_novo": os_status.APROVADA,
        "p_hoje": hoje.isoformat(),
        "p_canal": serializer.validated_data["canal"],
        "p_obs": (serializer.validated_data.get("observacao") or "").strip(),
        "p_nome": request.admin.get("nome", ""),
        "p_agora": _now(),
    }).execute().data)
    if not resultado["ok"]:
        return _falha_da_funcao(resultado)
    return _responder_orcamento(request, oficina_doc, orcamento_id, extra={"osStatus": resultado["os_status"]})


@api_view(["POST"])
@require_auth
@_tratar_erros_banco
def orcamento_recusar(request, orcamento_id):
    """POST /orcamentos/<id>/recusar  {motivo?} — enviado | aprovado → recusado; OS → recusada.
    Pra refazer, crie uma nova versão (POST /ordens/<id>/orcamentos): a OS reabre em 'em_orcamento'."""
    negado = _negado(request, "ordens.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(orcamento_id):
        return _nao_encontrado("Orçamento não encontrado.")
    dados = request.data if _corpo_valido(request) else {}
    serializer = OrcamentoRecusaSerializer(data=dados)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    resultado = _jsonb(supabase.rpc("orcamento_recusar", {
        "p_oficina_doc": oficina_doc,
        "p_orcamento_id": orcamento_id,
        "p_os_permitidos": os_status.origens_para(os_status.RECUSADA),
        "p_os_novo": os_status.RECUSADA,
        "p_motivo": (serializer.validated_data.get("motivo") or "").strip(),
        "p_agora": _now(),
    }).execute().data)
    if not resultado["ok"]:
        return _falha_da_funcao(resultado)
    return _responder_orcamento(request, oficina_doc, orcamento_id, extra={"osStatus": resultado["os_status"]})
