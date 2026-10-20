"""
Alertas da oficina — dados que o frontend não consegue montar sozinho.

Rotas:
  GET   /alertas                         (qualquer usuário logado; cada bloco exige a sua permissão)
        Devolve só os DADOS (o texto e a urgência de cada alerta são da tela). Blocos:
          orcamentosSemResposta  (ordens.ver)   orçamento ENVIADO vencido ou sem resposta há ≥ 2 dias
          aprovadasParadas       (ordens.ver)   OS aprovada que não começou a execução há ≥ 1 dia
          reservasSemEstoque     (estoque.ver)  item cuja soma reservada nas OS passa do que há em estoque
          semPagamento           (financeiro.ver) OS concluída há ≥ 1 dia com lançamento de entrada pendente
          respostasDoCliente     (ordens.ver)   o cliente aprovou/recusou PELO LINK nos últimos 3 dias e a OS
                                                ainda está no estado da resposta (aprovada / recusada)
          (orcamentosSemResposta também diz se há link ativo e quando o cliente abriu pela 1ª vez)
        Bloco sem permissão NÃO vem na resposta (≠ vazio). Bloco cuja tabela ainda não existe
        (script não rodado) vem vazio e o nome entra em `indisponiveis`.
        `?tz=` define o "hoje" (padrão America/Sao_Paulo), como no resto do app.
  PATCH /ordens/<id>/cliente-avisado     {avisado: bool}   (ordens.editar OU ordens.criar)
        Grava no banco que o cliente foi (ou não) avisado — antes ficava só no navegador.
        Quem avisa o cliente costuma ser o atendente, que não tem ordens.editar, por isso as duas.

Adiar / dispensar (por USUÁRIO — o que um esconde continua aparecendo pros outros; qualquer logado):
  GET    /alertas                        também traz `dispensados`: [{alertaId, ate, criadoEm}] do usuário
                                         (`ate` = adiado até lá; null = dispensado). Adiados já vencidos não vêm.
  PUT    /alertas/dispensados/<alertaId> {modo: "adiar", dias: 1..30} | {modo: "dispensar"}
  DELETE /alertas/dispensados/<alertaId> volta a mostrar (204, repetir é inofensivo)
  POST   /alertas/dispensados/limpar     {ids: [...]}  apaga só os DISPENSADOS (ate nulo) cujo alerta
                                         já se resolveu — a tela chama isso, pra que, se o problema
                                         voltar, o alerta volte a aparecer. Adiados vencem sozinhos.
  `alertaId` é o id estável da tela: "<fonte>:<id do objeto>" (ex.: estoque_baixo:<uuid>).

Os limites (em dias) estão em LIMITES e voltam na resposta, pra tela e a regra nunca divergirem.
"""
import logging
import re
from datetime import datetime, timedelta, timezone

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import visao_geral_views as vg
from .estoque_views import _listar_todos, _num
from .serializers import AlertaDispensarSerializer, AlertaLimparSerializer, ClienteAvisadoSerializer
from .views import supabase, require_auth, _get_ordem_or_404, _now, _oficina_doc_do_token, _ordens_precisam_do_sql, _require_auth

logger = logging.getLogger(__name__)

LIMITES = {
    "orcamentoSemRespostaDias": 2,
    "aprovadaParadaDias": 1,
    "semPagamentoDias": 1,
    "respostaClienteDias": 3,
}

LOTE_IDS = 100
MAX_DIAS_ADIAR = 30
MAX_IDS_LIMPAR = 200
# Mesmos ids de fonte de frontend/src/utils/alertas.ts (FonteAlertaId).
FONTES_ALERTA = (
    "os_bloqueada", "reserva_sem_estoque", "estoque_baixo", "os_sem_pagamento",
    "orcamento_sem_resposta", "cliente_nao_avisado", "os_aprovada_parada", "estoque_quarentena",
)
_ALERTA_ID = re.compile(r"^(" + "|".join(FONTES_ALERTA) + r"):[A-Za-z0-9_.\-]{1,80}$")
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


def _usuario_chave(payload: dict) -> str:
    """Quem é o usuário do token, pra guardar o que ele escondeu. O dono não tem id
    (é a própria oficina); funcionário tem `id` (cai pro e-mail/nome se faltar)."""
    if payload.get("tipo") == "dono":
        return "dono"
    return f"func:{payload.get('id') or payload.get('email') or payload.get('nome') or ''}"


