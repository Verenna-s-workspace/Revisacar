"""Cadastro automático de cliente e veículo pelo checklist: sem duplicar, sem juntar gente diferente."""
import django
import psycopg2
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import (  # noqa: E402
    agendamentos_views, cadastro_checklist as cad, carteira, clientes_views, estoque_views, veiculos_views, views,
)
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402

CPF_1 = "529.982.247-25"
CPF_2 = "111.444.777-35"


def _api(cargo="dono", oficina=OFICINA_A):
    c = APIClient()
    token = make_jwt({"tipo": cargo, "nome": f"{cargo}-{oficina[:2]}", "oficina_doc": oficina,
                      "permissoes": permissoes_do_cargo(cargo)}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (views, carteira, clientes_views, veiculos_views, agendamentos_views, estoque_views):
        if hasattr(modulo, "supabase"):
            monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _api()


@pytest.fixture()
def api_b(fake):
    return _api(oficina=OFICINA_B)


def _os(cliente=None, veiculo=None, km=""):
    cli = {"nome": "João da Silva", "tel": "(11) 99999-0000"}
    cli.update(cliente or {})
    ve = {"placa": "ABC1D23", "modelo": "Toyota Corolla", "ano": "2018"}
    ve.update(veiculo or {})
    return {"os_header": {"os_num": "OS-1", "os_km": km}, "cliente": cli, "veiculo": ve}


def _salvar(api, **kw):
    r = api.post("/ordens", _os(**kw), format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _contagem(db, tabela, oficina=OFICINA_A):
    cur = db.cursor()
    if tabela == "customers":
        cur.execute("select count(*) from customers where oficina_origem_doc=%s", (oficina,))
    else:
        cur.execute("select count(*) from customer_vehicles where oficina_origem_doc=%s and deleted is not true", (oficina,))
    return cur.fetchone()[0]


# ── Normalização ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("a,b", [
    ("João da Silva", "joao silva"),
    ("  JOÃO   DA  SILVA ", "Joao de Silva"),
    ("Maria D'Ávila", "maria d avila"),
])
def test_normalizar_nome_ignora_acento_caixa_e_particulas(a, b):
    assert cad.normalizar_nome(a) == cad.normalizar_nome(b) != ""


def test_normalizar_nome_nao_junta_nomes_diferentes():
    assert cad.normalizar_nome("João Silva") != cad.normalizar_nome("João Silva Neto")
    assert cad.normalizar_nome("José") != cad.normalizar_nome("Joseane")


@pytest.mark.parametrize("a,b", [
    ("(11) 99999-0000", "11999990000"),
    ("+55 11 99999-0000", "11999990000"),
    ("(11) 9999-0000", "11999990000"),   # celular antigo, sem o 9
])
def test_normalizar_telefone_mesma_linha(a, b):
    assert cad.normalizar_telefone(a) == cad.normalizar_telefone(b) == "11999990000"


def test_normalizar_telefone_invalido_nao_serve_de_chave():
    assert cad.normalizar_telefone("12345") == ""
    assert cad.normalizar_telefone("") == ""
    assert cad.normalizar_telefone("(11) 3333-4444") == "1133334444"  # fixo continua fixo


# ── Cadastro novo ─────────────────────────────────────────────────────────────

def test_cria_cliente_e_veiculo_novos_e_liga_a_os(api, db):
    r = _salvar(api, cliente={"doc": CPF_1, "email": "Joao@Exemplo.com"},
                veiculo={"cor": "Prata", "combustivel": "Flex", "chassi": "9bwzzz377vt004251"}, km="87.450")
    v = r["vinculo"]
    assert v["cliente_criado"] and v["veiculo_criado"] and v["avisos"] == []

    cur = db.cursor()
    cur.execute("select name, cpf, phone, email, origem, oficina_origem_doc from customers where id=%s", (v["customer_id"],))
    assert cur.fetchone() == ("João da Silva", "52998224725", "(11) 99999-0000", "joao@exemplo.com", "oficina", OFICINA_A)
    cur.execute("select plate_norm, brand, model, year, color, fuel_type, vin, mileage, customer_id, oficina_origem_doc "
                "from customer_vehicles where id=%s", (v["vehicle_id"],))
    assert cur.fetchone() == ("ABC1D23", "", "Toyota Corolla", 2018, "Prata", "Flex", "9BWZZZ377VT004251", 87450,
                              __import__("uuid").UUID(v["customer_id"]), OFICINA_A)
    cur.execute("select customer_id, vehicle_id from ordens where id=%s", (r["id"],))
    assert tuple(map(str, cur.fetchone())) == (v["customer_id"], v["vehicle_id"])
    # Aparece nas telas Clientes e Veículos como qualquer cadastro de balcão
    assert [c["nome"] for c in api.get("/clientes").json()] == ["João da Silva"]
    assert api.get("/veiculos").json()[0]["placa"] == "ABC1D23"


