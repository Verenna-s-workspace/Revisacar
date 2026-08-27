"""Testes das validações puras dos serializers — CNPJ, PIN, placa e email.

Nenhum toca em rede ou banco: exercitam apenas os validadores de campo.
"""
import pytest
from rest_framework.serializers import ValidationError

from orders.serializers import (
    normalize_doc,
    _validate_cnpj,
    validate_pin_format,
    VeiculoSerializer,
    FuncionarioSerializer,
)


# ── CNPJ ──────────────────────────────────────────────────────────────────────

# 11.222.333/0001-81 é um CNPJ com dígitos verificadores válidos.
VALID_CNPJ = "11222333000181"


def test_normalize_doc_strips_mask():
    assert normalize_doc("11.222.333/0001-81") == VALID_CNPJ
    assert normalize_doc("") == ""
    assert normalize_doc(None) == ""


def test_valid_cnpj_passes():
    _validate_cnpj(VALID_CNPJ)  # não deve levantar


@pytest.mark.parametrize("bad", [
    "1122233300018",     # 13 dígitos
    "112223330001812",   # 15 dígitos
    "00000000000000",    # todos iguais
    "11111111111111",    # todos iguais
    "11222333000180",    # primeiro DV errado
    "11222333000182",    # segundo DV errado
])
def test_invalid_cnpj_raises(bad):
    with pytest.raises(ValidationError):
        _validate_cnpj(bad)


# ── PIN ───────────────────────────────────────────────────────────────────────

def test_valid_pin():
    assert validate_pin_format("123456") == "123456"
    assert validate_pin_format(" 654321 ") == "654321"


@pytest.mark.parametrize("bad", ["12345", "1234567", "12a456", "abcdef", ""])
def test_invalid_pin_raises(bad):
    with pytest.raises(ValidationError):
        validate_pin_format(bad)


# ── Placa (padrão antigo AAA-1234 e Mercosul AAA1A23) ─────────────────────────

@pytest.mark.parametrize("placa,expected", [
    ("abc1234", "ABC1234"),
    ("ABC-1234", "ABC-1234"),
    ("abc1d23", "ABC1D23"),
])
def test_valid_placa(placa, expected):
    assert VeiculoSerializer().validate_placa(placa) == expected


@pytest.mark.parametrize("bad", ["AB1234", "ABCD1234", "1234ABC", "AAA-12A4"])
def test_invalid_placa_raises(bad):
    with pytest.raises(ValidationError):
        VeiculoSerializer().validate_placa(bad)


# ── Email do funcionário ──────────────────────────────────────────────────────

def test_valid_email_normalized():
    assert FuncionarioSerializer().validate_email("  Foo@Bar.COM ") == "foo@bar.com"


@pytest.mark.parametrize("bad", ["abc", "foo@bar", "@bar.com", "foo@.com", "foo bar@x.com"])
def test_invalid_email_raises(bad):
    with pytest.raises(ValidationError):
        FuncionarioSerializer().validate_email(bad)