def _dispensados(oficina_doc, usuario, agora) -> list:
    """O que este usuário escondeu e ainda vale: dispensados e adiados não vencidos."""
    linhas = _listar_todos(lambda: (
        supabase.table("alertas_dispensados").select("*")
        .eq("oficina_doc", oficina_doc).eq("usuario_chave", usuario).order("alerta_id")
    ))
    saida = []
    for l in linhas:
        ate = l.get("ate")
        if ate is not None and (_dt(ate) is None or _dt(ate) <= agora):
            continue
        saida.append({"alertaId": l["alerta_id"], "ate": ate, "criadoEm": l.get("criado_em")})
    return saida


# ── blocos ───────────────────────────────────────────────────────────────────

def _orcamentos_sem_resposta(oficina_doc, agora, hoje) -> list:
    orcs = _listar_todos(lambda: (
        supabase.table("orcamentos").select("*")
        .eq("oficina_doc", oficina_doc).eq("status", "enviado").order("id")
    ))
    ordens = _ordens_por_id(oficina_doc, [o["ordem_id"] for o in orcs])
    saida = []
    candidatos = []
    for o in orcs:
        ordem = ordens.get(o["ordem_id"])
        if not ordem:
            continue
        dias = _dias(o.get("enviado_em"), agora)
        vencido = bool(o.get("validade_ate")) and str(o["validade_ate"]) < hoje.isoformat()
        if not vencido and dias < LIMITES["orcamentoSemRespostaDias"]:
            continue
        candidatos.append((o, ordem, dias, vencido))
    links = _links_ativos(oficina_doc, [str(o["id"]) for o, *_ in candidatos])
    for o, ordem, dias, vencido in candidatos:
        item = {
            **_identificacao(ordem), "orcamentoId": str(o["id"]), "versao": o["versao"],
            "total": _num(o["total"]), "enviadoEm": o.get("enviado_em"),
            "validadeAte": o.get("validade_ate"), "vencido": vencido, "dias": dias,
        }
        link = links.get(str(o["id"]))
        if link:
            item["linkEnviado"] = True
            item["linkAcessos"] = link.get("acessos") or 0
            if link.get("primeiro_acesso_em"):
                item["linkAbertoEm"] = link["primeiro_acesso_em"]
        saida.append(item)
    # Vencidos primeiro; dentro de cada grupo, o mais antigo primeiro.
    saida.sort(key=lambda a: (not a["vencido"], -a["dias"]))
    return saida


def _links_ativos(oficina_doc, orcamento_ids) -> dict:
    """{orcamento_id: link ativo} (Fase 6). Sem a tabela (orcamento_link.sql não rodado) = sem links:
    quem avisa que falta o script é o bloco `respostasDoCliente`."""
    if not orcamento_ids:
        return {}
    try:
        por_orc = {}
        for lote in _em_lotes(orcamento_ids):
            for l in (
                supabase.table("orcamento_links").select("*")
                .eq("oficina_doc", oficina_doc).in_("orcamento_id", lote).execute().data or []
            ):
                if not l.get("revogado_em"):
                    por_orc[str(l["orcamento_id"])] = l
        return por_orc
    except APIError as e:
        if getattr(e, "code", None) in OBJETO_INEXISTENTE:
            return {}
        raise


def _respostas_do_cliente(oficina_doc, agora) -> list:
    """Aprovações/recusas feitas pelo cliente no link, ainda "frescas" e ainda no estado da resposta
    (some quando a OS segue em frente: começa a execução, é refeita…)."""
    desde = (agora - timedelta(days=LIMITES["respostaClienteDias"])).isoformat()
    links = _listar_todos(lambda: (
        supabase.table("orcamento_links").select("*")
        .eq("oficina_doc", oficina_doc).gte("decidido_em", desde).order("id")
    ))
    links = [l for l in links if l.get("decidido_em") and l.get("decisao")]
    if not links:
        return []
    orcs = {}
    for lote in _em_lotes([str(l["orcamento_id"]) for l in links]):
        for o in (
            supabase.table("orcamentos").select("*").eq("oficina_doc", oficina_doc).in_("id", lote).execute().data or []
        ):
            orcs[str(o["id"])] = o
    ordens = _ordens_por_id(oficina_doc, [o["ordem_id"] for o in orcs.values()])
    esperado = {"aprovado": "aprovada", "recusado": "recusada"}
    saida = []
    for l in links:
        orc = orcs.get(str(l["orcamento_id"]))
        ordem = ordens.get(orc["ordem_id"]) if orc else None
        if not ordem or ordem.get("status") != esperado.get(l["decisao"]):
            continue
        saida.append({
            **_identificacao(ordem), "orcamentoId": str(orc["id"]), "versao": orc["versao"], "total": _num(orc["total"]),
            "decisao": l["decisao"], "decididoEm": l["decidido_em"], "decisaoNome": l.get("decisao_nome") or "",
            "motivo": (orc.get("motivo_recusa") or "") if l["decisao"] == "recusado" else "",
        })
    saida.sort(key=lambda a: a["decididoEm"], reverse=True)
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
        ("respostasDoCliente", "orcamento_link", "ordens.ver", lambda: _respostas_do_cliente(oficina_doc, agora)),
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
    try:
        corpo["dispensados"] = _dispensados(oficina_doc, _usuario_chave(request.admin), agora)
    except APIError as e:
        if getattr(e, "code", None) not in OBJETO_INEXISTENTE:
            raise
        logger.error("Alertas: alertas_dispensados indisponível (%s): %s", e.code, getattr(e, "message", e))
        corpo["dispensados"] = []
        indisponiveis.append("alertas_dispensados")
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