def test_cadastro_automatico_fica_marcado_como_do_checklist(api, db):
    r = _salvar(api)
    cur = db.cursor()
    cur.execute("select observacoes from oficina_clientes where customer_id=%s", (r["vinculo"]["customer_id"],))
    assert "checklist (OS OS-1)" in cur.fetchone()[0]
    cur.execute("select notes from customer_vehicles where id=%s", (r["vinculo"]["vehicle_id"],))
    assert "checklist" in cur.fetchone()[0]


def test_salvar_a_mesma_os_de_novo_nao_duplica(api, db):
    r = _salvar(api)
    for _ in range(3):
        r2 = api.put(f"/ordens/{r['id']}", _os(), format="json")
        assert r2.status_code == 200
        assert not r2.json()["vinculo"]["cliente_criado"] and not r2.json()["vinculo"]["veiculo_criado"]
        assert r2.json()["vinculo"]["customer_id"] == r["vinculo"]["customer_id"]
    assert (_contagem(db, "customers"), _contagem(db, "veiculos")) == (1, 1)


def test_corrigir_digitacao_na_mesma_os_nao_cria_outra_pessoa(api, db):
    r = _salvar(api)
    # nome com erro de digitação corrigido e telefone trocado: sem CPF/e-mail/id o vínculo da OS é mantido
    r2 = api.put(f"/ordens/{r['id']}", _os(cliente={"nome": "Joao da Silvva", "tel": "(11) 98888-1111"}), format="json")
    assert r2.json()["vinculo"]["customer_id"] == r["vinculo"]["customer_id"]
    assert _contagem(db, "customers") == 1


# ── Reaproveitar (sinal forte) ────────────────────────────────────────────────

@pytest.mark.parametrize("cliente", [
    {"nome": "joao silva", "tel": "11999990000"},          # sem acento/partícula, telefone sem máscara
    {"nome": "JOÃO DA SILVA", "tel": "(11) 99999-0000"},
    {"nome": "João da Silva", "tel": "(11) 9999-0000"},    # sem o 9
])
def test_mesmo_nome_e_telefone_reaproveita_o_cliente(api, db, cliente):
    primeiro = _salvar(api)
    segundo = _salvar(api, cliente=cliente, veiculo={"placa": "XYZ9K88"})
    assert segundo["vinculo"]["customer_id"] == primeiro["vinculo"]["customer_id"]
    assert not segundo["vinculo"]["cliente_criado"]
    assert _contagem(db, "customers") == 1


def test_mesmo_cpf_reaproveita_mesmo_com_nome_e_telefone_diferentes(api, db):
    primeiro = _salvar(api, cliente={"doc": CPF_1})
    segundo = _salvar(api, cliente={"nome": "J. Silva", "tel": "(21) 98888-7777", "doc": CPF_1},
                      veiculo={"placa": "XYZ9K88"})
    assert segundo["vinculo"]["customer_id"] == primeiro["vinculo"]["customer_id"]
    assert _contagem(db, "customers") == 1


def test_mesmo_email_reaproveita(api, db):
    primeiro = _salvar(api, cliente={"email": "joao@exemplo.com"})
    segundo = _salvar(api, cliente={"nome": "Outro Nome", "tel": "(21) 98888-7777", "email": "JOAO@exemplo.com"},
                      veiculo={"placa": "XYZ9K88"})
    assert segundo["vinculo"]["customer_id"] == primeiro["vinculo"]["customer_id"]


