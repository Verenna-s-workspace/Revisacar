"""Regras dos campos da OS (orders/campos_os.py): formato, limites e o que antes se perdia ao salvar."""
import json
from datetime import date

import django
import pytest

django.setup()

from rest_framework import serializers  # noqa: E402

from orders import campos_os as campos  # noqa: E402
from orders import relatorios_views, views, visao_geral_views  # noqa: E402
from orders.serializers import OrdemServicoSerializer  # noqa: E402

from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _corpo_ordem  # noqa: E402

CPF_OK = "52998224725"
CNPJ_OK = "11222333000181"


def _rejeita(fn, *args):
    with pytest.raises(serializers.ValidationError):
        fn(*args)


# ── normalizadores ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("valor,esperado", [
    ("João da Silva", "João da Silva"),
    ("  Maria   Clara ", "Maria Clara"),
    ("D'Ávila", "D'Ávila"),
    ("Maria-Clara Jr.", "Maria-Clara Jr."),
])
def test_nome_aceita_acento_apostrofo_hifen_e_ponto(valor, esperado):
    assert campos.nome(valor) == esperado


@pytest.mark.parametrize("valor", ["João123", "A", "12345", "Fulano@", "x" * 101, "-Maria"])
def test_nome_rejeita_numero_simbolo_curto_e_longo(valor):
    _rejeita(campos.nome, valor)


def test_nome_vazio_so_passa_quando_opcional():
    assert campos.nome("") == ""
    _rejeita(campos.nome, "", True)


@pytest.mark.parametrize("valor,esperado", [
    ("11999990000", "11999990000"),
    ("(11) 99999-0000", "11999990000"),     # formato antigo, com máscara
    ("1133334444", "1133334444"),
])
def test_telefone_normaliza_para_digitos(valor, esperado):
    assert campos.telefone(valor) == esperado


@pytest.mark.parametrize("valor", ["", "123", "0199990000", "11899990000", "119999900001", "abc"])
def test_telefone_rejeita_invalido(valor):
    _rejeita(campos.telefone, valor)


def test_documento_cpf_cnpj():
    assert campos.documento("") == ""
    assert campos.documento("529.982.247-25") == CPF_OK
    assert campos.documento(CNPJ_OK) == CNPJ_OK
    for ruim in ("12345678900", "11111111111", "123", "5299822472", "11222333000180"):
        _rejeita(campos.documento, ruim)


@pytest.mark.parametrize("valor,esperado", [("2014", "2014"), ("", ""), ("1900", "1900")])
def test_ano_aceita(valor, esperado):
    assert campos.ano(valor) == esperado


def test_ano_rejeita_texto_curto_e_fora_da_faixa():
    for ruim in ("14", "20x4", "2014/2015", "1899", str(date.today().year + 2)):
        _rejeita(campos.ano, ruim)
    assert campos.ano(str(date.today().year + 1)) == str(date.today().year + 1)   # modelo do ano que vem


def test_km_normaliza_legado_com_ponto_e_limita_digitos():
    assert campos.km("87.450") == "87450"
    assert campos.km("") == ""
    _rejeita(campos.km, "12345678")


@pytest.mark.parametrize("valor,ok", [
    ("9BWZZZ377VT004251", True),
    ("9bwzzz377vt004251", True),     # sobe para maiúsculas
    ("9BWZZZ377VT00425", False),    # 16
    ("9BWZZZ377VT00425I", False),   # I não existe em chassi
    ("9BWZZZ377VT00425O", False),
    ("", True),
])
def test_chassi(valor, ok):
    if ok:
        assert campos.chassi(valor) == valor.upper()
    else:
        _rejeita(campos.chassi, valor)


def test_email_e_modelo_e_cor_e_registro():
    assert campos.email("a@b.com") == "a@b.com"
    _rejeita(campos.email, "a@b")
    _rejeita(campos.email, "a" * 120 + "@b.com")
    assert campos.modelo("HB20S 1.6 Comfort") == "HB20S 1.6 Comfort"
    assert campos.modelo("Ford Ka+") == "Ford Ka+"
    _rejeita(campos.modelo, "Onix <script>")
    assert campos.cor("Prata/Preto") == "Prata/Preto"
    _rejeita(campos.cor, "Prata 2")
    assert campos.registro("CREA-SP 12345") == "CREA-SP 12345"
    _rejeita(campos.registro, "CREA@123")
    _rejeita(campos.registro, "1" * 21)


