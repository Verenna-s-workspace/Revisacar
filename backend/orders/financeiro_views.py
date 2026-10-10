"""
Financeiro. Arquivo separado de views.py (que já ia longe demais) —
reaproveita supabase/require_permission/etc. de lá em vez de duplicar.

Duas permissões controlam isso (ver rbac.py):
  financeiro.ver         → lista transações, vê os totais (sem lucro/margem)
  financeiro.ver_margem  → também vê lucro e margem %
  financeiro.editar      → lança/edita/cancela transações
Hoje só Dono tem ver_margem — Gerente vê o caixa andando mas não a margem.

Tabela: `financeiro_transacoes` (backend/sql/financeiro.sql). As respostas
daqui continuam em snake_case (é o formato que o frontend de Financeiro já
usa); os módulos mais novos usam camelCase.

"Hoje" (período padrão e "vencido") vem do fuso do usuário (?tz=...),
padrão America/Sao_Paulo — não do relógio do servidor.
"""
import calendar
import logging
from datetime import date, timedelta
from decimal import Decimal

from postgrest.exceptions import APIError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status as http_status

from .views import supabase, require_auth, require_permission, _oficina_doc_do_token, _now
from .serializers import (
    FinanceiroTransacaoSerializer, CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, FORMAS_PAGAMENTO,
)
from .estoque_views import _listar_todos
from . import visao_geral_views as vg

logger = logging.getLogger(__name__)

TABELA = "financeiro_transacoes"
# Um relatório de mais de ~2 anos de lançamentos não é uma tela de caixa.
MAX_DIAS_PERIODO = 800

CAMPOS_EDITAVEIS = {
    "categoria", "descricao", "valor", "forma_pagamento", "status",
    "data_competencia", "data_vencimento", "data_pagamento", "cliente_nome",
}


# ── Erros do banco ────────────────────────────────────────────────────────────

