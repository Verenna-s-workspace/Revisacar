import uuid
import base64
import urllib.parse
import hmac
import json
import re
import secrets
import time
from datetime import datetime

from django.conf import settings
from django.core.mail import send_mail
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError
from supabase import create_client

from .serializers import (
    OrdemServicoSerializer, AdminSerializer, AdminLoginSerializer,
    FuncionarioSerializer, FuncionarioPinLoginSerializer, pwhash, valhash,
    validate_pin_format,
)
from .rbac import permissoes_do_cargo, FUNCIONARIO_CARGOS

# ── Supabase client (singleton) ───────────────────────────────────────────────

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
BUCKET = settings.SUPABASE_BUCKET
MAX_FOTO_SIZE_BYTES = settings.MAX_FOTO_SIZE_BYTES
ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60
REFRESH_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60
RESET_TOKEN_LIFETIME_SECONDS = 15 * 60
JWT_ALGORITHM = 'HS256'

REFRESH_TOKENS: dict[str, dict] = {}
PASSWORD_RESET_TOKENS: dict[str, dict] = {}
RESET_REQUESTS: dict[str, list[float]] = {}
MAX_RESET_REQUESTS = 5
RESET_REQUEST_WINDOW_SECONDS = 60 * 60
MIN_RESET_REQUEST_INTERVAL_SECONDS = 20

# PIN é um segredo curto (6 dígitos = 1 milhão de combinações) — sem
# bloqueio, é força-bruta trivial. 5 tentativas erradas / 15 min por
# funcionário, independente de quem está tentando.
PIN_ATTEMPTS: dict[str, list[float]] = {}
MAX_PIN_ATTEMPTS = 5
PIN_ATTEMPT_WINDOW_SECONDS = 15 * 60


# ── Helpers ───────────────────────────────────────────────────────────────────

def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode('utf-8')


def _b64url_decode(value: str) -> bytes:
    padding = '=' * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def make_jwt(payload: dict, ttl_seconds: int) -> str:
    header = {'alg': JWT_ALGORITHM, 'typ': 'JWT'}
    body = {**payload, 'exp': int(time.time()) + ttl_seconds}
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    body_b64 = _b64url_encode(json.dumps(body, separators=(',', ':')).encode('utf-8'))
    signature = hmac.new(settings.SECRET_KEY.encode('utf-8'), f'{header_b64}.{body_b64}'.encode('utf-8'), digestmod='sha256').digest()
    signature_b64 = _b64url_encode(signature)
    return f'{header_b64}.{body_b64}.{signature_b64}'


def decode_jwt(token: str) -> dict | None:
    try:
        header_b64, payload_b64, signature_b64 = token.split('.')
        expected = hmac.new(settings.SECRET_KEY.encode('utf-8'), f'{header_b64}.{payload_b64}'.encode('utf-8'), digestmod='sha256').digest()
        actual = _b64url_decode(signature_b64)
        if not hmac.compare_digest(actual, expected):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode('utf-8'))
        if int(time.time()) > int(payload.get('exp', 0)):
            return None
        return payload
    except Exception:
        return None


def _now():
    return datetime.now().isoformat()


def _get_ordem_or_404(ordem_id: str):
    """Busca ordem no Supabase; retorna (row, None) ou (None, Response 404)."""
    res = supabase.table("ordens").select("*").eq("id", ordem_id).execute()
    if not res.data:
        return None, Response({"detail": "Não encontrada"}, status=status.HTTP_404_NOT_FOUND)
    return res.data[0], None


def _get_admin_by_doc(doc: str):
    res = supabase.table("admins").select("*").eq("doc", doc).limit(1).execute()
    return res.data[0] if res.data else None


def _get_admin_by_email(email: str):
    res = supabase.table("admins").select("*").eq("email", email.lower()).limit(1).execute()
    return res.data[0] if res.data else None


