"""
Relatórios. Antes o frontend baixava TODAS as ordens e calculava tudo no
navegador; agora o servidor agrega e devolve só o que a tela desenha.

Permissão (ver rbac.py):
  relatorios.ver → dono e gerente

Rota:
  GET /relatorios?de=YYYY-MM-DD&ate=YYYY-MM-DD
                 [&de_anterior=YYYY-MM-DD&ate_anterior=YYYY-MM-DD]
                 [&tz=America/Sao_Paulo]

  `de`/`ate` são o período atual (inclusive nas duas pontas); o par
  `*_anterior` é o período de comparação — quem decide qual é o "anterior"
  é a tela (este mês × mesmo trecho do mês passado, etc.). `tz` define em
  que fuso o "dia" de cada OS é contado (padrão: America/Sao_Paulo).

Resposta (camelCase):
  {
    "periodo": {de, ate, deAnterior, ateAnterior, tz},
    "faturamentoOrigem": "financeiro" | "estimado",
    "totais": {
      "atual":    {faturamento, ordens, finalizadas},
      "anterior": {…} | null       # null = sem nenhuma OS no período anterior
    },
    "dias": [{dia: "YYYY-MM-DD", ordens, finalizadas, faturamento}, …],
    "servicos": [{nome, quantidade}, …]   # OS finalizadas do período atual
  }
  `dias` é esparso (só dias com algum dado) e cobre os dois períodos; quem
  agrupa em semana/mês é o frontend.

De onde vem o faturamento:
  - "financeiro": soma das ENTRADAS lançadas no Financeiro (não canceladas,
    por data de competência — a mesma conta de /financeiro/resumo). Usado
    assim que a oficina tem ao menos uma entrada lançada.
  - "estimado": enquanto a oficina não usa o Financeiro, estima por OS
    finalizada (tabela de preços por serviço abaixo; sem serviço
    reconhecido, o ticket padrão). É estimativa — a tela avisa.
"""
import json
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .estoque_views import _listar_todos
from .views import supabase, require_permission, _oficina_doc_do_token

logger = logging.getLogger(__name__)

TZ_PADRAO = "America/Sao_Paulo"
MAX_DIAS_POR_PERIODO = 400

# Mesmos valores que o frontend usava (utils/relatorios.ts) enquanto
# calculava tudo no navegador — só valem como ESTIMATIVA, sem Financeiro.
TICKET_PADRAO = 480.0
PRECO_ESTIMADO_POR_SERVICO = {
    "Troca de Óleo": 180,
    "Freios": 320,
    "Suspensão": 450,
    "Alinhamento": 150,
    "Ar Condicionado": 280,
    "Elétrica": 200,
    "Motor": 800,
    "Transmissão": 600,
    "Pneus": 120,
    "Funilaria": 900,
}


# ── Erros do banco ────────────────────────────────────────────────────────────