def _tratar_erros_banco(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            mensagem = str(getattr(e, "message", e))
            if codigo in ("42P01", "PGRST205", "42703", "PGRST204"):
                logger.error("Financeiro: tabela/coluna ausente (%s): %s", codigo, mensagem)
                return Response(
                    {"detail": "A tabela do Financeiro não está completa no banco. "
                               "Rode backend/sql/financeiro.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo == "42501":
                logger.error("Financeiro: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role.")
                return Response(
                    {"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            if codigo == "22P02":
                # id que nem tem o formato de um id (ex.: /transacoes/abc).
                return Response({"detail": "Não encontrado"}, status=http_status.HTTP_404_NOT_FOUND)
            if codigo == "23503":
                return Response({"detail": "Oficina inválida para este lançamento."},
                                status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
            logger.exception("Financeiro: erro do banco (%s)", codigo)
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


# ── Parâmetros ────────────────────────────────────────────────────────────────

class _ParametroInvalido(Exception):
    pass


def _hoje(request) -> date:
    tz = vg._ler_tz(request)
    if tz is None:
        raise _ParametroInvalido(f"Fuso horário desconhecido: '{request.query_params.get('tz')}'.")
    return vg._agora(tz).date()


def _data(bruto: str, nome: str) -> date:
    try:
        if len(bruto) != 10:
            raise ValueError
        return date.fromisoformat(bruto)
    except ValueError:
        raise _ParametroInvalido(f"'{nome}' inválida (use YYYY-MM-DD).")


def _ler_periodo(request, hoje: date) -> tuple[date, date]:
    """`de` e `ate` juntos, ou nenhum dos dois (aí é o mês atual)."""
    bruto_de = request.query_params.get("de")
    bruto_ate = request.query_params.get("ate")
    if not bruto_de and not bruto_ate:
        fim = date(hoje.year, hoje.month, calendar.monthrange(hoje.year, hoje.month)[1])
        return hoje.replace(day=1), fim
    if not bruto_de or not bruto_ate:
        raise _ParametroInvalido("Informe 'de' e 'ate' juntos (ou nenhum dos dois).")
    de, ate = _data(bruto_de, "de"), _data(bruto_ate, "ate")
    if de > ate:
        raise _ParametroInvalido("'de' não pode ser depois de 'ate'.")
    if (ate - de) > timedelta(days=MAX_DIAS_PERIODO):
        raise _ParametroInvalido(f"Período grande demais (máximo {MAX_DIAS_PERIODO} dias).")
    return de, ate


def _erro_422(mensagem: str):
    return Response({"detail": mensagem}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)


# ── Conversões ────────────────────────────────────────────────────────────────

def _is_vencido(linha: dict, hoje: date) -> bool:
    if linha.get("status") != "pendente" or not linha.get("data_vencimento"):
        return False
    return linha["data_vencimento"] < hoje.isoformat()


def _para_api(linha: dict, hoje: date) -> dict:
    """Linha do banco → JSON do frontend: sem a oficina, texto nunca nulo,
    valor sempre número e `vencido` calculado (nunca é gravado)."""
    out = {k: v for k, v in linha.items() if k != "oficina_doc"}
    out["valor"] = float(out["valor"])
    out["descricao"] = out.get("descricao") or ""
    out["cliente_nome"] = out.get("cliente_nome") or ""
    out["vencido"] = _is_vencido(out, hoje)
    return out


def _serializavel(dados: dict) -> dict:
    """DecimalField/DateField/DateTimeField não viram JSON sozinhos —
    convertidos aqui antes de mandar pro Supabase."""
    out = dict(dados)
    if "valor" in out and out["valor"] is not None:
        out["valor"] = float(out["valor"])
    for campo in ("data_competencia", "data_vencimento", "data_pagamento"):
        if out.get(campo) is not None:
            out[campo] = out[campo].isoformat()
    return out


def _soma(linhas) -> Decimal:
    # Decimal(str(float)) evita 0.1 + 0.2 = 0.30000000000000004 nos totais.
    return sum((Decimal(str(l["valor"])) for l in linhas), Decimal("0"))


def _corpo_valido(request) -> bool:
    return isinstance(request.data, dict)


@api_view(["GET"])
def categorias(request):
    """Catálogo fixo pro front montar os selects — não precisa de auth pra
    ver *quais categorias existem*, só pra ver os dados de verdade."""
    return Response({
        "entrada": list(CATEGORIAS_ENTRADA),
        "saida": list(CATEGORIAS_SAIDA),
        "formas_pagamento": list(FORMAS_PAGAMENTO),
    })


@api_view(["GET", "POST"])
@require_auth
@_tratar_erros_banco
def transacoes(request):
    permissoes = request.admin.get("permissoes", [])
    if "financeiro.ver" not in permissoes:
        return Response({"detail": "Você não tem permissão para isso"}, status=http_status.HTTP_403_FORBIDDEN)

    oficina_doc = _oficina_doc_do_token(request.admin)
    try:
        hoje = _hoje(request)
    except _ParametroInvalido as e:
        return _erro_422(str(e))

    if request.method == "POST":
        if "financeiro.editar" not in permissoes:
            return Response({"detail": "Você não tem permissão para lançar transações"}, status=http_status.HTTP_403_FORBIDDEN)
        if not _corpo_valido(request):
            return Response({"detail": "Corpo da requisição inválido."}, status=http_status.HTTP_400_BAD_REQUEST)

        serializer = FinanceiroTransacaoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
        dados = serializer.validated_data
        if dados["status"] == "cancelado":
            return Response({"status": ["Não dá para criar um lançamento já cancelado."]},
                            status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
        if dados["status"] != "pago":
            dados["data_pagamento"] = None  # pendente não tem data de pagamento

        row = _serializavel(dados)
        row.update({
            "oficina_doc": oficina_doc,
            "criado_por_nome": request.admin.get("nome", ""),
            "criado_por_tipo": request.admin.get("tipo", ""),
            "created_at": _now(),
        })
        res = supabase.table(TABELA).insert(row).execute()
        criada = res.data[0] if res.data else row
        return Response(_para_api(criada, hoje), status=http_status.HTTP_201_CREATED)

    # GET
    # 'status=pendente&sem_periodo=1' ignora o filtro de data — é o que o
    # widget de "contas a pagar/receber" usa (pendência não tem prazo de
    # validade só porque saiu do mês corrente).
    tipo = request.query_params.get("tipo")
    status_filtro = request.query_params.get("status")
    sem_periodo = request.query_params.get("sem_periodo") == "1"

    periodo = None
    if not sem_periodo:
        try:
            periodo = _ler_periodo(request, hoje)
        except _ParametroInvalido as e:
            return _erro_422(str(e))

    def consulta():
        q = supabase.table(TABELA).select("*").eq("oficina_doc", oficina_doc).neq("status", "cancelado")
        if periodo:
            q = q.gte("data_competencia", periodo[0].isoformat()).lte("data_competencia", periodo[1].isoformat())
        if tipo in ("entrada", "saida"):
            q = q.eq("tipo", tipo)
        if status_filtro in ("pendente", "pago"):
            q = q.eq("status", status_filtro)
        return q.order("data_competencia", desc=True).order("created_at", desc=True).order("id")

    return Response([_para_api(l, hoje) for l in _listar_todos(consulta)])


@api_view(["PATCH", "DELETE"])
@require_permission("financeiro.editar")
@_tratar_erros_banco
def transacao_detail(request, transacao_id):
    oficina_doc = _oficina_doc_do_token(request.admin)
    try:
        hoje = _hoje(request)
    except _ParametroInvalido as e:
        return _erro_422(str(e))

    atual = (
        supabase.table(TABELA).select("*")
        .eq("id", transacao_id).eq("oficina_doc", oficina_doc).limit(1).execute().data
    )
    if not atual:
        return Response({"detail": "Não encontrado"}, status=http_status.HTTP_404_NOT_FOUND)
    atual = atual[0]

    if request.method == "DELETE":
        # Nunca apaga de verdade — registro financeiro cancelado ainda é
        # histórico. "Excluir" na UI só marca como cancelado (e repetir é inofensivo).
        if atual["status"] != "cancelado":
            (supabase.table(TABELA).update({"status": "cancelado"})
             .eq("id", transacao_id).eq("oficina_doc", oficina_doc).execute())
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    if not _corpo_valido(request):
        return Response({"detail": "Corpo da requisição inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
    if atual["status"] == "cancelado":
        return Response({"detail": "Lançamento cancelado não pode ser editado."}, status=http_status.HTTP_409_CONFLICT)
    if "tipo" in request.data and request.data["tipo"] != atual["tipo"]:
        return Response({"tipo": ["O tipo do lançamento não pode ser alterado."]},
                        status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    if request.data.get("status") == "cancelado":
        return Response({"status": ["Para cancelar um lançamento use DELETE."]},
                        status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    entrada = {k: v for k, v in request.data.items() if k in CAMPOS_EDITAVEIS}
    if not entrada:
        return Response({"detail": "Nada para atualizar"}, status=http_status.HTTP_400_BAD_REQUEST)

    # Valida reaproveitando o mesmo serializer: o que já existe + o que veio
    # (pra 'categoria' continuar validando contra o 'tipo' certo). Texto nulo
    # no banco (linha antiga) vira "" — o serializer não aceita null aí.
    existente = {k: ("" if v is None and k in ("descricao", "cliente_nome") else v) for k, v in atual.items()}
    completo = {**existente, **entrada}
    serializer = FinanceiroTransacaoSerializer(data=completo)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    dados = serializer.validated_data

    if dados["status"] != "pago":
        dados["data_pagamento"] = None  # voltou pra pendente: não houve pagamento

    mexeu_no_pagamento = "status" in entrada or "data_pagamento" in entrada
    atualizacao = _serializavel({
        k: v for k, v in dados.items()
        if k in entrada or (k == "data_pagamento" and mexeu_no_pagamento)
    })
    res = (
        supabase.table(TABELA).update(atualizacao)
        .eq("id", transacao_id).eq("oficina_doc", oficina_doc).execute()
    )
    if not res.data:
        return Response({"detail": "Não encontrado"}, status=http_status.HTTP_404_NOT_FOUND)
    return Response(_para_api(res.data[0], hoje))


@api_view(["GET"])
@require_permission("financeiro.ver")
@_tratar_erros_banco
def resumo(request):
    oficina_doc = _oficina_doc_do_token(request.admin)
    try:
        hoje = _hoje(request)
        de, ate = _ler_periodo(request, hoje)
    except _ParametroInvalido as e:
        return _erro_422(str(e))
    ve_margem = "financeiro.ver_margem" in request.admin.get("permissoes", [])

    do_periodo = _listar_todos(lambda: (
        supabase.table(TABELA).select("id,tipo,valor,status")
        .eq("oficina_doc", oficina_doc).neq("status", "cancelado")
        .gte("data_competencia", de.isoformat()).lte("data_competencia", ate.isoformat())
        .order("id")
    ))
    faturamento = _soma(r for r in do_periodo if r["tipo"] == "entrada")
    despesas = _soma(r for r in do_periodo if r["tipo"] == "saida")
    recebido = _soma(r for r in do_periodo if r["tipo"] == "entrada" and r["status"] == "pago")
    saidas_pagas = _soma(r for r in do_periodo if r["tipo"] == "saida" and r["status"] == "pago")

    # a_receber/a_pagar são a dívida em aberto AGORA — não um corte do período.
    pendentes = _listar_todos(lambda: (
        supabase.table(TABELA).select("id,tipo,valor,data_vencimento")
        .eq("oficina_doc", oficina_doc).eq("status", "pendente").order("id")
    ))
    hoje_iso = hoje.isoformat()

    def vencida(r):
        return bool(r.get("data_vencimento")) and r["data_vencimento"] < hoje_iso

    entradas_pend = [r for r in pendentes if r["tipo"] == "entrada"]
    saidas_pend = [r for r in pendentes if r["tipo"] == "saida"]

    resposta = {
        "periodo": {"de": de.isoformat(), "ate": ate.isoformat()},
        "faturamento": float(round(faturamento, 2)),
        "despesas": float(round(despesas, 2)),
        "recebido": float(round(recebido, 2)),
        "saldo": float(round(recebido - saidas_pagas, 2)),
        "a_receber": float(round(_soma(entradas_pend), 2)),
        "a_pagar": float(round(_soma(saidas_pend), 2)),
        "vencido_receber": float(round(_soma(r for r in entradas_pend if vencida(r)), 2)),
        "vencido_pagar": float(round(_soma(r for r in saidas_pend if vencida(r)), 2)),
    }
    if ve_margem:
        lucro = faturamento - despesas
        resposta["lucro"] = float(round(lucro, 2))
        resposta["margem_percentual"] = float(round(lucro / faturamento * 100, 1)) if faturamento > 0 else 0.0

    return Response(resposta)
