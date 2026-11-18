"""
Minha conta: trocar o próprio nome e excluir a própria conta — dono e funcionário.

Cada pessoa mexe só na PRÓPRIA conta: o alvo vem sempre do token (nunca do corpo ou da URL), então não
existe jeito de renomear ou excluir a conta de outra pessoa por aqui. (O dono gerencia os funcionários
em /funcionarios, com a permissão `funcionarios.gerenciar`.) Não exige permissão do RBAC: qualquer
usuário logado pode, até o mecânico e o atendente.

Rotas
  PATCH /conta           {nome}
      Troca o nome de quem está logado (admins.nome para o dono, funcionarios.nome para o funcionário).
      NÃO é o nome comercial da oficina (esse é de Configurações > Dados da Oficina, /oficina/config).
      Responde {nome, accessToken}: o nome vai dentro do token, então já volta um token novo (mesmas
      permissões, mesmo refresh) para a tela mostrar o nome certo sem esperar o próximo login.
  POST  /conta/excluir   dono: {senha, confirmacao} · funcionário: {pin, confirmacao}
      `confirmacao` precisa ser a palavra EXCLUIR (o app pede para digitar; o servidor confere de novo).
      Quem confirma a identidade: a senha do dono ou o PIN do funcionário. Errar conta no limite de
      tentativas (5 em 15 min): o do PIN para o funcionário, um contador próprio para a senha do dono.
      Resposta 403 (não 401) quando a senha/PIN está errada: 401 faria o app achar que a sessão caiu.

O que a exclusão faz
  • Funcionário: remove só o cadastro dele e derruba as sessões. Agendamentos em que era o mecânico ficam
    sem mecânico (FK `on delete set null`); o nome continua nos registros antigos (ordens, lançamentos),
    que guardam o nome como texto.
  • Dono: APAGA A OFICINA INTEIRA — ordens, orçamentos, estoque, financeiro, agenda, clientes de balcão,
    funcionários e a conta. É irreversível. Tudo no banco acontece numa transação só
    (função `conta_excluir_oficina`, migração 0010): ou apaga tudo ou nada. Os arquivos do Storage
    (fotos e PDFs, sempre em `<ordem_id>/...`) saem logo depois, em segundo plano. Contas do app do cliente
    não são tocadas: só o vínculo delas com a oficina some.
"""
import logging
import re
import threading

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .estoque_views import _corpo_valido
from .serializers import ContaNomeSerializer, valhash
from .views import (
    ACCESS_TOKEN_LIFETIME_SECONDS, BUCKET, MAX_PIN_ATTEMPTS, PIN_ATTEMPT_WINDOW_SECONDS,
    _clear_pin_attempts, _get_admin_by_doc, _get_funcionario_by_id, _oficina_doc_do_token,
    _pin_attempt_allowed, _record_pin_attempt, auth_store, make_jwt, require_auth, supabase,
)

logger = logging.getLogger(__name__)

CONFIRMACAO = "EXCLUIR"
FUNCAO_AUSENTE = ("42883", "PGRST202")      # função não existe: a migração 0010 não foi rodada
OFICINA_INEXISTENTE = "P0002"
LOTE_ORDENS = 1000                          # o PostgREST devolve no máximo 1000 linhas por consulta
VOLTAS_LIMPEZA = 20                         # trava contra loop se o Storage se recusar a apagar


def _eh_funcionario(payload: dict) -> bool:
    return payload.get("tipo") == "funcionario"


def _erro(detalhe: str, codigo: int):
    return Response({"detail": detalhe}, status=codigo)


# ── PATCH /conta — trocar o próprio nome ──────────────────────────────────────

