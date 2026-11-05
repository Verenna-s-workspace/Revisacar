"""Fluxo "esqueci minha senha" do dono: POST /admin/forgot-password e /admin/reset-password.

Sem banco nem SMTP: o store de auth roda sobre o FakeSupabase em memória, o envio de e-mail
é capturado e a conta do dono é um dicionário.
"""
import time

import django
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import views  # noqa: E402
from orders.auth_store import SupabaseAuthStore, RESET_TABLE, hash_token  # noqa: E402
from tests.fake_memoria import FakeSupabase  # noqa: E402

DOC = "11222333000181"
EMAIL = "dono@oficina.com"


class _AdminsFake:
    """Só o que admin_reset_password usa: supabase.table("admins").update(...).eq(...).execute()."""

    def __init__(self):
        self.pwhash = "hash-antigo"

    def table(self, nome):
        assert nome == "admins"
        return self

    def update(self, patch):
        self._patch = patch
        return self

    def eq(self, *_):
        return self

    def execute(self):
        self.pwhash = self._patch["pwhash"]


@pytest.fixture()
def env(monkeypatch):
    # Relógio real + um deslocamento que o teste pode avançar (views usa time.time() de verdade).
    relogio = {"t": 0.0}
    store = SupabaseAuthStore(FakeSupabase(), now=lambda: time.time() + relogio["t"])
    admins = _AdminsFake()
    emails = []

    monkeypatch.setattr(views, "auth_store", store)
    monkeypatch.setattr(views, "supabase", admins)
    monkeypatch.setattr(views, "_get_admin_by_email",
                        lambda e: {"doc": DOC, "email": EMAIL, "nome": "Ana"} if e == EMAIL else None)
    monkeypatch.setattr(views, "_get_admin_by_doc",
                        lambda d: {"doc": DOC, "email": EMAIL, "nome": "Ana"} if d == DOC else None)
    monkeypatch.setattr(views, "send_mail", lambda assunto, msg, de, para, **k: emails.append((para, msg)))
    monkeypatch.setattr(views.settings, "FRONTEND_URL", "https://app.exemplo.com.br", raising=False)

    class Env:
        pass

    e = Env()
    e.api, e.store, e.admins, e.emails, e.relogio = APIClient(), store, admins, emails, relogio
    return e


def _token_do_email(emails):
    msg = emails[-1][1]
    link = next(l for l in msg.split() if "/reset-password?token=" in l)
    return link.split("token=", 1)[1]


def test_pedido_envia_link_com_a_url_do_frontend(env):
    r = env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    assert r.status_code == 200
    assert len(env.emails) == 1
    assert env.emails[0][0] == [EMAIL]
    assert "https://app.exemplo.com.br/reset-password?token=" in env.emails[0][1]


def test_token_e_guardado_so_com_hash(env):
    env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    token = _token_do_email(env.emails)
    linhas = env.store.sb.rows(RESET_TABLE)
    assert linhas[0]["token_hash"] == hash_token(token)
    assert token not in [v for l in linhas for v in l.values()]


def test_email_inexistente_responde_igual_e_nao_envia(env):
    existente = env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    env.relogio["t"] += 3600
    inexistente = env.api.post("/admin/forgot-password", {"email": "ninguem@x.com"}, format="json")
    assert inexistente.status_code == existente.status_code == 200
    assert inexistente.data == existente.data
    assert len(env.emails) == 1  # só o e-mail da conta que existe


def test_pedido_sem_email_e_400(env):
    assert env.api.post("/admin/forgot-password", {}, format="json").status_code == 400


def test_pedidos_seguidos_sao_limitados(env):
    assert env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json").status_code == 200
    assert env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json").status_code == 429


def test_sem_frontend_url_nao_envia_email(env, monkeypatch):
    monkeypatch.setattr(views.settings, "FRONTEND_URL", "", raising=False)
    r = env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    assert r.status_code == 200  # a resposta não vaza a falha de configuração
    assert env.emails == []


def test_redefinir_troca_a_senha_e_o_token_nao_vale_de_novo(env):
    env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    token = _token_do_email(env.emails)

    ok = env.api.post("/admin/reset-password", {"token": token, "senha": "nova-senha-123"}, format="json")
    assert ok.status_code == 200
    assert env.admins.pwhash != "hash-antigo"
    assert views.valhash("nova-senha-123", env.admins.pwhash)

    de_novo = env.api.post("/admin/reset-password", {"token": token, "senha": "outra-senha-456"}, format="json")
    assert de_novo.status_code == 401
    assert views.valhash("nova-senha-123", env.admins.pwhash)  # a segunda tentativa não trocou nada


def test_token_expirado_e_recusado(env):
    env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    token = _token_do_email(env.emails)
    env.relogio["t"] += views.RESET_TOKEN_LIFETIME_SECONDS + 1
    r = env.api.post("/admin/reset-password", {"token": token, "senha": "nova-senha-123"}, format="json")
    assert r.status_code == 401
    assert env.admins.pwhash == "hash-antigo"


def test_token_inventado_e_recusado(env):
    r = env.api.post("/admin/reset-password", {"token": "inventado", "senha": "nova-senha-123"}, format="json")
    assert r.status_code == 401
    assert env.admins.pwhash == "hash-antigo"


def test_senha_curta_ou_campos_faltando(env):
    env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    token = _token_do_email(env.emails)
    assert env.api.post("/admin/reset-password", {"token": token, "senha": "123"}, format="json").status_code == 422
    assert env.api.post("/admin/reset-password", {"token": token}, format="json").status_code == 400
    # a tentativa com senha curta não queima o token
    ok = env.api.post("/admin/reset-password", {"token": token, "senha": "nova-senha-123"}, format="json")
    assert ok.status_code == 200


def test_redefinir_derruba_as_sessoes_abertas(env):
    env.store.save_refresh_token("sessao-1", tipo="dono", doc=DOC, expires_at=time.time() + 10_000_000)
    env.api.post("/admin/forgot-password", {"email": EMAIL}, format="json")
    token = _token_do_email(env.emails)
    env.api.post("/admin/reset-password", {"token": token, "senha": "nova-senha-123"}, format="json")
    assert env.store.get_active_refresh("sessao-1") is None
