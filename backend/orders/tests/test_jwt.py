"""Testes do JWT HS256 artesanal (assinatura HMAC-SHA256).

Cobrem o contrato de segurança: roundtrip preserva claims, assinatura
adulterada é rejeitada, e token expirado não é aceito.
"""
import time

from orders import views


def test_roundtrip_preserva_claims():
    token = views.make_jwt({"sub": "abc", "doc": "11222333000181"}, ttl_seconds=60)
    payload = views.decode_jwt(token)
    assert payload is not None
    assert payload["sub"] == "abc"
    assert payload["doc"] == "11222333000181"
    assert "exp" in payload


def test_assinatura_adulterada_rejeitada():
    token = views.make_jwt({"sub": "abc"}, ttl_seconds=60)
    header, body, sig = token.split(".")
    forjado = f"{header}.{body}.{sig[:-2]}xx"
    assert views.decode_jwt(forjado) is None


def test_payload_adulterado_rejeitado():
    token = views.make_jwt({"sub": "user"}, ttl_seconds=60)
    other = views.make_jwt({"sub": "admin"}, ttl_seconds=60)
    header, _, sig = token.split(".")
    _, other_body, _ = other.split(".")
    # corpo trocado por outro, mantendo a assinatura original -> inválido
    assert views.decode_jwt(f"{header}.{other_body}.{sig}") is None


def test_token_expirado_rejeitado():
    token = views.make_jwt({"sub": "abc"}, ttl_seconds=-1)
    assert views.decode_jwt(token) is None


def test_token_malformado_nao_explode():
    assert views.decode_jwt("nao-e-um-token") is None
    assert views.decode_jwt("") is None
    assert views.decode_jwt("a.b") is None


def test_tokens_diferentes_para_payloads_diferentes():
    t1 = views.make_jwt({"sub": "a"}, ttl_seconds=60)
    time.sleep(0)
    t2 = views.make_jwt({"sub": "b"}, ttl_seconds=60)
    assert t1 != t2