def _issue_tokens(admin: dict) -> dict:
    """Emite tokens pro DONO (conta admin, login por CNPJ). Dono sempre tem
    todas as permissões — por isso 'cargo': 'dono' e permissoes = tudo."""
    permissoes = permissoes_do_cargo("dono")
    payload = {
        "tipo": "dono",
        "nome": admin["nome"],
        "doc": admin["doc"],
        "oficina_doc": admin["doc"],  # dono é a própria oficina
        "cargo": "dono",
        "permissoes": permissoes,
    }
    access_token = make_jwt(payload, ACCESS_TOKEN_LIFETIME_SECONDS)
    refresh_token = secrets.token_urlsafe(32)
    REFRESH_TOKENS[refresh_token] = {
        "tipo": "dono",
        "doc": admin["doc"],
        "nome": admin["nome"],
        "expires_at": time.time() + REFRESH_TOKEN_LIFETIME_SECONDS,
    }
    return {
        "accessToken": access_token, "refreshToken": refresh_token,
        "nome": admin["nome"], "doc": admin["doc"],
        "tipo": "dono", "cargo": "dono", "permissoes": permissoes,
    }


def _issue_funcionario_tokens(funcionario: dict) -> dict:
    """Emite tokens pra um FUNCIONÁRIO (login por email, cargo limitado)."""
    permissoes = permissoes_do_cargo(funcionario["cargo"])
    payload = {
        "tipo": "funcionario",
        "id": funcionario["id"],
        "nome": funcionario["nome"],
        "email": funcionario["email"],
        "oficina_doc": funcionario["oficina_doc"],
        "cargo": funcionario["cargo"],
        "permissoes": permissoes,
    }
    access_token = make_jwt(payload, ACCESS_TOKEN_LIFETIME_SECONDS)
    refresh_token = secrets.token_urlsafe(32)
    REFRESH_TOKENS[refresh_token] = {
        "tipo": "funcionario",
        "id": funcionario["id"],
        "email": funcionario["email"],
        "expires_at": time.time() + REFRESH_TOKEN_LIFETIME_SECONDS,
    }
    return {
        "accessToken": access_token, "refreshToken": refresh_token,
        "nome": funcionario["nome"], "email": funcionario["email"],
        "tipo": "funcionario", "cargo": funcionario["cargo"], "permissoes": permissoes,
    }


def _get_active_refresh(refresh_token: str) -> dict | None:
    token = REFRESH_TOKENS.get(refresh_token)
    if not token or token["expires_at"] < time.time():
        return None
    return token


def _invalidate_refresh_token(refresh_token: str):
    REFRESH_TOKENS.pop(refresh_token, None)


def _invalidate_refresh_tokens_for_doc(doc: str):
    for key, token_data in list(REFRESH_TOKENS.items()):
        if token_data.get("doc") == doc:
            REFRESH_TOKENS.pop(key, None)


