"""Testes da persistência de sessões e rate-limiting (orders/auth_store.py).

Usam um FakeSupabase em memória e um relógio controlável — exercitam o código
real do store (hashing, expiração, janelas deslizantes) sem banco nem rede.
"""
import pytest

from orders.auth_store import SupabaseAuthStore, hash_token, REFRESH_TABLE
from orders.tests.fake_supabase import FakeSupabase


@pytest.fixture
def clock():
    return {"t": 1_000_000.0}


@pytest.fixture
def store(clock):
    return SupabaseAuthStore(FakeSupabase(), now=lambda: clock["t"])


# ── Refresh tokens ────────────────────────────────────────────────────────────

def test_save_e_get_refresh_dono(store, clock):
    store.save_refresh_token("tok-abc", tipo="dono", doc="11222333000181", nome="Ana", expires_at=clock["t"] + 100)
    session = store.get_active_refresh("tok-abc")
    assert session["tipo"] == "dono"
    assert session["doc"] == "11222333000181"
    assert session["id"] is None


def test_save_e_get_refresh_funcionario(store, clock):
    store.save_refresh_token("tok-f", tipo="funcionario", funcionario_id="f1", email="f@x.com", expires_at=clock["t"] + 100)
    session = store.get_active_refresh("tok-f")
    assert session["tipo"] == "funcionario"
    assert session["id"] == "f1"


def test_token_e_guardado_com_hash_nao_em_texto(store, clock):
    store.save_refresh_token("segredo", tipo="dono", doc="d", expires_at=clock["t"] + 100)
    rows = store.sb.rows(REFRESH_TABLE)
    assert rows[0]["token_hash"] == hash_token("segredo")
    assert all(r.get("token_hash") != "segredo" for r in rows)
    # o token cru não aparece em nenhum valor persistido
    assert "segredo" not in [v for r in rows for v in r.values()]


def test_refresh_expirado_retorna_none_e_remove(store, clock):
    store.save_refresh_token("tok", tipo="dono", doc="d", expires_at=clock["t"] + 10)
    clock["t"] += 20  # passou da expiração
    assert store.get_active_refresh("tok") is None
    assert store.sb.rows(REFRESH_TABLE) == []  # limpeza do registro expirado


def test_delete_refresh_token(store, clock):
    store.save_refresh_token("tok", tipo="dono", doc="d", expires_at=clock["t"] + 100)
    store.delete_refresh_token("tok")
    assert store.get_active_refresh("tok") is None


def test_delete_refresh_tokens_for_doc(store, clock):
    store.save_refresh_token("t1", tipo="dono", doc="d1", expires_at=clock["t"] + 100)
    store.save_refresh_token("t2", tipo="dono", doc="d1", expires_at=clock["t"] + 100)
    store.save_refresh_token("t3", tipo="dono", doc="d2", expires_at=clock["t"] + 100)
    store.delete_refresh_tokens_for_doc("d1")
    assert store.get_active_refresh("t1") is None
    assert store.get_active_refresh("t2") is None
    assert store.get_active_refresh("t3") is not None


def test_delete_refresh_tokens_for_funcionario(store, clock):
    store.save_refresh_token("t1", tipo="funcionario", funcionario_id="f1", expires_at=clock["t"] + 100)
    store.save_refresh_token("t2", tipo="funcionario", funcionario_id="f2", expires_at=clock["t"] + 100)
    store.delete_refresh_tokens_for_funcionario("f1")
    assert store.get_active_refresh("t1") is None
    assert store.get_active_refresh("t2") is not None


# ── Reset de senha ────────────────────────────────────────────────────────────

def test_reset_token_valido_depois_usado(store, clock):
    store.save_reset_token("r1", doc="d", email="a@x.com", expires_at=clock["t"] + 100)
    assert store.get_valid_reset_token("r1") == {"doc": "d", "email": "a@x.com"}
    store.mark_reset_token_used("r1")
    assert store.get_valid_reset_token("r1") is None  # não reutilizável


def test_reset_token_expirado(store, clock):
    store.save_reset_token("r1", doc="d", email="a@x.com", expires_at=clock["t"] + 10)
    clock["t"] += 20
    assert store.get_valid_reset_token("r1") is None


# ── Rate limit: PIN ───────────────────────────────────────────────────────────

def test_pin_bloqueia_apos_maximo(store):
    fid = "f1"
    for _ in range(5):
        assert store.pin_attempt_allowed(fid, max_attempts=5, window_seconds=900)
        store.record_pin_attempt(fid)
    assert not store.pin_attempt_allowed(fid, max_attempts=5, window_seconds=900)


def test_pin_libera_apos_janela(store, clock):
    fid = "f1"
    for _ in range(5):
        store.record_pin_attempt(fid)
    assert not store.pin_attempt_allowed(fid, max_attempts=5, window_seconds=900)
    clock["t"] += 901  # tentativas saem da janela
    assert store.pin_attempt_allowed(fid, max_attempts=5, window_seconds=900)


def test_clear_pin_reseta(store):
    fid = "f1"
    for _ in range(5):
        store.record_pin_attempt(fid)
    store.clear_pin_attempts(fid)
    assert store.pin_attempt_allowed(fid, max_attempts=5, window_seconds=900)


# ── Rate limit: pedidos de reset ──────────────────────────────────────────────

def test_reset_request_respeita_intervalo_minimo(store, clock):
    email = "a@x.com"
    assert store.can_request_password_reset(email, max_requests=5, window_seconds=3600, min_interval_seconds=20)
    # imediatamente depois: bloqueado pelo intervalo mínimo
    assert not store.can_request_password_reset(email, max_requests=5, window_seconds=3600, min_interval_seconds=20)
    clock["t"] += 21
    assert store.can_request_password_reset(email, max_requests=5, window_seconds=3600, min_interval_seconds=20)


def test_reset_request_respeita_maximo_na_janela(store, clock):
    email = "a@x.com"
    for _ in range(5):
        assert store.can_request_password_reset(email, max_requests=5, window_seconds=3600, min_interval_seconds=0)
        clock["t"] += 1
    assert not store.can_request_password_reset(email, max_requests=5, window_seconds=3600, min_interval_seconds=0)