def test_data_hora_opcao_e_os_num():
    assert campos.data_iso("2026-10-31") == "2026-10-31"
    for ruim in ("2026-02-31", "31/10/2026", "1999-12-31"):
        _rejeita(campos.data_iso, ruim)
    assert campos.hora("08:30") == "08:30"
    _rejeita(campos.hora, "25:00")
    assert campos.opcao("Flex", campos.COMBUSTIVEIS) == "Flex"
    _rejeita(campos.opcao, "Água", campos.COMBUSTIVEIS)
    assert campos.os_num("000123") == "000123"
    assert campos.os_num("OS-1") == "OS-1"      # formato antigo continua valendo
    for ruim in ("", "12 3", "1" * 21, "<1>"):
        _rejeita(campos.os_num, ruim)


def test_celulas_da_tabela_de_pecas():
    assert campos.campo_peca("quantidade", "12") == "12"
    for ruim in ("0,5", "1000", "-1", "abc"):
        _rejeita(campos.campo_peca, "quantidade", ruim)
    assert campos.campo_peca("codigo", "F49FH2") == "F49FH2"
    _rejeita(campos.campo_peca, "codigo", "F49#H2")
    _rejeita(campos.campo_peca, "peca", "x" * 81)
    assert campos.item_adicional('Palheta 24"') == 'Palheta 24"'
    _rejeita(campos.item_adicional, "")
    _rejeita(campos.item_adicional, "x" * 61)


# ── serializer da OS inteira ──────────────────────────────────────────────────

def _corpo(**extra):
    base = {
        "os_header": {"os_num": "1001", "os_date": "2026-10-31", "os_time": "09:15", "os_km": "87.450"},
        "cliente": {"nome": "Maria D'Ávila", "doc": "529.982.247-25", "tel": "(11) 99999-0000", "email": "m@x.com"},
        "veiculo": {"placa": "ABC1D23", "modelo": "Onix 1.0", "ano": "2019", "cor": "Prata",
                    "combustivel": "Flex", "nivel_combustivel": "1/2", "chassi": "9BWZZZ377VT004251"},
    }
    base.update(extra)
    return base


def _valida(corpo):
    s = OrdemServicoSerializer(data=corpo)
    return s.is_valid(), s.errors, s


def test_corpo_completo_valido_e_normaliza_para_digitos():
    ok, erros, s = _valida(_corpo())
    assert ok, erros
    d = s.validated_data
    assert d["cliente"]["tel"] == "11999990000" and d["cliente"]["doc"] == CPF_OK
    assert d["os_header"]["os_km"] == "87450"


@pytest.mark.parametrize("onde,campo,valor", [
    ("cliente", "nome", "João123"),
    ("cliente", "tel", "123"),
    ("cliente", "doc", "12345678900"),
    ("cliente", "email", "sem-arroba"),
    ("veiculo", "ano", "20"),
    ("veiculo", "chassi", "CURTO"),
    ("veiculo", "combustivel", "Água"),
    ("veiculo", "obs_entrada", "x" * 1001),
    ("veiculo", "obs_cliente", "x" * 1001),
    ("os_header", "os_date", "2026-02-31"),
])
def test_campo_invalido_derruba_o_salvamento(onde, campo, valor):
    corpo = _corpo()
    corpo[onde][campo] = valor
    ok, erros, _ = _valida(corpo)
    assert not ok and campo in erros[onde]


