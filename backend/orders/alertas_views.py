"""
Alertas da oficina — dados que o frontend não consegue montar sozinho.

Rotas:
  GET   /alertas                         (qualquer usuário logado; cada bloco exige a sua permissão)
        Devolve só os DADOS (o texto e a urgência de cada alerta são da tela). Blocos:
          orcamentosSemResposta  (ordens.ver)   orçamento ENVIADO vencido ou sem resposta há ≥ 2 dias
          aprovadasParadas       (ordens.ver)   OS aprovada que não começou a execução há ≥ 1 dia
          reservasSemEstoque     (estoque.ver)  item cuja soma reservada nas OS passa do que há em estoque
          semPagamento           (financeiro.ver) OS concluída há ≥ 1 dia com lançamento de entrada pendente
        Bloco sem permissão NÃO vem na resposta (≠ vazio). Bloco cuja tabela ainda não existe
        (script não rodado) vem vazio e o nome entra em `indisponiveis`.
        `?tz=` define o "hoje" (padrão America/Sao_Paulo), como no resto do app.
  PATCH /ordens/<id>/cliente-avisado     {avisado: bool}   (ordens.editar OU ordens.criar)
        Grava no banco que o cliente foi (ou não) avisado — antes ficava só no navegador.
        Quem avisa o cliente costuma ser o atendente, que não tem ordens.editar, por isso as duas.

Os limites (em dias) estão em LIMITES e voltam na resposta, pra tela e a regra nunca divergirem.
"""
import logging
from datetime import datetime, timezone

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import visao_geral_views as vg
from .estoque_views import _listar_todos, _num
from .serializers import ClienteAvisadoSerializer
from .views import supabase, require_auth, _get_ordem_or_404, _now, _oficina_doc_do_token, _ordens_precisam_do_sql, _require_auth

logger = logging.getLogger(__name__)

LIMITES = {
    "orcamentoSemRespostaDias": 2,
    "aprovadaParadaDias": 1,
    "semPagamentoDias": 1,
}

LOTE_IDS = 100
OBJETO_INEXISTENTE = {"42P01", "PGRST205", "42703", "PGRST204"}


# ── utilidades ───────────────────────────────────────────────────────────────

