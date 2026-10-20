"""Configuração de produção: o servidor tem que ser seguro por padrão.

Cada caso importa o settings num processo limpo (env controlada, sem ler o
supabase.env real), porque o settings valida tudo na importação.
"""
import json
import os
import pathlib
import subprocess
import sys

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent

_BASE_ENV = {
    "PATH": os.environ.get("PATH", ""),
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_KEY": "chave-de-teste",
}

_SCRIPT = """
import json, dotenv
dotenv.load_dotenv = lambda *a, **k: None   # não ler o supabase.env real da máquina
import DjangoSet.setting as s
print(json.dumps({
    "debug": s.DEBUG,
    "hosts": s.ALLOWED_HOSTS,
    "middleware": s.MIDDLEWARE,
    "hsts": getattr(s, "SECURE_HSTS_SECONDS", 0),
    "proxy": getattr(s, "SECURE_PROXY_SSL_HEADER", None),
    "redirect": getattr(s, "SECURE_SSL_REDIRECT", False),
}))
"""


def _carregar(**env):
    proc = subprocess.run(
        [sys.executable, "-c", _SCRIPT], cwd=BACKEND_DIR, capture_output=True, text=True,
        env={**_BASE_ENV, **env},
    )
    if proc.returncode != 0:
        return None, proc.stderr
    return json.loads(proc.stdout.strip().splitlines()[-1]), ""


def test_sem_nenhuma_variavel_nao_sobe():
    cfg, erro = _carregar()
    assert cfg is None and "DJANGO_SECRET_KEY" in erro


def test_producao_sem_allowed_hosts_nao_sobe():
    cfg, erro = _carregar(DJANGO_SECRET_KEY="x" * 50)
    assert cfg is None and "ALLOWED_HOSTS" in erro


def test_producao_com_curinga_nao_sobe():
    cfg, erro = _carregar(DJANGO_SECRET_KEY="x" * 50, ALLOWED_HOSTS="*")
    assert cfg is None and "ALLOWED_HOSTS" in erro
    cfg, erro = _carregar(DJANGO_SECRET_KEY="x" * 50, ALLOWED_HOSTS="a.com,*")
    assert cfg is None


def test_producao_valida_tem_cabecalhos_de_seguranca():
    cfg, erro = _carregar(DJANGO_SECRET_KEY="x" * 50, ALLOWED_HOSTS="api.exemplo.com, outro.exemplo.com")
    assert cfg is not None, erro
    assert cfg["debug"] is False
    assert cfg["hosts"] == ["api.exemplo.com", "outro.exemplo.com"]
    assert "django.middleware.security.SecurityMiddleware" in cfg["middleware"]
    assert "django.middleware.clickjacking.XFrameOptionsMiddleware" in cfg["middleware"]
    assert cfg["hsts"] == 2592000
    assert cfg["proxy"] == ["HTTP_X_FORWARDED_PROTO", "https"]
    assert cfg["redirect"] is False


def test_producao_hsts_e_redirect_configuraveis():
    cfg, erro = _carregar(DJANGO_SECRET_KEY="x" * 50, ALLOWED_HOSTS="a.com",
                          SECURE_HSTS_SECONDS="31536000", SECURE_SSL_REDIRECT="true")
    assert cfg is not None, erro
    assert cfg["hsts"] == 31536000 and cfg["redirect"] is True


def test_render_informa_o_proprio_host():
    cfg, erro = _carregar(DJANGO_SECRET_KEY="x" * 50, RENDER_EXTERNAL_HOSTNAME="meu-app.onrender.com")
    assert cfg is not None, erro
    assert cfg["hosts"] == ["meu-app.onrender.com"]


def test_producao_sem_secret_key_nao_sobe():
    cfg, erro = _carregar(ALLOWED_HOSTS="a.com")
    assert cfg is None and "DJANGO_SECRET_KEY" in erro


def test_desenvolvimento_continua_simples():
    for valor in ("True", "true", "1"):
        cfg, erro = _carregar(DEBUG=valor)
        assert cfg is not None, erro
        assert cfg["debug"] is True
        assert cfg["hsts"] == 0 and cfg["proxy"] is None   # nada de HSTS/proxy em dev


def test_debug_com_valor_estranho_vale_como_falso():
    cfg, _ = _carregar(DEBUG="talvez", DJANGO_SECRET_KEY="x" * 50, ALLOWED_HOSTS="a.com")
    assert cfg is not None and cfg["debug"] is False