@pytest.mark.parametrize("antes,depois", [("ABC1D23", "abc1d23"), ("ABC1234", "ABC-1234"), ("abc-1234", "ABC1234")])
def test_placa_com_outra_digitacao_e_o_mesmo_veiculo(api, db, antes, depois):
    primeiro = _salvar(api, veiculo={"placa": antes})
    segundo = _salvar(api, veiculo={"placa": depois})
    assert segundo["vinculo"]["vehicle_id"] == primeiro["vinculo"]["vehicle_id"]
    assert not segundo["vinculo"]["veiculo_criado"]
    assert _contagem(db, "veiculos") == 1


def test_placa_antiga_e_mercosul_sao_veiculos_diferentes(api, db):
    _salvar(api, veiculo={"placa": "ABC1234"})
    _salvar(api, veiculo={"placa": "ABC1D23"})
    assert _contagem(db, "veiculos") == 2


def test_placa_conhecida_com_telefone_do_dono_liga_ao_dono(api, db):
    primeiro = _salvar(api)
    # o dono volta, mas digitado de outro jeito e sem CPF: o telefone confirma que é o dono do carro
    segundo = _salvar(api, cliente={"nome": "Joãozinho", "tel": "11999990000"})
    assert segundo["vinculo"]["customer_id"] == primeiro["vinculo"]["customer_id"]
    assert _contagem(db, "customers") == 1


# ── NÃO juntar sinal fraco ────────────────────────────────────────────────────

def test_mesmo_telefone_com_nome_diferente_e_outra_pessoa(api, db):
    """Família usa o mesmo número: telefone sozinho não junta cadastros."""
    pai = _salvar(api, cliente={"nome": "João da Silva", "tel": "(11) 99999-0000"})
    filha = _salvar(api, cliente={"nome": "Maria da Silva", "tel": "(11) 99999-0000"},
                    veiculo={"placa": "XYZ9K88"})
    assert filha["vinculo"]["customer_id"] != pai["vinculo"]["customer_id"]
    assert filha["vinculo"]["cliente_criado"]
    assert _contagem(db, "customers") == 2


def test_mesmo_nome_com_telefone_diferente_e_outra_pessoa(api, db):
    """Homônimos existem: nome sozinho não junta cadastros."""
    a = _salvar(api, cliente={"nome": "José Santos", "tel": "(11) 91111-1111"})
    b = _salvar(api, cliente={"nome": "José Santos", "tel": "(11) 92222-2222"}, veiculo={"placa": "XYZ9K88"})
    assert a["vinculo"]["customer_id"] != b["vinculo"]["customer_id"]
    assert _contagem(db, "customers") == 2


def test_pai_e_filho_com_mesmo_telefone_nao_se_juntam(api, db):
    pai = _salvar(api, cliente={"nome": "João Silva", "tel": "(11) 99999-0000"})
    filho = _salvar(api, cliente={"nome": "João Silva Neto", "tel": "(11) 99999-0000"}, veiculo={"placa": "XYZ9K88"})
    assert pai["vinculo"]["customer_id"] != filho["vinculo"]["customer_id"]


# ── Placa de outro dono (carro vendido) ───────────────────────────────────────

def test_placa_no_nome_de_outro_nao_troca_o_dono_e_avisa(api, db):
    antigo = _salvar(api, cliente={"nome": "João da Silva", "tel": "(11) 99999-0000"})
    novo = _salvar(api, cliente={"nome": "Maria Souza", "tel": "(21) 97777-6666"})
    assert novo["vinculo"]["vehicle_id"] == antigo["vinculo"]["vehicle_id"]       # mesmo carro
    assert novo["vinculo"]["customer_id"] != antigo["vinculo"]["customer_id"]     # a OS é da Maria
    assert any("João da Silva" in a for a in novo["vinculo"]["avisos"])
    cur = db.cursor()
    cur.execute("select customer_id from customer_vehicles where id=%s", (antigo["vinculo"]["vehicle_id"],))
    assert str(cur.fetchone()[0]) == antigo["vinculo"]["customer_id"]            # dono do carro não mudou sozinho
    assert _contagem(db, "veiculos") == 1


