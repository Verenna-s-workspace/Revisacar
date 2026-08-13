"""
Financeiro. Arquivo separado de views.py (que já ia longe demais) —
reaproveita supabase/require_permission/etc. de lá em vez de duplicar.

Duas permissões controlam isso (ver rbac.py):
  financeiro.ver         → lista transações, vê os totais (sem lucro/margem)
  financeiro.ver_margem  → também vê lucro e margem %
  financeiro.editar      → lança/edita/cancela transações
Hoje só Dono tem ver_margem — Gerente vê o caixa andando mas não a margem.
"""
from datetime import date
import calendar

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status as http_status

from .views import supabase, require_auth, require_permission, _oficina_doc_do_token, _now
from .serializers import (
    FinanceiroTransacaoSerializer, CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, FORMAS_PAGAMENTO,
)

TABELA = "financeiro_transacoes"


def _periodo_padrao() -> tuple[str, str]:
    """Mês atual, se o front não mandar 'de'/'ate'."""
    hoje = date.today()
    inicio = hoje.replace(day=1)
    fim = date(hoje.year, hoje.month, calendar.monthrange(hoje.year, hoje.month)[1])
    return inicio.isoformat(), fim.isoformat()


def _parse_periodo(request) -> tuple[str, str]:
    de = request.query_params.get("de")
    ate = request.query_params.get("ate")
    if not de or not ate:
        return _periodo_padrao()
    return de, ate


def _is_vencido(linha: dict) -> bool:
    if linha.get("status") != "pendente" or not linha.get("data_vencimento"):
        return False
    return linha["data_vencimento"] < date.today().isoformat()


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
def transacoes(request):
    permissoes = request.admin.get("permissoes", [])
    if "financeiro.ver" not in permissoes:
        return Response({"detail": "Você não tem permissão para isso"}, status=http_status.HTTP_403_FORBIDDEN)

    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        if "financeiro.editar" not in permissoes:
            return Response({"detail": "Você não tem permissão para lançar transações"}, status=http_status.HTTP_403_FORBIDDEN)

        serializer = FinanceiroTransacaoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

        row = _serializavel(serializer.validated_data)
        row.update({
            "oficina_doc": oficina_doc,
            "criado_por_nome": request.admin.get("nome", ""),
            "criado_por_tipo": request.admin.get("tipo", ""),
            "created_at": _now(),
        })
        res = supabase.table(TABELA).insert(row).execute()
        criada = res.data[0] if res.data else row
        criada["vencido"] = _is_vencido(criada)
        return Response(criada, status=http_status.HTTP_201_CREATED)

    # GET
    # 'status=pendente&sem_periodo=1' ignora o filtro de data — é o que o
    # widget de "contas a pagar/receber" usa (pendência não tem prazo de
    # validade só porque saiu do mês corrente).
    tipo = request.query_params.get("tipo")
    status_filtro = request.query_params.get("status")
    sem_periodo = request.query_params.get("sem_periodo") == "1"

    q = supabase.table(TABELA).select("*").eq("oficina_doc", oficina_doc).neq("status", "cancelado")
    if not sem_periodo:
        de, ate = _parse_periodo(request)
        q = q.gte("data_competencia", de).lte("data_competencia", ate)
    if tipo in ("entrada", "saida"):
        q = q.eq("tipo", tipo)
    if status_filtro in ("pendente", "pago"):
        q = q.eq("status", status_filtro)

    linhas = q.order("data_competencia", desc=True).execute().data or []
    for linha in linhas:
        linha["vencido"] = _is_vencido(linha)
    return Response(linhas)


@api_view(["PATCH", "DELETE"])
@require_permission("financeiro.editar")
def transacao_detail(request, transacao_id):
    oficina_doc = _oficina_doc_do_token(request.admin)
    atual = supabase.table(TABELA).select("*").eq("id", transacao_id).limit(1).execute().data
    if not atual or atual[0]["oficina_doc"] != oficina_doc:
        return Response({"detail": "Não encontrado"}, status=http_status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        # Nunca apaga de verdade — registro financeiro cancelado ainda é
        # histórico. "Excluir" na UI só marca como cancelado.
        supabase.table(TABELA).update({"status": "cancelado"}).eq("id", transacao_id).execute()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    campos_permitidos = {
        "categoria", "descricao", "valor", "forma_pagamento", "status",
        "data_competencia", "data_vencimento", "data_pagamento", "cliente_nome",
    }
    entrada = {k: v for k, v in request.data.items() if k in campos_permitidos}
    if not entrada:
        return Response({"detail": "Nada para atualizar"}, status=http_status.HTTP_400_BAD_REQUEST)

    # valida reaproveitando o mesmo serializer, só com os campos parciais +
    # o que já existe (pra 'categoria' continuar validando contra o 'tipo' certo)
    completo = {**atual[0], **entrada}
    serializer = FinanceiroTransacaoSerializer(data=completo)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    atualizacao = _serializavel({k: v for k, v in serializer.validated_data.items() if k in entrada or k == "data_pagamento"})
    supabase.table(TABELA).update(atualizacao).eq("id", transacao_id).execute()
    return Response({"message": "Atualizado"})


@api_view(["GET"])
@require_permission("financeiro.ver")
def resumo(request):
    oficina_doc = _oficina_doc_do_token(request.admin)
    de, ate = _parse_periodo(request)
    ve_margem = "financeiro.ver_margem" in request.admin.get("permissoes", [])

    todas = (
        supabase.table(TABELA)
        .select("tipo, valor, status, data_competencia, data_vencimento")
        .eq("oficina_doc", oficina_doc)
        .neq("status", "cancelado")
        .execute().data or []
    )

    do_periodo = [r for r in todas if de <= r["data_competencia"] <= ate]
    faturamento = sum(r["valor"] for r in do_periodo if r["tipo"] == "entrada")
    despesas = sum(r["valor"] for r in do_periodo if r["tipo"] == "saida")
    recebido = sum(r["valor"] for r in do_periodo if r["tipo"] == "entrada" and r["status"] == "pago")
    saidas_pagas = sum(r["valor"] for r in do_periodo if r["tipo"] == "saida" and r["status"] == "pago")

    # a_receber/a_pagar são a dívida em aberto AGORA — não um corte do período.
    pendentes = [r for r in todas if r["status"] == "pendente"]
    hoje_iso = date.today().isoformat()
    a_receber = sum(r["valor"] for r in pendentes if r["tipo"] == "entrada")
    a_pagar = sum(r["valor"] for r in pendentes if r["tipo"] == "saida")
    vencido_receber = sum(r["valor"] for r in pendentes if r["tipo"] == "entrada" and r.get("data_vencimento") and r["data_vencimento"] < hoje_iso)
    vencido_pagar = sum(r["valor"] for r in pendentes if r["tipo"] == "saida" and r.get("data_vencimento") and r["data_vencimento"] < hoje_iso)

    resposta = {
        "periodo": {"de": de, "ate": ate},
        "faturamento": round(faturamento, 2),
        "despesas": round(despesas, 2),
        "recebido": round(recebido, 2),
        "saldo": round(recebido - saidas_pagas, 2),
        "a_receber": round(a_receber, 2),
        "a_pagar": round(a_pagar, 2),
        "vencido_receber": round(vencido_receber, 2),
        "vencido_pagar": round(vencido_pagar, 2),
    }
    if ve_margem:
        lucro = faturamento - despesas
        resposta["lucro"] = round(lucro, 2)
        resposta["margem_percentual"] = round(lucro / faturamento * 100, 1) if faturamento > 0 else 0.0

    return Response(resposta)