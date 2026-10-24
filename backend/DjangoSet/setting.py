import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Aponta explicitamente para o supabase.env na raiz do backend
load_dotenv(BASE_DIR / "supabase.env")


def _env_bool(nome: str, padrao: bool) -> bool:
    valor = os.getenv(nome)
    if valor is None or valor.strip() == "":
        return padrao
    return valor.strip().lower() in ("1", "true", "yes", "on")


# Seguro por padrão: sem DEBUG definido o servidor sobe como PRODUÇÃO.
# Em desenvolvimento, ponha DEBUG=True no supabase.env.
DEBUG = _env_bool("DEBUG", False)

_secret = os.environ.get("DJANGO_SECRET_KEY")
if not _secret:
    if DEBUG:
        _secret = "insecure-dev-key-change-in-production"
    else:
        raise RuntimeError(
            "DJANGO_SECRET_KEY não configurada. Defina a variável de ambiente antes de iniciar em produção."
        )
SECRET_KEY = _secret

# Em produção defina ALLOWED_HOSTS=revisacar-1-qmmv.onrender.com,... (lista separada por vírgula).
# O Render também informa o próprio endereço em RENDER_EXTERNAL_HOSTNAME; ele é aceito automaticamente.
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
if os.getenv("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"].strip())
if DEBUG and not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "testserver"]   # só desenvolvimento/testes
if not DEBUG and (not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS):
    raise RuntimeError(
        "ALLOWED_HOSTS precisa listar os domínios reais em produção (não pode ficar vazio nem ter '*'). "
        "Ex.: ALLOWED_HOSTS=revisacar-1-qmmv.onrender.com"
    )

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "corsheaders",
    "rest_framework",
    "orders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ── Segurança de transporte e cabeçalhos ──────────────────────────────────────
# SecurityMiddleware já manda X-Content-Type-Options: nosniff, Referrer-Policy e
# Cross-Origin-Opener-Policy; XFrameOptionsMiddleware manda X-Frame-Options: DENY.
if not DEBUG:
    # O Render termina o HTTPS no proxy e repassa o esquema original neste cabeçalho.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # O Render já redireciona http→https antes de chegar aqui; deixe ligado só se precisar.
    SECURE_SSL_REDIRECT = _env_bool("SECURE_SSL_REDIRECT", False)
    # HSTS: o navegador só aceita https por este tempo. Começa em 30 dias; depois de
    # confirmar que está tudo certo, suba (31536000 = 1 ano) pela variável de ambiente.
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "2592000"))

ROOT_URLCONF = "DjangoSet.urls"
WSGI_APPLICATION = "DjangoSet.wsgi.application"

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
    }
}

# ── CORS ──────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://revisacar-1-qmmv.onrender.com",
    "https://revisacar-az3w.onrender.com",
]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

# ── DRF ───────────────────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

# ── Supabase ──────────────────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Variáveis não encontradas. Verifique se 'supabase.env' está em: "
        f"{BASE_DIR / 'supabase.env'}"
    )

SUPABASE_BUCKET = "test-bucket"
MAX_FOTO_SIZE_BYTES = 5 * 1024 * 1024

# ── JWT Authentication ────────────────────────────────────────────────────────

ACCESS_TOKEN_LIFETIME_SECONDS = int(os.getenv("ACCESS_TOKEN_LIFETIME_SECONDS", "900"))  # 15 minutes
REFRESH_TOKEN_LIFETIME_SECONDS = int(os.getenv("REFRESH_TOKEN_LIFETIME_SECONDS", "604800"))  # 7 days
RESET_TOKEN_LIFETIME_SECONDS = int(os.getenv("RESET_TOKEN_LIFETIME_SECONDS", "900"))  # 15 minutes
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
