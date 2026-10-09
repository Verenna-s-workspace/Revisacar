"""
Visão Geral (a primeira tela do painel). Antes o frontend baixava todas as
ordens e inventava os números (faturamento = nº de OS finalizadas × R$ 480,
custos/lucro sempre 0, meta fixa em R$ 20.000). Agora o servidor calcula.

Rotas:
  GET /visao-geral[?tz=America/Sao_Paulo]   qualquer usuário logado
  PUT /visao-geral/meta  {"valor": 20000|null}   configuracoes.editar

Cada bloco de DINHEIRO só vem pra quem pode ver (o resto da resposta vem
pra todos, inclusive mecânico e atendente):
  faturamento, meta, serie[].faturamento, servicos[].valorEstimado
      → relatorios.ver ou financeiro.ver (dono e gerente)
  financeiro (receitas/despesas)           → financeiro.ver
  financeiro.lucro*                        → financeiro.ver_margem (só o dono)
O frontend decide o que desenhar pela PRESENÇA do bloco, não por cargo.

Períodos (no fuso `tz`, padrão America/Sao_Paulo): "mês" = do dia 1 até hoje,
comparado com o MESMO trecho do mês anterior (dia 1 até o mesmo dia; antes
comparava o mês parcial com o mês anterior inteiro). `serie` são os últimos
31 dias, um item por dia (inclusive os vazios; o frontend recorta 7/30 dias
ou o mês); `servicos` são as OS finalizadas dos últimos 30 dias, com a distribuição por dia da semana
(índice 0 = segunda … 6 = domingo).

Faturamento: igual ao dos Relatórios — entradas do Financeiro quando a
oficina usa o Financeiro, senão estimativa por OS finalizada.
"""
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import relatorios_views as rel
from .serializers import MetaMensalSerializer
from .views import supabase, require_auth, require_permission, _oficina_doc_do_token

logger = logging.getLogger(__name__)

# 31 dias: "este mês" no dia 31 precisa do dia 1, que fica a 30 dias de hoje.
DIAS_DA_SERIE = 31
DIAS_DOS_SERVICOS = 30
LIMITE_SERVICOS = 10
# Preço de um serviço fora da tabela estimada (era o valor que a tela já usava).
PRECO_SERVICO_DESCONHECIDO = 200


def _agora(tz) -> datetime:
    """Existe só pra os testes fixarem "hoje"."""
    return datetime.now(tz)


def _periodos(hoje: date):
    mes = (hoje.replace(day=1), hoje)
    ultimo_mes_anterior = mes[0] - timedelta(days=1)
    ini_ant = ultimo_mes_anterior.replace(day=1)
    fim_ant = ini_ant + timedelta(days=min(hoje.day, ultimo_mes_anterior.day) - 1)
    return mes, (ini_ant, fim_ant)


def _dentro(dia: date, periodo) -> bool:
    return periodo[0] <= dia <= periodo[1]


def _ler_tz(request):
    nome = request.query_params.get("tz") or rel.TZ_PADRAO
    try:
        return ZoneInfo(nome)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return None


def _meta_da_oficina(oficina_doc):
    """(valor|None, coluna_existe). Sem `admins.meta_mensal` (visao_geral.sql
    não rodado) a tela segue funcionando, só sem meta editável."""
    try:
        linhas = (
            supabase.table("admins").select("meta_mensal")
            .eq("doc", oficina_doc).limit(1).execute().data
        )
    except APIError as e:
        if getattr(e, "code", None) in ("42703", "PGRST204"):
            logger.warning("Visão Geral: admins.meta_mensal ausente; rode visao_geral.sql.")
            return None, False
        raise
    valor = linhas[0].get("meta_mensal") if linhas else None
    return (float(valor) if valor is not None else None), True


def _variacao(atual: float, anterior: float):
    if anterior == 0:
        return None
    return round((atual - anterior) / abs(anterior) * 100, 1)


