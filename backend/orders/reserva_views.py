"""
Reserva de caixa: a oficina separa um percentual de cada entrada paga (serviços, peças ou os dois)
num caixa de emergência. NÃO é desconto — o cliente paga o mesmo valor e a receita continua inteira;
a reserva é só uma separação interna, com saldo e histórico próprios.

Desligada por padrão: sem configuração salva nada muda para a oficina. Os depósitos nascem por um
gatilho do banco quando uma entrada passa a 'pago' (backend/sql/migrations/0008_reserva_caixa.sql),
então cobrem qualquer caminho que registre o pagamento. Este módulo só configura, consulta e retira.

Rotas (camelCase):
  GET    /financeiro/reserva/config           → financeiro.ver
  PUT    /financeiro/reserva/config           → financeiro.reserva  {ativa, percentual, escopo}
  GET    /financeiro/reserva                  → financeiro.ver      saldo + movimentos recentes
  POST   /financeiro/reserva/retiradas        → financeiro.reserva  {valor, descricao?}
  DELETE /financeiro/reserva/retiradas/<id>   → financeiro.reserva  desfaz uma retirada (marca cancelada)

Mudar a configuração vale para os PRÓXIMOS pagamentos: depósitos já feitos guardam o percentual e o
escopo da época. Sem a migration 0008: GET/PUT config usam os padrões (desligada) e as demais rotas
respondem 503 com a instrução — o resto do Financeiro não depende disto.
"""
import logging
from decimal import Decimal

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .estoque_views import _corpo_valido, _jsonb, _listar_todos, _negado, _nao_encontrado, _num, _uuid_valido
from .serializers import ReservaConfigSerializer, ReservaRetiradaSerializer
from .views import supabase, require_auth, _now, _oficina_doc_do_token

logger = logging.getLogger(__name__)

TABELA = "financeiro_reservas"
MAX_MOVIMENTOS = 100
COLUNA_AUSENTE = ("42703", "PGRST204")
OBJETO_AUSENTE = ("42P01", "PGRST205", "42883", "PGRST202") + COLUNA_AUSENTE
MSG_MIGRACAO = ("A reserva de caixa ainda não existe no banco. "
                "Rode backend/sql/migrations/0008_reserva_caixa.sql no SQL Editor do Supabase.")

PADRAO = {"ativa": False, "percentual": 0, "escopo": "servicos"}


