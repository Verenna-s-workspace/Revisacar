"""
Execução e fechamento da OS (Fase 5 do orçamento).

Rotas:
  POST /ordens/<id>/concluir   {observacao?, ignorarFaltas?}   (ordens.editar)
       Conclui o serviço: status → 'finalizada' e BAIXA DO ESTOQUE o que a OS tinha
       reservado (movimento 'saida' por item), tudo na mesma transação
       (função `ordem_concluir`, ver sql/ordens_execucao.sql).
       Falta de peça física → 409 `estoque_insuficiente` com a lista de `faltas` e NADA muda;
       reenviar com `ignorarFaltas: true` baixa só o que existe (estoque nunca fica negativo)
       e informa o que faltou em `baixas[].faltou`.
  GET  /ordens/<id>/fechamento                                  (ordens.ver)
       Resumo da etapa 4 (opcional): orçamento aprovado (preço cobrado), reservas pendentes
       (com o que falta), baixas já feitas e, pra quem tem `financeiro.ver`, os lançamentos
       da OS no Financeiro.

  GET  /ordens/<id>/pdf-concluida                               (ordens.ver)
       PDF (application/pdf) do relatório final da OS, em uma página. SÓ existe para OS finalizada:
       qualquer outro status → 409 `os_nao_finalizada`. Gerado na hora (sempre com a hora de emissão
       do momento e os dados atuais); nada é guardado. Mostra só o preço cobrado (nunca custo/margem).

`PATCH /ordens/<id>/status` com 'finalizada' passa pelo mesmo caminho (sem observação, sem
ignorar faltas), então não existe forma de concluir sem baixar o estoque.

Concluir NÃO recebe pagamento: os lançamentos pendentes do Financeiro continuam pendentes.
"""
import logging
import re
from decimal import Decimal

from django.http import HttpResponse
from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import fotos_obrigatorias, os_concluida_pdf
from . import ordem_status as os_status
from .estoque_views import _corpo_valido, _jsonb, _negado, _nao_encontrado, _num
from .oficina_config_views import COLUNA_AUSENTE, config_para_api
from .orcamento_views import (
    _assinatura_guardada, _centavos, _itens_de, _payload_da_ordem, _tratar_erros_banco, _ver_margem,
    orcamento_para_api,
)
from .serializers import ConclusaoOrdemSerializer
from .views import supabase, require_auth, _oficina_doc_do_token, _now

logger = logging.getLogger(__name__)

TAMANHO_LOTE_IDS = 100
SCRIPT_AUSENTE = {"42883", "PGRST202", "42703", "PGRST204"}