@api_view(["GET"])
@require_auth
@rel._tratar_erros_banco
def visao_geral(request):
    tz = _ler_tz(request)
    if tz is None:
        return Response({"detail": f"Fuso horário desconhecido: '{request.query_params.get('tz')}'."},
                        status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    permissoes = request.admin.get("permissoes", [])
    pode_fat = "relatorios.ver" in permissoes or "financeiro.ver" in permissoes
    pode_fin = "financeiro.ver" in permissoes
    ve_margem = "financeiro.ver_margem" in permissoes
    oficina_doc = _oficina_doc_do_token(request.admin)

    hoje = _agora(tz).date()
    mes, anterior = _periodos(hoje)
    ini_serie = hoje - timedelta(days=DIAS_DA_SERIE - 1)
    ini_servicos = hoje - timedelta(days=DIAS_DOS_SERVICOS - 1)
    janela_ini = min(anterior[0], ini_serie)

    usa_financeiro = rel._usa_financeiro(oficina_doc) if pode_fat else False
    entradas = saidas = []
    if (pode_fat and usa_financeiro) or pode_fin:
        entradas = rel._buscar_lancamentos(oficina_doc, "entrada", janela_ini, hoje)
    if pode_fin:
        saidas = rel._buscar_lancamentos(oficina_doc, "saida", janela_ini, hoje)

    dias: dict[date, dict] = defaultdict(lambda: {"ordens": 0, "faturamento": 0.0})
    servicos: dict[str, dict] = {}

    for ordem in rel._buscar_ordens(oficina_doc, janela_ini, hoje):
        dia = rel._dia_da_ordem(ordem.get("created_at"), tz)
        if dia is None or not (janela_ini <= dia <= hoje):
            continue
        dias[dia]["ordens"] += 1
        if ordem.get("status") != "finalizada":
            continue
        nomes = rel._servicos_da_ordem(ordem.get("payload"))
        if pode_fat and not usa_financeiro:
            dias[dia]["faturamento"] += rel._valor_estimado(nomes)
        if dia >= ini_servicos:
            for nome in nomes:
                s = servicos.setdefault(nome, {"quantidade": 0, "semana": [0] * 7})
                s["quantidade"] += 1
                s["semana"][dia.weekday()] += 1

    if pode_fat and usa_financeiro:
        for e in entradas:
            dia = _dia_lancamento(e)
            if dia is not None:
                dias[dia]["faturamento"] += float(e["valor"])

    def soma_ordens(periodo):
        return sum(v["ordens"] for d, v in dias.items() if _dentro(d, periodo))

    def soma_fat(periodo):
        return round(sum(v["faturamento"] for d, v in dias.items() if _dentro(d, periodo)), 2)

    ordens_mes, ordens_ant = soma_ordens(mes), soma_ordens(anterior)
    tem_anterior = ordens_ant > 0   # sem OS no período anterior não há com o que comparar

    resposta = {
        "hoje": hoje.isoformat(),
        "periodo": {
            "de": mes[0].isoformat(), "ate": mes[1].isoformat(),
            "deAnterior": anterior[0].isoformat(), "ateAnterior": anterior[1].isoformat(),
            "tz": request.query_params.get("tz") or rel.TZ_PADRAO,
        },
        "ordens": {"atual": ordens_mes, "anterior": ordens_ant if tem_anterior else None},
    }

    serie = []
    for i in range(DIAS_DA_SERIE):
        dia = ini_serie + timedelta(days=i)
        item = {"dia": dia.isoformat(), "ordens": dias[dia]["ordens"] if dia in dias else 0}
        if pode_fat:
            item["faturamento"] = round(dias[dia]["faturamento"], 2) if dia in dias else 0.0
        serie.append(item)
    resposta["serie"] = serie

    lista_servicos = []
    for nome, s in servicos.items():
        item = {"nome": nome, "quantidade": s["quantidade"], "semana": s["semana"]}
        if pode_fat:
            item["valorEstimado"] = float(
                s["quantidade"] * rel.PRECO_ESTIMADO_POR_SERVICO.get(nome, PRECO_SERVICO_DESCONHECIDO)
            )
        lista_servicos.append(item)
    lista_servicos.sort(key=lambda s: (-s.get("valorEstimado", s["quantidade"]), -s["quantidade"], s["nome"]))
    resposta["servicos"] = lista_servicos[:LIMITE_SERVICOS]

    if pode_fat:
        fat_ant = soma_fat(anterior)
        resposta["faturamento"] = {
            "atual": soma_fat(mes),
            "anterior": fat_ant if tem_anterior else None,
            "origem": "financeiro" if usa_financeiro else "estimado",
        }
        meta, coluna_existe = _meta_da_oficina(oficina_doc)
        resposta["meta"] = {
            "valor": meta,
            "editavel": coluna_existe and "configuracoes.editar" in permissoes,
        }

    if pode_fin:
        def total(linhas, periodo):
            return round(sum(
                float(l["valor"]) for l in linhas
                if (d := _dia_lancamento(l)) is not None and _dentro(d, periodo)
            ), 2)

        receitas, despesas = total(entradas, mes), total(saidas, mes)
        receitas_ant, despesas_ant = total(entradas, anterior), total(saidas, anterior)
        bloco = {
            "receitas": receitas,
            "despesas": despesas,
            # Sem nenhum lançamento a tela mostra "lance no Financeiro" em vez de zeros.
            "temLancamentos": bool(receitas or despesas or receitas_ant or despesas_ant),
        }
        if ve_margem:
            lucro, lucro_ant = round(receitas - despesas, 2), round(receitas_ant - despesas_ant, 2)
            bloco["lucro"] = lucro
            if receitas_ant or despesas_ant:
                bloco["lucroAnterior"] = lucro_ant
                variacao = _variacao(lucro, lucro_ant)
                if variacao is not None:
                    bloco["lucroVariacaoPercentual"] = variacao
        resposta["financeiro"] = bloco

    return Response(resposta)


def _dia_lancamento(linha):
    try:
        return date.fromisoformat(str(linha["data_competencia"])[:10])
    except (ValueError, TypeError, KeyError):
        return None


@api_view(["PUT"])
@require_permission("configuracoes.editar")
def meta_mensal(request):
    """PUT /visao-geral/meta {"valor": 20000} — define a meta; {"valor": null} remove."""
    serializer = MetaMensalSerializer(data=request.data if isinstance(request.data, dict) else {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    valor = serializer.validated_data["valor"]
    if valor is not None:
        valor = round(valor, 2)

    try:
        res = (
            supabase.table("admins").update({"meta_mensal": valor})
            .eq("doc", _oficina_doc_do_token(request.admin)).execute()
        )
    except APIError as e:
        if getattr(e, "code", None) in ("42703", "PGRST204"):
            return Response(
                {"detail": "A meta mensal ainda não existe no banco. "
                           "Rode backend/sql/visao_geral.sql no SQL Editor do Supabase."},
                status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if getattr(e, "code", None) == "42501":
            return Response(
                {"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        logger.exception("Visão Geral: erro ao salvar meta (%s)", getattr(e, "code", None))
        return Response({"detail": "Erro ao acessar o banco de dados."},
                        status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    if not res.data:
        return Response({"detail": "Oficina não encontrada"}, status=http_status.HTTP_404_NOT_FOUND)
    return Response({"valor": valor})