def _precisa_da_migracao(view_func):
    """Tabela/função/coluna da 0008 ausente → 503 com a instrução, sem tocar no resto do Financeiro."""
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            if getattr(e, "code", None) in OBJETO_AUSENTE:
                logger.error("Reserva: objeto da migration 0008 ausente (%s): %s", e.code, getattr(e, "message", e))
                return Response({"detail": MSG_MIGRACAO}, status=http_status.HTTP_503_SERVICE_UNAVAILABLE)
            if getattr(e, "code", None) == "22P02":
                return _nao_encontrado()
            if getattr(e, "code", None) == "42501":
                logger.error("Reserva: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role.")
                return Response({"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
            logger.exception("Reserva: erro do banco (%s)", getattr(e, "code", None))
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


# ── Configuração ──────────────────────────────────────────────────────────────

def config_para_api(admin: dict) -> dict:
    salvo = admin.get("reserva_config") if isinstance(admin.get("reserva_config"), dict) else None
    c = {**PADRAO, **(salvo or {})}
    return {
        "ativa": c["ativa"] is True,
        "percentual": _num(c["percentual"] or 0),
        "escopo": c["escopo"],
        "salvo": salvo is not None,
        "atualizadoEm": admin.get("reserva_config_em"),
    }


def _ler_config(oficina_doc: str) -> dict:
    """Config da oficina; sem a coluna (0008 não rodada) vale o padrão: desligada."""
    try:
        linhas = (supabase.table("admins").select("reserva_config,reserva_config_em")
                  .eq("doc", oficina_doc).limit(1).execute().data)
    except APIError as e:
        if getattr(e, "code", None) not in COLUNA_AUSENTE:
            raise
        logger.warning("Reserva: admins.reserva_config ausente; rode a migration 0008.")
        return config_para_api({})
    return config_para_api(linhas[0] if linhas else {})


@api_view(["GET", "PUT"])
@require_auth
@_precisa_da_migracao
def reserva_config(request):
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "GET":
        negado = _negado(request, "financeiro.ver")
        if negado:
            return negado
        return Response(_ler_config(oficina_doc))

    negado = _negado(request, "financeiro.reserva")
    if negado:
        return negado
    if not _corpo_valido(request):
        return Response({"detail": "Corpo inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
    serializer = ReservaConfigSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    dados = serializer.validated_data
    salvar = {"ativa": dados["ativa"], "percentual": _num(dados["percentual"]), "escopo": dados["escopo"]}

    res = (supabase.table("admins")
           .update({"reserva_config": salvar, "reserva_config_em": _now()})
           .eq("doc", oficina_doc).execute())
    if not res.data:
        return _nao_encontrado("Oficina não encontrada")
    return Response(config_para_api(res.data[0]))


# ── Saldo e movimentos ────────────────────────────────────────────────────────

def _soma(linhas) -> Decimal:
    return sum((Decimal(str(l["valor"])) for l in linhas), Decimal("0"))


def movimento_para_api(l: dict) -> dict:
    out = {
        "id": str(l["id"]),
        "tipo": l["tipo"],
        "valor": _num(l["valor"]),
        "descricao": l.get("descricao") or "",
        "criadoPorNome": l.get("criado_por_nome") or "",
        "criadoEm": l["created_at"],
    }
    if l["tipo"] == "deposito":
        out.update({
            "transacaoId": str(l["transacao_id"]),
            "categoria": l.get("categoria"),
            "percentual": _num(l["percentual"]),
            "escopo": l.get("escopo"),
        })
        if l.get("base_valor") is not None:
            out["baseValor"] = _num(l["base_valor"])
        if l.get("ordem_servico_id"):
            out["ordemServicoId"] = l["ordem_servico_id"]
    return out


@api_view(["GET"])
@require_auth
@_precisa_da_migracao
def reserva(request):
    negado = _negado(request, "financeiro.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    config = _ler_config(oficina_doc)

    linhas = _listar_todos(lambda: (
        supabase.table(TABELA).select("*").eq("oficina_doc", oficina_doc).eq("status", "ativo")
        .order("created_at", desc=True).order("id")
    ))
    guardado = _soma(l for l in linhas if l["tipo"] == "deposito")
    retirado = _soma(l for l in linhas if l["tipo"] == "retirada")
    return Response({
        "ativa": config["ativa"],
        "percentual": config["percentual"],
        "escopo": config["escopo"],
        # Pode ficar negativo se um pagamento já reservado for estornado depois de a reserva ter sido gasta.
        "saldo": float(round(guardado - retirado, 2)),
        "totalGuardado": float(round(guardado, 2)),
        "totalRetirado": float(round(retirado, 2)),
        "movimentos": [movimento_para_api(l) for l in linhas[:MAX_MOVIMENTOS]],
        "truncado": len(linhas) > MAX_MOVIMENTOS,
    })


# ── Retiradas ─────────────────────────────────────────────────────────────────

@api_view(["POST"])
@require_auth
@_precisa_da_migracao
def reserva_retiradas(request):
    negado = _negado(request, "financeiro.reserva")
    if negado:
        return negado
    if not _corpo_valido(request):
        return Response({"detail": "Corpo inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
    serializer = ReservaRetiradaSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    dados = serializer.validated_data
    oficina_doc = _oficina_doc_do_token(request.admin)

    resultado = _jsonb(supabase.rpc("reserva_retirar", {
        "p_oficina_doc": oficina_doc,
        "p_valor": float(dados["valor"]),
        "p_descricao": dados["descricao"],
        "p_nome": request.admin.get("nome", ""),
    }).execute().data)
    if not resultado["ok"]:
        saldo = float(resultado.get("saldo") or 0)
        return Response(
            {"detail": f"Saldo insuficiente na reserva (disponível: R$ {saldo:.2f}).".replace(".", ","),
             "codigo": "saldo_insuficiente", "saldo": saldo},
            status=http_status.HTTP_409_CONFLICT,
        )
    return Response({"id": str(resultado["id"]), "saldo": float(resultado["saldo"])}, status=http_status.HTTP_201_CREATED)


@api_view(["DELETE"])
@require_auth
@_precisa_da_migracao
def reserva_retirada_detail(request, retirada_id):
    """Desfaz uma retirada lançada por engano: marca como cancelada (nunca apaga) e o valor volta ao saldo."""
    negado = _negado(request, "financeiro.reserva")
    if negado:
        return negado
    if not _uuid_valido(retirada_id):
        return _nao_encontrado()
    oficina_doc = _oficina_doc_do_token(request.admin)
    atual = (supabase.table(TABELA).select("id,status").eq("id", retirada_id)
             .eq("oficina_doc", oficina_doc).eq("tipo", "retirada").limit(1).execute().data)
    if not atual:
        return _nao_encontrado()
    if atual[0]["status"] != "cancelado":
        (supabase.table(TABELA).update({"status": "cancelado"})
         .eq("id", retirada_id).eq("oficina_doc", oficina_doc).eq("tipo", "retirada").execute())
    return Response(status=http_status.HTTP_204_NO_CONTENT)