def _dt(valor):
    """ISO do banco → datetime com fuso (None se vazio/ilegível)."""
    if not valor:
        return None
    try:
        d = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _dias(desde, agora) -> int:
    """Dias inteiros entre `desde` e `agora` (nunca negativo)."""
    d = _dt(desde)
    if d is None:
        return 0
    return max(0, int((agora - d).total_seconds() // 86400))


def _em_lotes(ids, tamanho=LOTE_IDS):
    ids = list(dict.fromkeys(ids))
    for i in range(0, len(ids), tamanho):
        yield ids[i:i + tamanho]


def _ordens_por_id(oficina_doc, ids) -> dict:
    """{id: linha da OS} das OS desta oficina. select * de propósito: colunas das
    fases novas (concluida_em…) só existem depois dos scripts."""
    mapa = {}
    for lote in _em_lotes(ids):
        linhas = (
            supabase.table("ordens").select("*")
            .eq("oficina_doc", oficina_doc).in_("id", lote).execute().data or []
        )
        mapa.update({l["id"]: l for l in linhas})
    return mapa


def _identificacao(ordem: dict) -> dict:
    return {
        "ordemId": ordem["id"], "osNum": ordem.get("os_num") or "",
        "cliente": ordem.get("cliente") or "", "placa": ordem.get("placa") or "",
        "modelo": ordem.get("modelo") or "",
    }


# ── blocos ───────────────────────────────────────────────────────────────────

def _orcamentos_sem_resposta(oficina_doc, agora, hoje) -> list:
    orcs = _listar_todos(lambda: (
        supabase.table("orcamentos").select("*")
        .eq("oficina_doc", oficina_doc).eq("status", "enviado").order("id")
    ))
    ordens = _ordens_por_id(oficina_doc, [o["ordem_id"] for o in orcs])
    saida = []
    for o in orcs:
        ordem = ordens.get(o["ordem_id"])
        if not ordem:
            continue
        dias = _dias(o.get("enviado_em"), agora)
        vencido = bool(o.get("validade_ate")) and str(o["validade_ate"]) < hoje.isoformat()
        if not vencido and dias < LIMITES["orcamentoSemRespostaDias"]:
            continue
        saida.append({
            **_identificacao(ordem), "orcamentoId": str(o["id"]), "versao": o["versao"],
            "total": _num(o["total"]), "enviadoEm": o.get("enviado_em"),
            "validadeAte": o.get("validade_ate"), "vencido": vencido, "dias": dias,
        })
    # Vencidos primeiro; dentro de cada grupo, o mais antigo primeiro.
    saida.sort(key=lambda a: (not a["vencido"], -a["dias"]))
    return saida


def _aprovadas_paradas(oficina_doc, agora) -> list:
    ordens = _listar_todos(lambda: (
        supabase.table("ordens").select("*")
        .eq("oficina_doc", oficina_doc).eq("status", "aprovada").order("id")
    ))
    if not ordens:
        return []
    por_ordem = {}
    for lote in _em_lotes([o["id"] for o in ordens]):
        for orc in (
            supabase.table("orcamentos").select("*")
            .eq("oficina_doc", oficina_doc).eq("status", "aprovado").in_("ordem_id", lote).execute().data or []
        ):
            por_ordem[orc["ordem_id"]] = orc
    saida = []
    for ordem in ordens:
        orc = por_ordem.get(ordem["id"])
        desde = (orc or {}).get("aprovado_em") or ordem.get("updated_at")
        dias = _dias(desde, agora)
        if dias < LIMITES["aprovadaParadaDias"]:
            continue
        saida.append({
            **_identificacao(ordem), "aprovadoEm": desde, "dias": dias,
            "total": _num(orc["total"]) if orc else None,
        })
    saida.sort(key=lambda a: -a["dias"])
    return saida


def _reservas_sem_estoque(oficina_doc) -> list:
    reservas = _listar_todos(lambda: (
        supabase.table("estoque_reservas").select("*").eq("oficina_doc", oficina_doc).order("id")
    ))
    por_item = {}
    for r in reservas:
        por_item.setdefault(str(r["item_id"]), []).append(r)
    if not por_item:
        return []
    itens = {}
    for lote in _em_lotes(por_item.keys()):
        for i in (
            supabase.table("estoque_itens").select("*")
            .eq("oficina_doc", oficina_doc).in_("id", lote).execute().data or []
        ):
            itens[str(i["id"])] = i
    ordens = _ordens_por_id(oficina_doc, [r["ordem_id"] for r in reservas])
    saida = []
    for item_id, linhas in por_item.items():
        item = itens.get(item_id)
        if not item:
            continue
        reservado = sum(_num(l["quantidade"]) for l in linhas)
        em_estoque = _num(item["quantidade"])
        if reservado <= em_estoque:
            continue
        saida.append({
            "itemId": item_id, "nome": item.get("nome") or "", "reservado": reservado,
            "emEstoque": em_estoque, "falta": round(reservado - em_estoque, 3),
            "ordens": [
                {"ordemId": l["ordem_id"], "osNum": (ordens.get(l["ordem_id"]) or {}).get("os_num") or "",
                 "quantidade": _num(l["quantidade"])}
                for l in sorted(linhas, key=lambda l: str(l["ordem_id"]))
            ],
        })
    saida.sort(key=lambda a: (-a["falta"], a["nome"]))
    return saida


def _sem_pagamento(oficina_doc, agora, hoje) -> list:
    pendentes = _listar_todos(lambda: (
        supabase.table("financeiro_transacoes").select("*")
        .eq("oficina_doc", oficina_doc).eq("tipo", "entrada").eq("status", "pendente").order("id")
    ))
    por_ordem = {}
    for t in pendentes:
        if t.get("ordem_servico_id"):
            por_ordem.setdefault(t["ordem_servico_id"], []).append(t)
    if not por_ordem:
        return []
    ordens = _ordens_por_id(oficina_doc, por_ordem.keys())
    saida = []
    for ordem_id, lancs in por_ordem.items():
        ordem = ordens.get(ordem_id)
        if not ordem or ordem.get("status") != "finalizada":
            continue
        concluida = ordem.get("concluida_em") or ordem.get("updated_at")
        dias = _dias(concluida, agora)
        if dias < LIMITES["semPagamentoDias"]:
            continue
        saida.append({
            **_identificacao(ordem),
            "valorPendente": round(sum(_num(l["valor"]) for l in lancs), 2),
            "concluidaEm": concluida, "dias": dias,
            "vencido": any(l.get("data_vencimento") and str(l["data_vencimento"]) < hoje.isoformat() for l in lancs),
        })
    saida.sort(key=lambda a: -a["dias"])
    return saida


# ── rotas ────────────────────────────────────────────────────────────────────

@api_view(["GET"])
@require_auth
def alertas(request):
    oficina_doc = _oficina_doc_do_token(request.admin)
    tz = vg._ler_tz(request)
    if tz is None:
        return Response({"detail": f"Fuso horário desconhecido: '{request.query_params.get('tz')}'."},
                        status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    agora = vg._agora(tz)
    hoje = agora.date()
    permissoes = set(request.admin.get("permissoes", []))

    blocos = [
        ("orcamentosSemResposta", "orcamentos", "ordens.ver", lambda: _orcamentos_sem_resposta(oficina_doc, agora, hoje)),
        ("aprovadasParadas", "orcamentos", "ordens.ver", lambda: _aprovadas_paradas(oficina_doc, agora)),
        ("reservasSemEstoque", "estoque_reservas", "estoque.ver", lambda: _reservas_sem_estoque(oficina_doc)),
        ("semPagamento", "financeiro", "financeiro.ver", lambda: _sem_pagamento(oficina_doc, agora, hoje)),
    ]
    corpo = {"hoje": hoje.isoformat(), "limites": LIMITES}
    indisponiveis = []
    for chave, origem, permissao, calcular in blocos:
        if permissao not in permissoes:
            continue
        try:
            corpo[chave] = calcular()
        except APIError as e:
            if getattr(e, "code", None) in OBJETO_INEXISTENTE:
                logger.error("Alertas: %s indisponível (%s): %s", chave, e.code, getattr(e, "message", e))
                corpo[chave] = []
                if origem not in indisponiveis:
                    indisponiveis.append(origem)
                continue
            raise
    corpo["indisponiveis"] = indisponiveis
    return Response(corpo)


@api_view(["PATCH"])
@_ordens_precisam_do_sql
def ordem_cliente_avisado(request, ordem_id):
    payload = _require_auth(request)
    if payload is None:
        return Response({"detail": "Token inválido ou expirado"}, status=http_status.HTTP_401_UNAUTHORIZED)
    permissoes = payload.get("permissoes", [])
    if "ordens.editar" not in permissoes and "ordens.criar" not in permissoes:
        return Response({"detail": "Você não tem permissão para isso"}, status=http_status.HTTP_403_FORBIDDEN)
    request.admin = payload

    serializer = ClienteAvisadoSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    avisado = serializer.validated_data["avisado"]

    oficina_doc = _oficina_doc_do_token(payload)
    row, err = _get_ordem_or_404(ordem_id, oficina_doc)
    if err:
        return err
    if bool(row.get("cliente_avisado")) == avisado:
        return Response(row)          # repetir é inofensivo

    atualizacao = {
        "cliente_avisado": avisado,
        "cliente_avisado_em": _now() if avisado else None,
        "cliente_avisado_por_nome": (payload.get("nome") or "") if avisado else None,
    }
    try:
        res = (
            supabase.table("ordens").update(atualizacao)
            .eq("id", ordem_id).eq("oficina_doc", oficina_doc).execute()
        )
    except APIError as e:
        if getattr(e, "code", None) in ("42703", "PGRST204") and "cliente_avisado" in str(getattr(e, "message", "")):
            return Response({"detail": "A marcação de cliente avisado ainda não existe no banco. "
                                       "Rode backend/sql/alertas.sql no SQL Editor do Supabase."},
                            status=http_status.HTTP_503_SERVICE_UNAVAILABLE)
        raise
    return Response(res.data[0] if res.data else row)