# ── adiar / dispensar ────────────────────────────────────────────────────────

def _resposta_sem_tabela(e):
    """503 com a instrução, se a tabela (alertas.sql) ainda não existe; senão None."""
    if getattr(e, "code", None) in OBJETO_INEXISTENTE:
        logger.error("Alertas: alertas_dispensados ausente (%s): %s", e.code, getattr(e, "message", e))
        return Response({"detail": "Adiar e dispensar alertas ainda não existe no banco. "
                                   "Rode backend/sql/alertas.sql no SQL Editor do Supabase."},
                        status=http_status.HTTP_503_SERVICE_UNAVAILABLE)
    return None


def _alerta_id_invalido(alerta_id):
    if _ALERTA_ID.match(alerta_id or ""):
        return None
    return Response({"detail": "Alerta inválido."}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)


@api_view(["PUT", "DELETE"])
@require_auth
def alerta_dispensado(request, alerta_id):
    erro = _alerta_id_invalido(alerta_id)
    if erro:
        return erro
    oficina_doc = _oficina_doc_do_token(request.admin)
    usuario = _usuario_chave(request.admin)
    tabela = lambda: supabase.table("alertas_dispensados")  # noqa: E731

    try:
        if request.method == "DELETE":
            (tabela().delete().eq("oficina_doc", oficina_doc).eq("usuario_chave", usuario)
             .eq("alerta_id", alerta_id).execute())
            return Response(status=http_status.HTTP_204_NO_CONTENT)

        serializer = AlertaDispensarSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
        dados = serializer.validated_data
        agora = vg._agora(timezone.utc)   # mesmo relógio do GET (os testes o fixam)
        ate = (agora + timedelta(days=dados["dias"])).isoformat() if dados["modo"] == "adiar" else None
        # Adiados que já venceram não servem mais pra nada: limpa de passagem.
        (tabela().delete().eq("oficina_doc", oficina_doc).eq("usuario_chave", usuario)
         .lt("ate", agora.isoformat()).execute())
        res = tabela().upsert(
            {"oficina_doc": oficina_doc, "usuario_chave": usuario, "alerta_id": alerta_id,
             "ate": ate, "criado_em": agora.isoformat()},
            on_conflict="oficina_doc,usuario_chave,alerta_id",
        ).execute()
    except APIError as e:
        resposta = _resposta_sem_tabela(e)
        if resposta:
            return resposta
        raise
    linha = res.data[0]
    return Response({"alertaId": linha["alerta_id"], "ate": linha.get("ate"), "criadoEm": linha.get("criado_em")})


@api_view(["POST"])
@require_auth
def alertas_dispensados_limpar(request):
    serializer = AlertaLimparSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    ids = list(dict.fromkeys(serializer.validated_data["ids"]))
    for alerta_id in ids:
        erro = _alerta_id_invalido(alerta_id)
        if erro:
            return erro
    oficina_doc = _oficina_doc_do_token(request.admin)
    usuario = _usuario_chave(request.admin)
    if not ids:
        return Response({"removidos": []})
    apagados = []
    try:
        linhas = (
            supabase.table("alertas_dispensados").select("*")
            .eq("oficina_doc", oficina_doc).eq("usuario_chave", usuario).in_("alerta_id", ids).execute().data or []
        )
        alvo = [l["alerta_id"] for l in linhas if l.get("ate") is None]   # adiado vence sozinho
        if alvo:
            apagados = (
                supabase.table("alertas_dispensados").delete()
                .eq("oficina_doc", oficina_doc).eq("usuario_chave", usuario).in_("alerta_id", alvo).execute().data or []
            )
    except APIError as e:
        resposta = _resposta_sem_tabela(e)
        if resposta:
            return resposta
        raise
    return Response({"removidos": sorted(l["alerta_id"] for l in apagados)})