def _tratar_erros_banco(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            mensagem = str(getattr(e, "message", e))
            if codigo in ("42703", "PGRST204") or "oficina_doc" in mensagem:
                logger.error("Relatórios: ordens.oficina_doc ausente (%s): %s", codigo, mensagem)
                return Response(
                    {"detail": "A tabela de ordens ainda não tem a coluna da oficina. "
                               "Rode backend/sql/ordens_oficina.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo == "42501":
                logger.error("Relatórios: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role.")
                return Response(
                    {"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            logger.exception("Relatórios: erro do banco (%s)", codigo)
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


# ── Parâmetros ────────────────────────────────────────────────────────────────

class _ParametroInvalido(Exception):
    pass


def _data(request, nome, obrigatorio=False):
    bruto = request.query_params.get(nome)
    if not bruto:
        if obrigatorio:
            raise _ParametroInvalido(f"'{nome}' é obrigatório (YYYY-MM-DD).")
        return None
    try:
        if len(bruto) != 10:
            raise ValueError
        return date.fromisoformat(bruto)
    except ValueError:
        raise _ParametroInvalido(f"'{nome}' inválido: use o formato YYYY-MM-DD.")


def _periodo(inicio: date, fim: date, rotulo: str):
    if inicio > fim:
        raise _ParametroInvalido(f"Período {rotulo}: a data inicial é depois da final.")
    if (fim - inicio).days + 1 > MAX_DIAS_POR_PERIODO:
        raise _ParametroInvalido(f"Período {rotulo}: máximo de {MAX_DIAS_POR_PERIODO} dias.")
    return inicio, fim


def _ler_parametros(request):
    de = _data(request, "de", obrigatorio=True)
    ate = _data(request, "ate", obrigatorio=True)
    atual = _periodo(de, ate, "atual")

    de_ant = _data(request, "de_anterior")
    ate_ant = _data(request, "ate_anterior")
    if (de_ant is None) != (ate_ant is None):
        raise _ParametroInvalido("Mande 'de_anterior' e 'ate_anterior' juntos (ou nenhum dos dois).")
    anterior = _periodo(de_ant, ate_ant, "anterior") if de_ant else None

    nome_tz = request.query_params.get("tz") or TZ_PADRAO
    try:
        tz = ZoneInfo(nome_tz)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise _ParametroInvalido(f"Fuso horário desconhecido: '{nome_tz}'.")
    return atual, anterior, nome_tz, tz


# ── Leitura e conversão das linhas ────────────────────────────────────────────

def _dia_da_ordem(created_at, tz) -> date | None:
    """Dia (no fuso `tz`) em que a OS foi criada. `created_at` é texto no banco:
    OS novas têm fuso (+00:00/-03:00); as antigas foram gravadas SEM fuso, no
    relógio do servidor — `astimezone()` num datetime ingênuo faz exatamente
    essa leitura (assume o fuso local da máquina)."""
    if not isinstance(created_at, str):
        return None
    try:
        dt = datetime.fromisoformat(created_at.strip().replace("Z", "+00:00"))
        return dt.astimezone(tz).date()
    except (ValueError, OverflowError, OSError):
        return None


def _servicos_da_ordem(payload) -> list[str]:
    """`payload` é coluna text: chega como string JSON (ou já como dict, se a
    coluna um dia virar jsonb). Qualquer coisa fora do formato = sem serviços."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            return []
    if not isinstance(payload, dict):
        return []
    lista = payload.get("servicos_selecionados")
    if not isinstance(lista, list):
        return []
    return [s.strip() for s in lista if isinstance(s, str) and s.strip()]


def _valor_estimado(servicos: list[str]) -> float:
    total = sum(PRECO_ESTIMADO_POR_SERVICO.get(nome, 0) for nome in servicos)
    return float(total) if total > 0 else TICKET_PADRAO


def _buscar_ordens(oficina_doc, janela_ini: date, janela_fim: date):
    """Ordens da oficina na janela. `created_at` é texto ISO que começa com a
    data, então comparar com 'YYYY-MM-DD' funciona; a folga de 1 dia pra cada
    lado cobre diferença de fuso — o corte exato é feito em Python depois."""
    ini = (janela_ini - timedelta(days=1)).isoformat()
    fim = (janela_fim + timedelta(days=2)).isoformat()   # exclusivo
    return _listar_todos(lambda: (
        supabase.table("ordens").select("id,created_at,status,payload")
        .eq("oficina_doc", oficina_doc)
        .gte("created_at", ini).lt("created_at", fim)
        .order("created_at").order("id")
    ))


def _usa_financeiro(oficina_doc) -> bool:
    try:
        linhas = (
            supabase.table("financeiro_transacoes").select("id")
            .eq("oficina_doc", oficina_doc).eq("tipo", "entrada").neq("status", "cancelado")
            .limit(1).execute().data
        )
    except APIError as e:
        # Tabela do Financeiro não existe/sem acesso: segue com a estimativa.
        if getattr(e, "code", None) in ("42P01", "PGRST205", "42501"):
            logger.warning("Relatórios: financeiro_transacoes indisponível (%s); usando estimativa.", e.code)
            return False
        raise
    return bool(linhas)


def _buscar_lancamentos(oficina_doc, tipo: str, janela_ini: date, janela_fim: date):
    """Lançamentos do Financeiro (tipo 'entrada' ou 'saida'), sem os cancelados,
    por data de competência — a mesma regra de /financeiro/resumo."""
    return _listar_todos(lambda: (
        supabase.table("financeiro_transacoes").select("id,valor,data_competencia")
        .eq("oficina_doc", oficina_doc).eq("tipo", tipo).neq("status", "cancelado")
        .gte("data_competencia", janela_ini.isoformat()).lte("data_competencia", janela_fim.isoformat())
        .order("data_competencia").order("id")
    ))


def _buscar_entradas(oficina_doc, janela_ini: date, janela_fim: date):
    return _buscar_lancamentos(oficina_doc, "entrada", janela_ini, janela_fim)


# ── Agregação ─────────────────────────────────────────────────────────────────

def _dentro(dia: date, periodo) -> bool:
    return periodo is not None and periodo[0] <= dia <= periodo[1]


def _totais(dias: dict, periodo) -> dict:
    t = {"faturamento": 0.0, "ordens": 0, "finalizadas": 0}
    for dia, v in dias.items():
        if _dentro(dia, periodo):
            t["faturamento"] += v["faturamento"]
            t["ordens"] += v["ordens"]
            t["finalizadas"] += v["finalizadas"]
    t["faturamento"] = round(t["faturamento"], 2)
    return t


@api_view(["GET"])
@require_permission("relatorios.ver")
@_tratar_erros_banco
def relatorios(request):
    try:
        atual, anterior, nome_tz, tz = _ler_parametros(request)
    except _ParametroInvalido as e:
        return Response({"detail": str(e)}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    oficina_doc = _oficina_doc_do_token(request.admin)
    janela_ini = min(atual[0], anterior[0]) if anterior else atual[0]
    janela_fim = max(atual[1], anterior[1]) if anterior else atual[1]

    dias: dict[date, dict] = defaultdict(lambda: {"ordens": 0, "finalizadas": 0, "faturamento": 0.0})
    contagem_servicos: dict[str, int] = defaultdict(int)
    usa_financeiro = _usa_financeiro(oficina_doc)

    for ordem in _buscar_ordens(oficina_doc, janela_ini, janela_fim):
        dia = _dia_da_ordem(ordem.get("created_at"), tz)
        if dia is None or not (janela_ini <= dia <= janela_fim):
            continue
        d = dias[dia]
        d["ordens"] += 1
        if ordem.get("status") != "finalizada":
            continue
        d["finalizadas"] += 1
        servicos = _servicos_da_ordem(ordem.get("payload"))
        if not usa_financeiro:
            d["faturamento"] += _valor_estimado(servicos)
        if _dentro(dia, atual):
            for nome in servicos:
                contagem_servicos[nome] += 1

    if usa_financeiro:
        for entrada in _buscar_entradas(oficina_doc, janela_ini, janela_fim):
            try:
                dia = date.fromisoformat(str(entrada["data_competencia"])[:10])
                valor = float(entrada["valor"])
            except (ValueError, TypeError, KeyError):
                continue
            dias[dia]["faturamento"] += valor

    total_atual = _totais(dias, atual)
    total_anterior = _totais(dias, anterior) if anterior else None
    # Sem nenhuma OS no período anterior não há com o que comparar: a tela
    # esconde a variação em vez de mostrar um "+100%" enganoso.
    if total_anterior is not None and total_anterior["ordens"] == 0:
        total_anterior = None

    servicos = sorted(
        ({"nome": n, "quantidade": q} for n, q in contagem_servicos.items()),
        key=lambda s: (-s["quantidade"], s["nome"]),
    )

    return Response({
        "periodo": {
            "de": atual[0].isoformat(), "ate": atual[1].isoformat(),
            "deAnterior": anterior[0].isoformat() if anterior else None,
            "ateAnterior": anterior[1].isoformat() if anterior else None,
            "tz": nome_tz,
        },
        "faturamentoOrigem": "financeiro" if usa_financeiro else "estimado",
        "totais": {"atual": total_atual, "anterior": total_anterior},
        "dias": [
            {"dia": dia.isoformat(), "ordens": v["ordens"], "finalizadas": v["finalizadas"],
             "faturamento": round(v["faturamento"], 2)}
            for dia, v in sorted(dias.items())
        ],
        "servicos": servicos,
    })