# ── Escolha explícita pela tela ───────────────────────────────────────────────

def test_cliente_escolhido_na_sugestao_vale_mesmo_com_dados_diferentes(api, db):
    existente = _salvar(api)
    r = _salvar(api, cliente={"id": existente["vinculo"]["customer_id"], "nome": "Nome Diferente",
                              "tel": "(31) 90000-0000"}, veiculo={"placa": "XYZ9K88"})
    assert r["vinculo"]["customer_id"] == existente["vinculo"]["customer_id"]
    assert not r["vinculo"]["cliente_criado"]


def test_id_de_cliente_de_outra_oficina_e_ignorado(api, api_b, db):
    de_b = _salvar(api_b)["vinculo"]["customer_id"]
    r = _salvar(api, cliente={"id": de_b, "nome": "Pessoa da A", "tel": "(31) 90000-0000"})
    assert r["vinculo"]["customer_id"] != de_b
    assert r["vinculo"]["cliente_criado"]


def test_id_que_nao_e_uuid_e_ignorado_sem_erro(api):
    r = api.post("/ordens", _os(cliente={"id": "'; drop table customers; --"}), format="json")
    assert r.status_code == 201
    assert r.json()["vinculo"]["cliente_criado"]


# ── Isolamento entre oficinas ─────────────────────────────────────────────────

def test_mesma_placa_e_cpf_em_outra_oficina_cadastram_separado(api, api_b, db):
    a = _salvar(api, cliente={"doc": CPF_1})
    b = _salvar(api_b, cliente={"doc": CPF_1})
    assert a["vinculo"]["customer_id"] != b["vinculo"]["customer_id"]
    assert a["vinculo"]["vehicle_id"] != b["vinculo"]["vehicle_id"]
    assert (_contagem(db, "customers", OFICINA_A), _contagem(db, "customers", OFICINA_B)) == (1, 1)
    assert (_contagem(db, "veiculos", OFICINA_A), _contagem(db, "veiculos", OFICINA_B)) == (1, 1)


def test_conta_do_app_fora_da_carteira_nao_e_reaproveitada_nem_revelada(api, db):
    cur = db.cursor()
    cur.execute("insert into customers (name, email, pwhash, phone, cpf, origem) "
                "values ('Ana App','ana@app.com','h','11999990000','52998224725','app') returning id")
    conta = str(cur.fetchone()[0])
    r = _salvar(api, cliente={"nome": "Ana App", "tel": "11999990000", "doc": CPF_1, "email": "ana@app.com"})
    assert r["vinculo"]["customer_id"] != conta
    assert r["vinculo"]["cliente_criado"]


def test_cliente_do_app_na_carteira_e_reaproveitado_por_cpf(api, db):
    cur = db.cursor()
    cur.execute("insert into customers (name, email, pwhash, phone, cpf, origem) "
                "values ('Ana App','ana@app.com','h','11999990000','52998224725','app') returning id")
    conta = str(cur.fetchone()[0])
    cur.execute("insert into oficina_clientes (oficina_doc, customer_id, origem, status, confirmado_em) "
                "values (%s,%s,'convite','ativo', now())", (OFICINA_A, conta))
    r = _salvar(api, cliente={"nome": "Ana", "tel": "(21) 90000-1111", "doc": CPF_1})
    assert r["vinculo"]["customer_id"] == conta and not r["vinculo"]["cliente_criado"]
    # o veículo novo vai para o cliente do app sem virar "da oficina"
    cur.execute("select customer_id, oficina_origem_doc from customer_vehicles where id=%s", (r["vinculo"]["vehicle_id"],))
    assert (str(cur.fetchone()[0]),) == (conta,)


# ── Limites e permissão ───────────────────────────────────────────────────────

def test_sem_ano_cadastra_o_cliente_mas_nao_inventa_o_veiculo(api, db):
    r = _salvar(api, veiculo={"ano": ""})
    v = r["vinculo"]
    assert v["cliente_criado"] and not v["veiculo_criado"] and v["vehicle_id"] is None
    assert any("ano" in a for a in v["avisos"])
    assert _contagem(db, "veiculos") == 0
    # quando o ano é informado no salvamento seguinte, o veículo é cadastrado e a OS passa a apontar para ele
    r2 = api.put(f"/ordens/{r['id']}", _os(), format="json")
    assert r2.json()["vinculo"]["veiculo_criado"] and r2.json()["vinculo"]["customer_id"] == v["customer_id"]