def _send_reset_email(email: str, token: str):
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_link = f"{frontend_url}/reset-password?token={token}"
    subject = 'Redefinição de senha Revisacar'
    message = (
        'Olá,\n\n'
        'Recebemos uma solicitação para redefinir a senha da sua conta Revisacar.\n\n'
        f'Use o link abaixo para continuar:\n\n{reset_link}\n\n'
        'Se você não solicitou esta alteração, ignore esta mensagem.\n\n'
        'Atenciosamente,\nRevisacar'
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@revisacar.local')
    print(f"[PASSWORD RESET] backend={settings.EMAIL_BACKEND} host={settings.EMAIL_HOST} user={settings.EMAIL_HOST_USER} from={from_email}")

    try:
        send_mail(subject, message, from_email, [email], fail_silently=False)
        print(f"[PASSWORD RESET] email enviado com sucesso para {email}")
    except Exception as exc:
        print(f"[PASSWORD RESET] Falha ao enviar email para {email}: {exc}")
        print(f"[PASSWORD RESET] Link de redefinição: {reset_link}")


def _send_pin_email(email: str, nome: str, pin: str):
    subject = 'Seu PIN de acesso Revisacar'
    message = (
        f'Olá, {nome},\n\n'
        'Recebemos uma solicitação para recuperar o PIN de acesso à oficina.\n\n'
        f'Seu novo PIN é: {pin}\n\n'
        'Esse PIN substitui o anterior — use-o na tela de login.\n\n'
        'Se você não solicitou isso, avise o responsável pela oficina.\n\n'
        'Atenciosamente,\nRevisacar'
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@revisacar.local')
    try:
        send_mail(subject, message, from_email, [email], fail_silently=False)
        print(f"[PIN RESET] email enviado com sucesso para {email}")
    except Exception as exc:
        print(f"[PIN RESET] Falha ao enviar email para {email}: {exc}")


def _pin_attempt_allowed(funcionario_id: str) -> bool:
    now = time.time()
    attempts = [t for t in PIN_ATTEMPTS.get(funcionario_id, []) if t > now - PIN_ATTEMPT_WINDOW_SECONDS]
    PIN_ATTEMPTS[funcionario_id] = attempts
    return len(attempts) < MAX_PIN_ATTEMPTS


def _record_pin_attempt(funcionario_id: str):
    PIN_ATTEMPTS.setdefault(funcionario_id, []).append(time.time())


def _clear_pin_attempts(funcionario_id: str):
    PIN_ATTEMPTS.pop(funcionario_id, None)


def _can_request_password_reset(email: str) -> bool:
    now = time.time()
    attempts = RESET_REQUESTS.get(email, [])
    attempts = [t for t in attempts if t > now - RESET_REQUEST_WINDOW_SECONDS]
    if attempts and (len(attempts) >= MAX_RESET_REQUESTS or now - attempts[-1] < MIN_RESET_REQUEST_INTERVAL_SECONDS):
        RESET_REQUESTS[email] = attempts
        return False

    attempts.append(now)
    RESET_REQUESTS[email] = attempts
    return True


def _require_auth(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return decode_jwt(auth_header.split(" ", 1)[1])


def require_auth(view_func):
    def wrapper(request, *args, **kwargs):
        payload = _require_auth(request)
        if payload is None:
            return Response({"detail": "Token inválido ou expirado"}, status=status.HTTP_401_UNAUTHORIZED)
        request.admin = payload
        return view_func(request, *args, **kwargs)
    return wrapper


def require_permission(permissao: str):
    """Exige token válido E que o cargo do token tenha essa permissão.
    Uso: @require_permission("financeiro.ver") acima da view.
    Dono sempre passa, porque seu token já carrega todas as permissões."""
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            payload = _require_auth(request)
            if payload is None:
                return Response({"detail": "Token inválido ou expirado"}, status=status.HTTP_401_UNAUTHORIZED)
            if permissao not in payload.get("permissoes", []):
                return Response({"detail": "Você não tem permissão para isso"}, status=status.HTTP_403_FORBIDDEN)
            request.admin = payload
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def _get_funcionario_by_email(email: str):
    res = supabase.table("funcionarios").select("*").eq("email", email.lower()).limit(1).execute()
    return res.data[0] if res.data else None


def _get_funcionario_by_id(funcionario_id: str):
    res = supabase.table("funcionarios").select("*").eq("id", funcionario_id).limit(1).execute()
    return res.data[0] if res.data else None


def _oficina_doc_do_token(payload: dict) -> str:
    """Doc da oficina a que o token pertence — funciona pra dono e funcionário."""
    return payload.get("oficina_doc") or payload.get("doc", "")


# ── Root ──────────────────────────────────────────────────────────────────────

from django.utils import timezone

@api_view(["GET"])
def root(request):
    return Response({
        "status": "online",
        "version": "2",
        "timestamp": timezone.now().isoformat(),
    })


@api_view(["GET"])
def cors_info(request):
    from django.conf import settings
    return Response({
        "CORS_ALLOW_ALL_ORIGINS": getattr(settings, "CORS_ALLOW_ALL_ORIGINS", None),
        "CORS_ALLOWED_ORIGINS": getattr(settings, "CORS_ALLOWED_ORIGINS", None),
    })


@api_view(["POST"])
def admin_signup(request):
    serializer = AdminSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = serializer.validated_data
    if _get_admin_by_doc(dados["doc"]):
        return Response({"detail": "CNPJ já cadastrado"}, status=status.HTTP_409_CONFLICT)

    supabase.table("admins").insert({
        "nome": dados["nome"],
        "doc": dados["doc"],
        "email": dados["email"],
        "pwhash": pwhash(dados["senha"]),
        "created_at": _now(),
    }).execute()

    admin = _get_admin_by_doc(dados["doc"])
    tokens = _issue_tokens(admin)
    return Response(tokens, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def admin_login(request):
    serializer = AdminLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = serializer.validated_data
    admin = _get_admin_by_doc(dados["doc"])
    if not admin or not valhash(dados["senha"], admin.get("pwhash", "")):
        return Response({"detail": "Doc ou senha incorretos"}, status=status.HTTP_401_UNAUTHORIZED)

    tokens = _issue_tokens(admin)
    return Response(tokens)


@api_view(["POST"])
def admin_refresh(request):
    """Reemite tokens a partir de um refresh token válido — funciona tanto
    pra login de dono quanto de funcionário (olha o 'tipo' salvo na sessão)."""
    refresh_token = request.data.get("refreshToken")
    if not refresh_token:
        return Response({"detail": "refreshToken obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

    session = _get_active_refresh(refresh_token)
    if not session:
        return Response({"detail": "Refresh token inválido ou expirado"}, status=status.HTTP_401_UNAUTHORIZED)

    _invalidate_refresh_token(refresh_token)

    if session.get("tipo") == "funcionario":
        funcionario = _get_funcionario_by_id(session["id"])
        if not funcionario or not funcionario.get("ativo", True):
            return Response({"detail": "Funcionário não encontrado ou inativo"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_issue_funcionario_tokens(funcionario))

    admin = _get_admin_by_doc(session["doc"])
    if not admin:
        return Response({"detail": "Admin não encontrado"}, status=status.HTTP_404_NOT_FOUND)
    return Response(_issue_tokens(admin))


@api_view(["POST"])
def admin_logout(request):
    refresh_token = request.data.get("refreshToken")
    if refresh_token:
        _invalidate_refresh_token(refresh_token)
    return Response({"message": "Logout realizado"})


@api_view(["POST"])
def admin_forgot_password(request):
    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response({"detail": "Email obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

    if not _can_request_password_reset(email):
        return Response({"detail": "Aguarde alguns minutos antes de tentar novamente."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    admin = _get_admin_by_email(email)
    if admin:
        reset_token = secrets.token_urlsafe(32)
        PASSWORD_RESET_TOKENS[reset_token] = {
            "doc": admin["doc"],
            "email": email,
            "expires_at": time.time() + RESET_TOKEN_LIFETIME_SECONDS,
            "used": False,
        }
        _send_reset_email(email, reset_token)

    return Response({"message": "Se o email existir, você receberá um link de redefinição em breve."})


@api_view(["POST"])
def admin_reset_password(request):
    token = request.data.get("token", "")
    senha = request.data.get("senha", "")

    if not token or not senha:
        return Response({"detail": "Token e senha obrigatórios"}, status=status.HTTP_400_BAD_REQUEST)
    if len(senha) < 6:
        return Response({"detail": "Senha deve ter pelo menos 6 caracteres"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    record = PASSWORD_RESET_TOKENS.get(token)
    if not record or record.get("used") or record.get("expires_at", 0) < time.time():
        return Response({"detail": "Token inválido ou expirado"}, status=status.HTTP_401_UNAUTHORIZED)

    admin = _get_admin_by_doc(record["doc"])
    if not admin:
        return Response({"detail": "Admin não encontrado"}, status=status.HTTP_404_NOT_FOUND)

    supabase.table("admins").update({"pwhash": pwhash(senha)}).eq("doc", admin["doc"]).execute()
    record["used"] = True
    _invalidate_refresh_tokens_for_doc(admin["doc"])
    return Response({"message": "Senha redefinida com sucesso"})


# ── Funcionários (RBAC) ──────────────────────────────────────────────────────
#
# O DONO não é uma linha em "funcionarios" — ele é a conta admin que já
# existe (login por CNPJ). "funcionarios" são Gerente/Mecânico/Atendente,
# sempre vinculados a uma oficina (oficina_doc = CNPJ do dono que os criou),
# com login próprio por email.

@api_view(["POST"])
@require_permission("funcionarios.gerenciar")
def funcionario_signup(request):
    """Cadastra um funcionário. Só quem tem 'funcionarios.gerenciar' (hoje,
    só o dono) pode chamar isso — nunca é auto-cadastro."""
    serializer = FuncionarioSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = serializer.validated_data
    oficina_doc = _oficina_doc_do_token(request.admin)

    if _get_funcionario_by_email(dados["email"]):
        return Response({"detail": "Email já cadastrado"}, status=status.HTTP_409_CONFLICT)

    supabase.table("funcionarios").insert({
        "oficina_doc": oficina_doc,
        "nome": dados["nome"],
        "email": dados["email"],
        "pin_hash": pwhash(dados["pin"]),
        "cargo": dados["cargo"],
        "ativo": True,
        "created_at": _now(),
    }).execute()

    return Response({"message": "Funcionário cadastrado"}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def funcionarios_publicos(request):
    """Lista pra tela de login em quiosque — SEM autenticação, porque
    ninguém logou ainda. Só nome/cargo (nada sensível: sem email, sem PIN).
    O CNPJ não é segredo (é registro público), então expor 'quem trabalha
    nessa oficina' pra quem já tem o CNPJ em mãos é uma troca aceitável
    pela UX de quiosque. O que importa (o PIN) continua protegido."""
    oficina_doc = request.query_params.get("oficina_doc", "").strip()
    if not re.match(r"^\d{14}$", oficina_doc):
        return Response({"detail": "oficina_doc inválido"}, status=status.HTTP_400_BAD_REQUEST)

    res = supabase.table("funcionarios").select("id, nome, cargo").eq(
        "oficina_doc", oficina_doc
    ).eq("ativo", True).order("nome").execute()
    return Response(res.data)


@api_view(["POST"])
def funcionario_login_pin(request):
    """Segundo passo do login em quiosque: funcionário já foi escolhido na
    lista (funcionario_id), agora confirma com o PIN."""
    serializer = FuncionarioPinLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = serializer.validated_data
    funcionario_id = dados["funcionario_id"]

    if not _pin_attempt_allowed(funcionario_id):
        return Response({"detail": "Muitas tentativas. Aguarde alguns minutos e tente de novo."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    funcionario = _get_funcionario_by_id(funcionario_id)
    if not funcionario or not valhash(dados["pin"], funcionario.get("pin_hash", "")):
        _record_pin_attempt(funcionario_id)
        return Response({"detail": "PIN incorreto"}, status=status.HTTP_401_UNAUTHORIZED)
    if not funcionario.get("ativo", True):
        return Response({"detail": "Este acesso foi desativado"}, status=status.HTTP_403_FORBIDDEN)

    _clear_pin_attempts(funcionario_id)
    return Response(_issue_funcionario_tokens(funcionario))


@api_view(["POST"])
def funcionario_forgot_pin(request):
    """Gera um PIN novo (aleatório) e manda por email — não existe 'ver o
    PIN antigo', só substituir por um novo, igual reset de senha."""
    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response({"detail": "Email obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

    if not _can_request_password_reset(email):
        return Response({"detail": "Aguarde alguns minutos antes de tentar novamente."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    funcionario = _get_funcionario_by_email(email)
    if funcionario and funcionario.get("ativo", True):
        novo_pin = f"{secrets.randbelow(1_000_000):06d}"
        supabase.table("funcionarios").update({"pin_hash": pwhash(novo_pin)}).eq("id", funcionario["id"]).execute()
        _clear_pin_attempts(funcionario["id"])
        _send_pin_email(email, funcionario["nome"], novo_pin)

    return Response({"message": "Se o email existir, você receberá um novo PIN em instantes."})


@api_view(["GET"])
@require_permission("funcionarios.gerenciar")
def funcionarios_list(request):
    """Lista os funcionários da oficina de quem está chamando (tenant-scoped)."""
    oficina_doc = _oficina_doc_do_token(request.admin)
    res = supabase.table("funcionarios").select(
        "id, nome, email, cargo, ativo, created_at"
    ).eq("oficina_doc", oficina_doc).order("created_at", desc=True).execute()
    return Response(res.data)


@api_view(["PATCH", "DELETE"])
@require_permission("funcionarios.gerenciar")
def funcionario_detail(request, funcionario_id):
    """PATCH pra mudar cargo/ativo. DELETE pra remover o acesso."""
    oficina_doc = _oficina_doc_do_token(request.admin)
    funcionario = _get_funcionario_by_id(funcionario_id)

    if not funcionario or funcionario["oficina_doc"] != oficina_doc:
        return Response({"detail": "Não encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        supabase.table("funcionarios").delete().eq("id", funcionario_id).execute()
        return Response(status=status.HTTP_204_NO_CONTENT)

    updates = {}
    if "cargo" in request.data:
        cargo = str(request.data["cargo"]).strip().lower()
        if cargo not in FUNCIONARIO_CARGOS:
            return Response({"detail": "Cargo inválido"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        updates["cargo"] = cargo
    if "ativo" in request.data:
        updates["ativo"] = bool(request.data["ativo"])
    if "pin" in request.data:
        # dono resetando o PIN na mão (sem passar pelo fluxo de email)
        try:
            updates["pin_hash"] = pwhash(validate_pin_format(request.data["pin"]))
        except ValidationError:
            return Response({"detail": "PIN deve ter exatamente 6 dígitos numéricos"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if not updates:
        return Response({"detail": "Nada para atualizar"}, status=status.HTTP_400_BAD_REQUEST)

    supabase.table("funcionarios").update(updates).eq("id", funcionario_id).execute()
    if ("ativo" in updates and not updates["ativo"]) or "pin_hash" in updates:
        # desativou o funcionário, ou trocou o PIN → derruba sessões ativas na hora
        _clear_pin_attempts(funcionario_id)
        for key, token_data in list(REFRESH_TOKENS.items()):
            if token_data.get("tipo") == "funcionario" and token_data.get("id") == funcionario_id:
                REFRESH_TOKENS.pop(key, None)

    return Response({"message": "Atualizado"})


@api_view(["GET"])
@require_auth
def me(request):
    """Qualquer usuário autenticado (dono ou funcionário) chama isso pra
    saber quem é e o que pode fazer — sem precisar decodificar o JWT no front."""
    return Response({
        "tipo": request.admin.get("tipo"),
        "nome": request.admin.get("nome"),
        "cargo": request.admin.get("cargo"),
        "permissoes": request.admin.get("permissoes", []),
    })


# ── Ordens ────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@require_auth
def ordens_list(request):
    """
    GET  /ordens        → lista ordens (filtrável por ?status=)
    POST /ordens        → cria nova ordem
    """
    if request.method == "GET":
        query = supabase.table("ordens").select("*").order("created_at", desc=True)
        status_filter = request.query_params.get("status")
        if status_filter:
            query = query.eq("status", status_filter)
        res = query.execute()
        return Response(res.data)

    # POST
    serializer = OrdemServicoSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    ordem = serializer.validated_data
    ordem_id = str(uuid.uuid4())
    now = _now()

    data = {
        "id": ordem_id,
        "created_at": now,
        "updated_at": now,
        "os_num": ordem["os_header"]["os_num"],
        "placa": ordem["veiculo"]["placa"],
        "modelo": ordem["veiculo"]["modelo"],
        "cliente": ordem["cliente"]["nome"],
        "status": ordem["status"],
        "fotos_paths": ordem.get("fotos_paths", []),
        "payload": serializer.data,
    }

    supabase.table("ordens").insert(data).execute()
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@require_auth
def ordem_detail(request, ordem_id):
    """
    GET    /ordens/<id>  → detalhe
    PUT    /ordens/<id>  → atualiza
    DELETE /ordens/<id>  → remove
    """
    if request.method == "GET":
        row, err = _get_ordem_or_404(ordem_id)
        if err:
            return err
        return Response(row)

    if request.method == "PUT":
        serializer = OrdemServicoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Preserva fotos já existentes
        existing = supabase.table("ordens").select("fotos_paths").eq("id", ordem_id).execute()
        existing_paths = existing.data[0].get("fotos_paths", []) if existing.data else []

        ordem = serializer.validated_data
        update = {
            "updated_at": _now(),
            "os_num": ordem["os_header"]["os_num"],
            "placa": ordem["veiculo"]["placa"],
            "modelo": ordem["veiculo"]["modelo"],
            "cliente": ordem["cliente"]["nome"],
            "status": ordem["status"],
            "fotos_paths": existing_paths,
            "payload": serializer.data,
        }

        res = supabase.table("ordens").update(update).eq("id", ordem_id).execute()
        if not res.data:
            return Response({"detail": "Não encontrada"}, status=status.HTTP_404_NOT_FOUND)
        return Response(res.data[0])

    # DELETE
    row, err = _get_ordem_or_404(ordem_id)
    if err:
        return err

    # Remove arquivos do storage antes de deletar a linha
    files = supabase.storage.from_(BUCKET).list(path=ordem_id)
    paths = [f"{ordem_id}/{f['name']}" for f in files]
    if paths:
        supabase.storage.from_(BUCKET).remove(paths)

    supabase.table("ordens").delete().eq("id", ordem_id).execute()
    return Response({"message": "Deletada"})


@api_view(["PATCH"])
@require_auth
def ordem_status(request, ordem_id):
    """PATCH /ordens/<id>/status?status=<novo_status>"""
    novo_status = request.query_params.get("status") or request.data.get("status")
    if not novo_status:
        return Response({"detail": "Parâmetro 'status' obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

    res = supabase.table("ordens").update({
        "status": novo_status,
        "updated_at": _now(),
    }).eq("id", ordem_id).execute()

    if not res.data:
        return Response({"detail": "Não encontrada"}, status=status.HTTP_404_NOT_FOUND)
    return Response(res.data[0])


# ── Fotos ─────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@parser_classes([MultiPartParser])
@require_auth
def upload_fotos(request, ordem_id):
    """POST /ordens/<id>/fotos  — multipart/form-data, campo 'files'"""
    row, err = _get_ordem_or_404(ordem_id)
    if err:
        return err

    existing_paths = row.get("fotos_paths", []) or []
    files = request.FILES.getlist("files")

    if not files:
        return Response({"detail": "Nenhum arquivo enviado"}, status=status.HTTP_400_BAD_REQUEST)

    new_paths = []
    for file in files:
        name_parts = file.name.split(".")
        if len(name_parts) < 2:
            return Response(
                {"detail": f"Arquivo '{file.name}' sem extensão válida"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contents = file.read()
        if len(contents) > MAX_FOTO_SIZE_BYTES:
            return Response(
                {"detail": f"Arquivo '{file.name}' muito grande (máx {MAX_FOTO_SIZE_BYTES} bytes)"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        extension = name_parts[-1]
        unique_name = f"{ordem_id}/{uuid.uuid4()}.{extension}"
        supabase.storage.from_(BUCKET).upload(unique_name, contents)
        new_paths.append(unique_name)

    all_paths = list(set(existing_paths + new_paths))
    supabase.table("ordens").update({
        "fotos_paths": all_paths,
        "updated_at": _now(),
    }).eq("id", ordem_id).execute()

    return Response({"paths": all_paths})


@api_view(["DELETE"])
@require_auth
def delete_foto(request, ordem_id, foto_path):
    """DELETE /ordens/<id>/fotos/<foto_path>"""
    foto_path = urllib.parse.unquote(foto_path)

    res = supabase.table("ordens").select("fotos_paths").eq("id", ordem_id).execute()
    if not res.data:
        return Response({"detail": "Ordem não encontrada"}, status=status.HTTP_404_NOT_FOUND)

    existing_paths = res.data[0].get("fotos_paths", []) or []
    if foto_path not in existing_paths:
        return Response({"detail": "Foto não encontrada"}, status=status.HTTP_404_NOT_FOUND)

    try:
        supabase.storage.from_(BUCKET).remove([foto_path])
    except Exception as e:
        print(f"Erro ao deletar do storage: {e}")

    new_paths = [p for p in existing_paths if p != foto_path]
    supabase.table("ordens").update({
        "fotos_paths": new_paths,
        "updated_at": _now(),
    }).eq("id", ordem_id).execute()

    return Response({"message": "Foto deletada", "paths": new_paths})


@api_view(["GET"])
def get_foto(request, path):
    """GET /fotos/<path>  — retorna base64 da foto"""
    try:
        file_data = supabase.storage.from_(BUCKET).download(path)
        if file_data is None:
            return Response({"detail": "Foto não encontrada"}, status=status.HTTP_404_NOT_FOUND)
        encoded = base64.b64encode(file_data).decode("utf-8")
        return Response({"data": encoded, "filename": path})
    except Exception as e:
        return Response({"detail": f"Erro ao baixar foto: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Upload avulso / listagem ──────────────────────────────────────────────────

@api_view(["POST"])
@parser_classes([MultiPartParser])
def upload_avulso(request):
    """POST /upload  — upload simples sem associar a uma ordem"""
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "Arquivo não enviado"}, status=status.HTTP_400_BAD_REQUEST)

    extension = file.name.split(".")[-1]
    unique_name = f"{uuid.uuid4()}.{extension}"
    contents = file.read()

    response = supabase.storage.from_(BUCKET).upload(unique_name, contents)
    return Response({"path": unique_name, "status": str(response)})


@api_view(["GET"])
def list_files(request):
    """GET /list  — lista arquivos no bucket"""
    files = supabase.storage.from_(BUCKET).list()
    return Response({"files": files})