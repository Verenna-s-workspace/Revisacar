import os
from pathlib import Path
from dotenv import load_dotenv
 
BASE_DIR = Path(__file__).resolve().parent.parent
 
# Aponta explicitamente para o supabase.env na raiz do backend
load_dotenv(BASE_DIR / "supabase.env")
 
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-dev-key-change-in-production")
 
DEBUG = os.getenv("DEBUG", "True") == "True"
 
ALLOWED_HOSTS = ["*"]
 
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "corsheaders",
    "rest_framework",
    "orders",
]
 
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]
 
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
    "https://bucket-funcionando1.onrender.com",
    "https://deploydofms.onrender.com",
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
 
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