@api_view(["PATCH"])
@require_auth
def conta(request):
    if not _corpo_valido(request):
        return _erro("Corpo inválido.", http_status.HTTP_400_BAD_REQUEST)
    serializer = ContaNomeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    nome = serializer.validated_data["nome"]

    payload = request.admin
    oficina_doc = _oficina_doc_do_token(payload)
    try:
        if _eh_funcionario(payload):
            funcionario = _get_funcionario_by_id(str(payload.get("id") or ""))
            # Só quem ainda é funcionário ATIVO desta oficina: o token vale por alguns minutos depois de a
            # conta ser desativada ou removida, e esse tempo não pode servir para editar nada.
            if (not funcionario or funcionario.get("oficina_doc") != oficina_doc
                    or not funcionario.get("ativo", True)):
                return _erro("Esta conta não existe mais ou foi desativada.", http_status.HTTP_404_NOT_FOUND)
            supabase.table("funcionarios").update({"nome": nome}).eq("id", funcionario["id"]).execute()
        else:
            res = supabase.table("admins").update({"nome": nome}).eq("doc", oficina_doc).execute()
            if not res.data:
                return _erro("Conta não encontrada.", http_status.HTTP_404_NOT_FOUND)
    except Exception:  # noqa: BLE001 — qualquer falha do banco vira mensagem limpa, não 500 cru
        logger.exception("Conta: falha ao trocar o nome")
        return _erro("Não foi possível salvar o seu nome agora. Tente de novo.",
                     http_status.HTTP_503_SERVICE_UNAVAILABLE)

    novo = {k: v for k, v in payload.items() if k != "exp"}
    novo["nome"] = nome
    return Response({"nome": nome, "accessToken": make_jwt(novo, ACCESS_TOKEN_LIFETIME_SECONDS)})


# ── POST /conta/excluir ───────────────────────────────────────────────────────

def _em_segundo_plano(funcao, *args):
    """Roda `funcao` numa thread à parte (a resposta não depende dela). Os testes trocam isto por uma chamada direta."""
    threading.Thread(target=funcao, args=args, daemon=True, name="conta-limpeza").start()


def _ids_das_ordens(oficina_doc: str) -> list:
    ids, inicio = [], 0
    while True:
        lote = (supabase.table("ordens").select("id").eq("oficina_doc", oficina_doc)
                .range(inicio, inicio + LOTE_ORDENS - 1).execute().data or [])
        ids.extend(l["id"] for l in lote)
        if len(lote) < LOTE_ORDENS:
            return ids
        inicio += LOTE_ORDENS


def _limpar_arquivos(ordem_ids: list):
    """Apaga do Storage tudo que estava em `<ordem_id>/...`. A conta já saiu do banco: falha aqui só é
    registrada (com a OS) para limpeza manual — não há mais a quem devolver o erro."""
    falhas = 0
    for ordem_id in ordem_ids:
        try:
            for _ in range(VOLTAS_LIMPEZA):
                # `list` devolve uma página; apagar e listar de novo esvazia a pasta sem paginar.
                arquivos = supabase.storage.from_(BUCKET).list(path=ordem_id)
                caminhos = [f"{ordem_id}/{a['name']}" for a in arquivos if a.get("name")]
                if not caminhos:
                    break
                supabase.storage.from_(BUCKET).remove(caminhos)
        except Exception as e:  # noqa: BLE001
            falhas += 1
            logger.error("[CONTA] não consegui apagar os arquivos da OS %s no Storage: %s", ordem_id, e)
    logger.info("[CONTA] limpeza do Storage concluída: %s OS, %s com falha", len(ordem_ids), falhas)