def _precisa_do_script(view_func):
    """Função/coluna da Fase 5 ausente = ordens_execucao.sql não foi rodado → 503 com a instrução."""
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            mensagem = str(getattr(e, "message", "") or "")
            if codigo in SCRIPT_AUSENTE and "oficina_doc" not in mensagem:
                logger.error("Fechamento: objeto da Fase 5 ausente (%s): %s", codigo, mensagem)
                return Response(
                    {"detail": "A conclusão de OS ainda não existe no banco. "
                               "Rode backend/sql/ordens_execucao.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            raise
    wrapper.__name__ = view_func.__name__
    return wrapper


def _falha(resultado: dict) -> Response:
    codigo = resultado.get("codigo")
    corpo = {"detail": resultado.get("mensagem") or "Não foi possível concluir a OS.", "codigo": codigo}
    if codigo == "nao_encontrado":
        return Response(corpo, status=http_status.HTTP_404_NOT_FOUND)
    if codigo == "os_status":
        corpo["osStatus"] = resultado.get("os_status")
    if codigo == "estoque_insuficiente":
        corpo["faltas"] = [
            {"itemId": str(f["item_id"]), "nome": f["nome"],
             "necessario": _num(f["necessario"]), "disponivel": _num(f["disponivel"])}
            for f in resultado.get("faltas") or []
        ]
    return Response(corpo, status=http_status.HTTP_409_CONFLICT)


def baixas_para_api(baixas) -> list:
    return [
        {"itemId": str(b["item_id"]), "nome": b["nome"], "reservado": _num(b["reservado"]),
         "baixado": _num(b["baixado"]), "faltou": _num(b["faltou"])}
        for b in baixas or []
    ]


def chamar_conclusao(request, ordem_id: str, oficina_doc: str, observacao: str = "", ignorar_faltas: bool = False,
                     cliente=None):
    """Roda `ordem_concluir`. Devolve (resultado_ok | None, resposta_de_falha | None).
    `cliente`: o client do Supabase de quem chama (PATCH /status usa o do módulo views)."""
    resultado = _jsonb((cliente or supabase).rpc("ordem_concluir", {
        "p_oficina_doc": oficina_doc,
        "p_ordem_id": ordem_id,
        # `origens_para` inclui o próprio destino; aqui não: concluir de novo não é permitido.
        "p_os_permitidos": [s for s in os_status.origens_para(os_status.FINALIZADA) if s != os_status.FINALIZADA],
        "p_os_novo": os_status.FINALIZADA,
        "p_ignorar_faltas": bool(ignorar_faltas),
        "p_obs": observacao or "",
        "p_nome": request.admin.get("nome", ""),
        "p_agora": _now(),
    }).execute().data)
    if not resultado["ok"]:
        return None, _falha(resultado)
    return resultado, None


# ── Resumo (etapa 4) ──────────────────────────────────────────────────────────

def _em_lotes(ids: list):
    for i in range(0, len(ids), TAMANHO_LOTE_IDS):
        yield ids[i:i + TAMANHO_LOTE_IDS]


def _itens_estoque(oficina_doc: str, ids: list) -> dict:
    por_id = {}
    for lote in _em_lotes(sorted(set(ids))):
        for l in supabase.table("estoque_itens").select("id,nome,quantidade").eq("oficina_doc", oficina_doc) \
                .in_("id", lote).execute().data or []:
            por_id[str(l["id"])] = l
    return por_id


def resumo_do_fechamento(request, oficina_doc: str, ordem: dict) -> dict:
    ordem_id = ordem["id"]
    permissoes = request.admin.get("permissoes", [])
    out = {
        "ordemId": ordem_id,
        "osNum": ordem.get("os_num") or ordem_id,
        "osStatus": ordem.get("status") or os_status.RASCUNHO,
    }
    for chave, coluna in (("concluidaEm", "concluida_em"), ("concluidaPorNome", "concluida_por_nome"),
                          ("obsConclusao", "obs_conclusao")):
        if ordem.get(coluna):
            out[chave] = ordem[coluna]

    aprovado = supabase.table("orcamentos").select("*").eq("oficina_doc", oficina_doc) \
        .eq("ordem_id", ordem_id).eq("status", "aprovado").order("versao", desc=True).limit(1).execute().data
    out["orcamento"] = None
    if aprovado:
        itens = _itens_de([str(aprovado[0]["id"])]).get(str(aprovado[0]["id"]), [])
        out["orcamento"] = orcamento_para_api(aprovado[0], itens, _ver_margem(request))

    reservas = supabase.table("estoque_reservas").select("item_id,quantidade").eq("oficina_doc", oficina_doc) \
        .eq("ordem_id", ordem_id).execute().data or []
    movimentos = supabase.table("estoque_movimentos").select("item_id,quantidade,criado_em") \
        .eq("oficina_doc", oficina_doc).eq("ordem_servico_id", ordem_id).eq("tipo", "saida") \
        .order("criado_em").execute().data or []
    nomes = _itens_estoque(oficina_doc, [str(r["item_id"]) for r in reservas] + [str(m["item_id"]) for m in movimentos])

    out["reservas"] = []
    for r in reservas:
        item = nomes.get(str(r["item_id"]))
        if item is None:
            continue
        reservado, fisico = float(r["quantidade"]), float(item["quantidade"])
        out["reservas"].append({
            "itemId": str(r["item_id"]), "nome": item["nome"], "reservado": _num(reservado),
            "disponivel": _num(fisico), "falta": reservado > fisico,
        })
    out["reservas"].sort(key=lambda r: r["nome"])

    baixas = {}
    for m in movimentos:
        chave = str(m["item_id"])
        item = nomes.get(chave)
        if item is None:
            continue
        b = baixas.setdefault(chave, {"itemId": chave, "nome": item["nome"], "quantidade": 0.0, "criadoEm": m["criado_em"]})
        b["quantidade"] += float(m["quantidade"])
    out["baixas"] = sorted(({**b, "quantidade": _num(b["quantidade"])} for b in baixas.values()), key=lambda b: b["nome"])

    if "financeiro.ver" in permissoes:
        lancs = supabase.table("financeiro_transacoes") \
            .select("id,categoria,descricao,valor,status,forma_pagamento,data_pagamento,origem") \
            .eq("oficina_doc", oficina_doc).eq("ordem_servico_id", ordem_id).neq("status", "cancelado") \
            .order("categoria").order("id").execute().data or []
        out["financeiro"] = [{
            "id": str(l["id"]), "categoria": l["categoria"], "descricao": l.get("descricao") or "",
            "valor": _num(l["valor"]), "status": l["status"],
            **({"formaPagamento": l["forma_pagamento"]} if l.get("forma_pagamento") else {}),
            **({"dataPagamento": l["data_pagamento"]} if l.get("data_pagamento") else {}),
        } for l in lancs]
    return out


def _ordem(oficina_doc: str, ordem_id: str):
    res = supabase.table("ordens").select("*").eq("id", ordem_id).eq("oficina_doc", oficina_doc).limit(1).execute()
    return res.data[0] if res.data else None


# ── Relatório final (PDF) ─────────────────────────────────────────────────────

def _dados_oficina(oficina_doc: str) -> dict:
    try:
        linhas = supabase.table("admins").select("nome,doc,config_oficina").eq("doc", oficina_doc).limit(1).execute().data
    except APIError as e:
        if getattr(e, "code", None) not in COLUNA_AUSENTE:
            raise
        linhas = supabase.table("admins").select("nome,doc").eq("doc", oficina_doc).limit(1).execute().data
    return config_para_api(linhas[0] if linhas else {})


def _fotos_do_relatorio(oficina_doc: str, ordem_id: str) -> list:
    """Os 5 itens obrigatórios, na ordem fixa, com a situação de cada um (foto / pulada com motivo / pendente)."""
    try:
        linhas = fotos_obrigatorias._linhas(supabase, oficina_doc, ordem_id)
    except APIError as e:
        if getattr(e, "code", None) not in fotos_obrigatorias.TABELA_AUSENTE:
            raise
        linhas = {}
    return [{"rotulo": i["rotulo"], "situacao": i["situacao"], "motivo": i.get("motivo") or ""}
            for i in fotos_obrigatorias.resumo(linhas)["itens"]]


def dados_do_relatorio_final(oficina_doc: str, ordem: dict) -> dict:
    """Monta SÓ o que o cliente pode ver. Custo, margem e vínculos internos não entram."""
    ordem_id = ordem["id"]
    payload = _payload_da_ordem(ordem)
    cabecalho = payload.get("os_header") or {}
    cliente, veiculo = payload.get("cliente") or {}, payload.get("veiculo") or {}
    tecnico = payload.get("tecnico") if isinstance(payload.get("tecnico"), dict) else {}

    aprovado = supabase.table("orcamentos").select("*").eq("oficina_doc", oficina_doc) \
        .eq("ordem_id", ordem_id).eq("status", "aprovado").order("versao", desc=True).limit(1).execute().data
    itens, aprovacao, assinatura = [], None, None
    if aprovado:
        orc = aprovado[0]
        brutos = _itens_de([str(orc["id"])]).get(str(orc["id"]), [])
        itens = [{
            "tipo": i["tipo"], "descricao": i["descricao"], "marca": i.get("marca") or "",
            "quantidade": i["quantidade"], "preco_unitario": i["preco_unitario"],
            "subtotal": _centavos(Decimal(str(i["quantidade"])) * Decimal(str(i["preco_unitario"]))),
            "motivo": i.get("motivo") or "",
        } for i in brutos]
        if orc.get("aprovado_em"):
            aprovacao = {"em": orc["aprovado_em"], "canal": orc.get("aprovacao_canal"),
                         "obs": orc.get("aprovacao_obs") or "", "versao": orc.get("versao")}
        assinatura = _assinatura_guardada(orc)

    extras = ordem.get("fotos_paths") or payload.get("fotos_paths") or []
    return {
        "oficina": _dados_oficina(oficina_doc),
        "os_num": ordem.get("os_num") or ordem_id,
        "emitido_em": _now(),
        "concluida_em": ordem.get("concluida_em"),
        "concluida_por": ordem.get("concluida_por_nome") or "",
        "obs_conclusao": ordem.get("obs_conclusao") or "",
        "cliente": {k: cliente.get(k, "") for k in ("nome", "doc", "tel", "email")},
        "veiculo": {
            **{k: veiculo.get(k, "") for k in ("placa", "modelo", "ano", "cor", "chassi", "combustivel",
                                               "nivel_combustivel")},
            "km_entrada": cabecalho.get("os_km", ""), "km_saida": tecnico.get("km_saida", ""),
        },
        "tecnico": {"nome": tecnico.get("nome", ""), "registro": tecnico.get("registro", "")},
        "entrada": {"data": cabecalho.get("os_date", ""), "hora": cabecalho.get("os_time", "")},
        "saida": {"data": tecnico.get("data_saida", ""), "hora": tecnico.get("hora_saida", "")},
        "fotos": _fotos_do_relatorio(oficina_doc, ordem_id),
        "fotos_extras": len(extras) if isinstance(extras, list) else 0,
        "parecer": tecnico.get("parecer_geral", ""),
        "itens": itens,
        "aprovacao": aprovacao,
        "assinatura_png": assinatura,
    }


# ── Rotas ─────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@require_auth
@_precisa_do_script
@_tratar_erros_banco
def ordem_concluir(request, ordem_id):
    """POST /ordens/<id>/concluir  {observacao?, ignorarFaltas?}"""
    negado = _negado(request, "ordens.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    dados = request.data if _corpo_valido(request) else {}
    serializer = ConclusaoOrdemSerializer(data=dados)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    resultado, falha = chamar_conclusao(
        request, ordem_id, oficina_doc,
        observacao=(serializer.validated_data.get("observacao") or "").strip(),
        ignorar_faltas=serializer.validated_data.get("ignorarFaltas", False),
    )
    if falha:
        return falha
    ordem = _ordem(oficina_doc, ordem_id)
    corpo = resumo_do_fechamento(request, oficina_doc, ordem)
    corpo["baixasFeitas"] = baixas_para_api(resultado.get("baixas"))
    return Response(corpo)


@api_view(["GET"])
@require_auth
@_tratar_erros_banco
def fechamento(request, ordem_id):
    """GET /ordens/<id>/fechamento — resumo da etapa 4."""
    negado = _negado(request, "ordens.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    ordem = _ordem(oficina_doc, ordem_id)
    if ordem is None:
        return _nao_encontrado("OS não encontrada.")
    return Response(resumo_do_fechamento(request, oficina_doc, ordem))


@api_view(["GET"])
@require_auth
@_tratar_erros_banco
def ordem_pdf_concluida(request, ordem_id):
    """GET /ordens/<id>/pdf-concluida — relatório final da OS (application/pdf), só para OS finalizada."""
    negado = _negado(request, "ordens.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    ordem = _ordem(oficina_doc, ordem_id)
    if ordem is None:
        return _nao_encontrado("OS não encontrada.")
    if ordem.get("status") != os_status.FINALIZADA:
        return Response(
            {"detail": "A OS precisa estar finalizada para gerar este documento.",
             "codigo": "os_nao_finalizada", "osStatus": ordem.get("status")},
            status=http_status.HTTP_409_CONFLICT,
        )
    conteudo = os_concluida_pdf.gerar_pdf(dados_do_relatorio_final(oficina_doc, ordem))
    resposta = HttpResponse(conteudo, content_type="application/pdf")
    nome = re.sub(r"[^\w-]+", "_", str(ordem.get("os_num") or ordem_id))
    resposta["Content-Disposition"] = f'inline; filename="os-concluida-{nome}.pdf"'
    resposta["Cache-Control"] = "private, no-store"
    return resposta