def test_mecanico_nao_cadastra_ninguem(fake, db):
    mecanico = _api("mecanico")
    r = mecanico.post("/ordens", _os(), format="json")
    assert r.status_code == 201
    v = r.json()["vinculo"]
    assert v["customer_id"] is None and v["vehicle_id"] is None
    assert not v["cliente_criado"] and any("cargo" in a for a in v["avisos"])
    assert (_contagem(db, "customers"), _contagem(db, "veiculos")) == (0, 0)


def test_mecanico_ainda_liga_ao_que_ja_existe(api, fake, db):
    existente = _salvar(api)
    r = _api("mecanico").post("/ordens", _os(), format="json")
    assert r.json()["vinculo"]["customer_id"] == existente["vinculo"]["customer_id"]
    assert r.json()["vinculo"]["vehicle_id"] == existente["vinculo"]["vehicle_id"]
    assert (_contagem(db, "customers"), _contagem(db, "veiculos")) == (1, 1)


def test_veiculo_excluido_libera_a_placa_para_novo_cadastro(api, db):
    a = _salvar(api)
    assert api.delete(f"/veiculos/{a['vinculo']['vehicle_id']}").status_code == 204
    b = _salvar(api)
    assert b["vinculo"]["veiculo_criado"] and b["vinculo"]["vehicle_id"] != a["vinculo"]["vehicle_id"]


def test_cliente_arquivado_e_reativado_em_vez_de_duplicado(api, db):
    a = _salvar(api, cliente={"doc": CPF_1})
    assert api.delete(f"/clientes/{a['vinculo']['customer_id']}").status_code == 204
    b = _salvar(api, cliente={"doc": CPF_1}, veiculo={"placa": "XYZ9K88"})
    assert _contagem(db, "customers") == 1                       # não criou outra linha
    assert b["vinculo"]["customer_id"] == a["vinculo"]["customer_id"]


def test_falha_ao_cadastrar_nao_derruba_a_os(api, fake):
    fake.falhar_em[("insert", "customers")] = "42P01"
    r = api.post("/ordens", _os(), format="json")
    assert r.status_code == 201
    assert r.json()["vinculo"]["customer_id"] is None


# ── Corrida: dois salvamentos ao mesmo tempo ──────────────────────────────────

def test_banco_barra_placa_repetida_na_mesma_oficina(db):
    cur = db.cursor()
    cur.execute("insert into customer_vehicles (brand, model, year, plate, oficina_origem_doc) "
                "values ('', 'Gol', 2015, 'ABC-1D23', %s)", (OFICINA_A,))
    with pytest.raises(psycopg2.errors.UniqueViolation):
        cur.execute("insert into customer_vehicles (brand, model, year, plate, oficina_origem_doc) "
                    "values ('', 'Gol', 2015, 'abc1d23', %s)", (OFICINA_A,))


def test_banco_aceita_mesma_placa_em_outra_oficina(db):
    cur = db.cursor()
    for oficina in (OFICINA_A, OFICINA_B):
        cur.execute("insert into customer_vehicles (brand, model, year, plate, oficina_origem_doc) "
                    "values ('', 'Gol', 2015, 'ABC1D23', %s)", (oficina,))


def test_corrida_na_placa_usa_o_veiculo_que_o_outro_salvamento_criou(api, db):
    """Simula o segundo salvamento: a placa já foi cadastrada depois da conferência, o INSERT falha (23505)
    e o backend devolve o veículo existente em vez de erro ou duplicata."""
    r = _salvar(api)
    criado = r["vinculo"]["vehicle_id"]
    veiculo, motivo, novo = cad._criar_veiculo(OFICINA_A, {"placa": "ABC1D23", "modelo": "Corolla", "ano": "2018"},
                                               {}, None, "OS X")
    assert str(veiculo["id"]) == criado and motivo is None and novo is False
    assert _contagem(db, "veiculos") == 1