def test_obs_de_item_e_dados_do_tecnico():
    ok, erros, _ = _valida(_corpo(checklist={"motor:Óleo": {"status": "crit", "obs": "x" * 501}}))
    assert not ok
    ok, erros, _ = _valida(_corpo(checklist={"motor:Óleo": {"status": "quebrado", "obs": ""}}))
    assert not ok
    ok, erros, _ = _valida(_corpo(tecnico={"nome": "Carlos", "registro": "CREA 123/SP", "data_saida": "2026-10-31",
                                           "hora_saida": "17:40", "km_saida": "87.900", "parecer_geral": "ok"}))
    assert ok, erros
    for campo, valor in (("nome", "Carlos 2"), ("registro", "@@"), ("data_saida", "31/10"),
                         ("hora_saida", "99:99"), ("km_saida", "99999999"), ("parecer_geral", "x" * 2001)):
        t = {"nome": "Carlos", campo: valor}
        ok, erros, _ = _valida(_corpo(tecnico=t))
        assert not ok and campo in erros["tecnico"], campo


def test_estado_da_inspecao_agora_e_aceito_e_validado():
    pecas = [{"id": "1", "peca": "Filtro de óleo", "modelo": "HB20", "marca": "Bosch", "codigo": "F49FH2",
              "quantidade": "2", "isAuto": True, "sourceKey": "motor:Filtro"},
             {"id": "2"}]
    ok, erros, s = _valida(_corpo(itens_adicionais=["Palheta 24\""], troca_set=["motor:Filtro"], tabela_pecas=pecas))
    assert ok, erros
    assert s.data["tabela_pecas"][0]["codigo"] == "F49FH2" and s.data["itens_adicionais"] == ['Palheta 24"']
    for ruim in (
        {"itens_adicionais": ["<b>"]},
        {"itens_adicionais": ["a"] * 51},
        {"tabela_pecas": [{"id": "1", "quantidade": "0,5"}]},
        {"tabela_pecas": [{"id": "1", "marca": "x" * 61}]},
        {"tabela_pecas": [{"id": "1"}] * 101},
    ):
        ok, _, _ = _valida(_corpo(**ruim))
        assert not ok, ruim


# ── pela API: o que o front manda agora fica salvo ────────────────────────────

@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


def _payload(db, oid):
    cur = db.cursor()
    cur.execute("select payload from ordens where id=%s", (oid,))
    p = cur.fetchone()[0]
    return json.loads(p) if isinstance(p, str) else p


def test_relato_do_cliente_e_estado_da_inspecao_nao_se_perdem_ao_salvar(fake, db):
    api = _cliente()
    corpo = _corpo(
        itens_adicionais=["Palheta 24\""], troca_set=["motor:Filtro"],
        tabela_pecas=[{"id": "p1", "peca": "Filtro", "quantidade": "2"}],
    )
    corpo["veiculo"]["obs_cliente"] = "Barulho ao frear"
    r = api.post("/ordens", corpo, format="json")
    assert r.status_code == 201, r.content
    oid = r.json()["id"]
    p = _payload(db, oid)
    assert p["veiculo"]["obs_cliente"] == "Barulho ao frear"
    assert p["itens_adicionais"] == ['Palheta 24"'] and p["troca_set"] == ["motor:Filtro"]
    assert p["tabela_pecas"][0]["quantidade"] == "2"
    assert p["cliente"]["tel"] == "11999990000"          # gravado só com dígitos

    corpo["veiculo"]["obs_cliente"] = "Barulho ao frear e puxando"
    assert api.put(f"/ordens/{oid}", corpo, format="json").status_code == 200
    assert _payload(db, oid)["veiculo"]["obs_cliente"] == "Barulho ao frear e puxando"


def test_ordem_com_campo_invalido_da_422_e_nao_grava(fake, db):
    api = _cliente()
    corpo = _corpo()
    corpo["veiculo"]["ano"] = "2O14"
    r = api.post("/ordens", corpo, format="json")
    assert r.status_code == 422 and "ano" in r.json()["veiculo"]
    cur = db.cursor()
    cur.execute("select count(*) from ordens")
    assert cur.fetchone()[0] == 0


def test_corpo_simples_dos_outros_testes_continua_valido(fake):
    r = _cliente().post("/ordens", _corpo_ordem(), format="json")
    assert r.status_code == 201, r.content