def _excluir_funcionario(payload: dict, corpo: dict):
    pin = str(corpo.get("pin") or "").strip()
    if not re.fullmatch(r"\d{6}", pin):
        return _erro("Digite o seu PIN de 6 números para confirmar.", http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    funcionario_id = str(payload.get("id") or "")
    oficina_doc = _oficina_doc_do_token(payload)
    if not _pin_attempt_allowed(funcionario_id):
        return _erro("Muitas tentativas. Aguarde alguns minutos e tente de novo.",
                     http_status.HTTP_429_TOO_MANY_REQUESTS)

    funcionario = _get_funcionario_by_id(funcionario_id)
    if not funcionario or funcionario.get("oficina_doc") != oficina_doc:
        return _erro("Esta conta não existe mais.", http_status.HTTP_404_NOT_FOUND)
    if not valhash(pin, funcionario.get("pin_hash", "")):
        _record_pin_attempt(funcionario_id)
        return _erro("PIN incorreto.", http_status.HTTP_403_FORBIDDEN)
    _clear_pin_attempts(funcionario_id)

    try:
        supabase.table("funcionarios").delete().eq("id", funcionario_id).execute()
    except Exception:  # noqa: BLE001
        logger.exception("Conta: falha ao excluir funcionário %s", funcionario_id)
        return _erro("Não foi possível excluir a conta agora. Tente de novo.",
                     http_status.HTTP_503_SERVICE_UNAVAILABLE)
    auth_store.delete_refresh_tokens_for_funcionario(funcionario_id)
    logger.info("[CONTA] funcionário %s da oficina %s excluiu a própria conta", funcionario_id, oficina_doc)
    return Response({"message": "Conta excluída."})


def _excluir_dono(payload: dict, corpo: dict):
    senha = corpo.get("senha")
    if not isinstance(senha, str) or not senha:
        return _erro("Digite a sua senha para confirmar.", http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    doc = _oficina_doc_do_token(payload)
    bucket = f"conta:{doc}"
    if not auth_store.excluir_conta_attempt_allowed(
            bucket, max_attempts=MAX_PIN_ATTEMPTS, window_seconds=PIN_ATTEMPT_WINDOW_SECONDS):
        return _erro("Muitas tentativas. Aguarde alguns minutos e tente de novo.",
                     http_status.HTTP_429_TOO_MANY_REQUESTS)

    admin = _get_admin_by_doc(doc)
    if not admin:
        return _erro("Esta conta não existe mais.", http_status.HTTP_404_NOT_FOUND)
    if not valhash(senha, admin.get("pwhash", "")):
        auth_store.record_excluir_conta_attempt(bucket)
        return _erro("Senha incorreta.", http_status.HTTP_403_FORBIDDEN)
    auth_store.clear_excluir_conta_attempts(bucket)

    # Lista as OS ANTES de apagar (depois o banco não as conhece mais). Se falhar, nada foi tocado.
    try:
        ordem_ids = _ids_das_ordens(doc)
    except Exception:  # noqa: BLE001
        logger.exception("Conta: falha ao listar as OS de %s antes de excluir", doc)
        return _erro("Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo.",
                     http_status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        res = supabase.rpc("conta_excluir_oficina", {"p_oficina_doc": doc}).execute()
    except APIError as e:
        codigo = getattr(e, "code", None)
        if codigo in FUNCAO_AUSENTE:
            logger.error("Conta: função conta_excluir_oficina ausente; rode a migração 0010.")
            return _erro("A exclusão de conta ainda não está disponível neste sistema. "
                         "Rode backend/sql/migrations/0010_excluir_conta.sql no SQL Editor do Supabase.",
                         http_status.HTTP_503_SERVICE_UNAVAILABLE)
        if codigo == OFICINA_INEXISTENTE:
            return _erro("Esta conta não existe mais.", http_status.HTTP_404_NOT_FOUND)
        logger.error("Conta: exclusão de %s barrada pelo banco (%s): %s", doc, codigo, getattr(e, "message", e))
        return _erro("Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo.",
                     http_status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception:  # noqa: BLE001 — rede/timeout: a transação do banco ou concluiu ou desfez tudo
        logger.exception("Conta: falha ao excluir %s", doc)
        return _erro("Não foi possível excluir a conta agora. Tente de novo; se continuar, "
                     "entre na sua conta e confira se ela ainda existe.",
                     http_status.HTTP_503_SERVICE_UNAVAILABLE)

    logger.warning("[CONTA] oficina %s excluída pelo dono: %s", doc, res.data)
    _em_segundo_plano(_limpar_arquivos, ordem_ids)
    return Response({"message": "Conta excluída."})


@api_view(["POST"])
@require_auth
def conta_excluir(request):
    if not _corpo_valido(request):
        return _erro("Corpo inválido.", http_status.HTTP_400_BAD_REQUEST)
    if str(request.data.get("confirmacao") or "").strip().upper() != CONFIRMACAO:
        return _erro(f"Digite {CONFIRMACAO} para confirmar a exclusão.", http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    if _eh_funcionario(request.admin):
        return _excluir_funcionario(request.admin, request.data)
    return _excluir_dono(request.admin, request.data)
