"""Carteira de clientes, veículos, agendamentos e convites: SQL real (Postgres descartável) + views."""
import django
import psycopg2
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import agendamentos_views, carteira, clientes_views, estoque_views, veiculos_views, views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import BACKEND_DIR, OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402

SEM_ID = "00000000-0000-0000-0000-000000000000"
CPF_1 = "529.982.247-25"          # CPFs/CNPJ válidos (dígito verificador correto)
CPF_2 = "111.444.777-35"
CNPJ_1 = "11.222.333/0001-81"


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


def _cliente(api, **extra):
    corpo = {"nome": "Carlos Eduardo", "cpfCnpj": CPF_1, "telefone": "(11) 99999-0000",
             "email": "Carlos@Exemplo.com", "endereco": "Rua A, 10", "observacoes": "Cliente antigo"}
    corpo.update(extra)
    r = api.post("/clientes", corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _conta_app(db, nome="Ana App", email="ana@app.com"):
    cur = db.cursor()
    cur.execute("insert into customers (name, email, pwhash, phone, origem) values (%s,%s,'h','11988887777','app') returning id",
                (nome, email))
    return str(cur.fetchone()[0])


def _vincular(db, oficina, customer_id):
    cur = db.cursor()
    cur.execute("insert into oficina_clientes (oficina_doc, customer_id, origem, status, confirmado_em) "
                "values (%s,%s,'convite','ativo', now())", (oficina, customer_id))


def _veiculo(api, **extra):
    corpo = {"placa": "ABC-1D23", "marca": "VW", "modelo": "Gol", "ano": 2018, "cor": "Prata",
             "categoria": "hatch", "quilometragem": 54000, "combustivel": "Flex", "cambio": "Manual", "portas": 4}
    corpo.update(extra)
    r = api.post("/veiculos", corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _agendamento(api, **extra):
    corpo = {"data": "2026-11-10", "horaInicio": "09:00", "horaFim": "10:30", "cliente": "Carlos Eduardo",
             "veiculo": "VW Gol", "placa": "abc1d23", "titulo": "Revisão", "descricao": "40.000km"}
    corpo.update(extra)
    r = api.post("/agendamentos", corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


# ── Migração ──────────────────────────────────────────────────────────────────

def test_migracao_0001_torna_oficina_doc_obrigatoria(pg_dsn):
    conn = psycopg2.connect(pg_dsn)  # transação descartável: nada vaza para os outros testes
    try:
        cur = conn.cursor()
        cur.execute("delete from ordens")
        cur.execute("select is_nullable from information_schema.columns where table_name='ordens' and column_name='oficina_doc'")
        assert cur.fetchone() == ("YES",)
        cur.execute((BACKEND_DIR / "sql/migrations/0001_limpeza_segura.sql").read_text(encoding="utf-8"))
        cur.execute("select is_nullable from information_schema.columns where table_name='ordens' and column_name='oficina_doc'")
        assert cur.fetchone() == ("NO",)
    finally:
        conn.rollback()
        conn.close()


# ── Clientes ──────────────────────────────────────────────────────────────────

def test_cadastra_cliente_de_balcao(api, db):
    c = _cliente(api)
    assert c["nome"] == "Carlos Eduardo"
    assert c["cpfCnpj"] == "52998224725"          # só dígitos
    assert c["email"] == "carlos@exemplo.com"     # minúsculo
    assert c["origem"] == "oficina" and c["temConta"] is False
    assert c["observacoes"] == "Cliente antigo"
    cur = db.cursor()
    cur.execute("select oficina_doc, status, origem from oficina_clientes where customer_id=%s", (c["id"],))
    assert cur.fetchall() == [(OFICINA_A, "ativo", "oficina")]


@pytest.mark.parametrize("corpo,campo", [
    ({"nome": "  "}, "nome"),
    ({"nome": "Ok", "cpfCnpj": "123.456.789-00"}, "cpfCnpj"),
    ({"nome": "Ok", "email": "sem-arroba"}, "email"),
    ({"nome": "Ok", "telefone": "9" * 30}, "telefone"),
    ({}, "nome"),
])
def test_cliente_validacao(api, corpo, campo):
    r = api.post("/clientes", corpo, format="json")
    assert r.status_code == 422 and campo in r.json()


def test_cliente_aceita_cnpj_e_so_nome(api):
    assert _cliente(api, nome="Oficina XYZ", cpfCnpj=CNPJ_1, email="")["cpfCnpj"] == "11222333000181"
    assert api.post("/clientes", {"nome": "Só Nome"}, format="json").status_code == 201


def test_cpf_e_email_unicos_por_oficina_mas_nao_entre_oficinas(api, api_b):
    _cliente(api)
    assert api.post("/clientes", {"nome": "Outro", "cpfCnpj": CPF_1}, format="json").status_code == 409
    assert api.post("/clientes", {"nome": "Outro", "email": "carlos@exemplo.com"}, format="json").status_code == 409
    # Outra oficina pode ter o mesmo CPF/e-mail sem colidir e sem saber que existe
    assert _cliente(api_b)["nome"] == "Carlos Eduardo"


def test_email_de_conta_do_app_nao_bloqueia_balcao(api, db):
    _conta_app(db, email="carlos@exemplo.com")
    assert _cliente(api)["email"] == "carlos@exemplo.com"


def test_lista_so_da_propria_oficina(api, api_b):
    a = _cliente(api)
    b = _cliente(api_b, nome="Cliente B", cpfCnpj=CPF_2, email="b@x.com")
    assert [c["id"] for c in api.get("/clientes").json()] == [a["id"]]
    assert [c["id"] for c in api_b.get("/clientes").json()] == [b["id"]]


def test_cliente_de_outra_oficina_e_404_em_tudo(api, api_b):
    a = _cliente(api)
    assert api_b.get(f"/clientes/{a['id']}").status_code == 404
    assert api_b.patch(f"/clientes/{a['id']}", {"nome": "Hack"}, format="json").status_code == 404
    assert api_b.delete(f"/clientes/{a['id']}").status_code == 404
    assert api.get(f"/clientes/{a['id']}").json()["nome"] == "Carlos Eduardo"
    assert api.get(f"/clientes/{SEM_ID}").status_code == 404
    assert api.get("/clientes/nao-e-uuid").status_code == 404


def test_edita_cliente_de_balcao(api):
    a = _cliente(api)
    r = api.patch(f"/clientes/{a['id']}", {"nome": "Carlos E. Oliveira", "telefone": "", "observacoes": "VIP"}, format="json")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["nome"] == "Carlos E. Oliveira" and corpo["observacoes"] == "VIP"
    assert "telefone" not in corpo and corpo["email"] == "carlos@exemplo.com"  # vazio limpa; o resto fica


def test_nao_deixa_trocar_cpf_para_o_de_outro_cliente_da_mesma_oficina(api):
    _cliente(api)
    b = _cliente(api, nome="Bruno", cpfCnpj=CPF_2, email="bruno@x.com")
    r = api.patch(f"/clientes/{b['id']}", {"cpfCnpj": CPF_1}, format="json")
    assert r.status_code == 409


def test_conta_do_app_so_aceita_observacoes(api, db):
    cid = _conta_app(db)
    _vincular(db, OFICINA_A, cid)
    r = api.get(f"/clientes/{cid}")
    assert r.status_code == 200 and r.json()["temConta"] is True and r.json()["origem"] == "app"
    # dado pessoal diferente: bloqueado
    assert api.patch(f"/clientes/{cid}", {"nome": "Outro Nome"}, format="json").status_code == 403
    # formulário reenvia tudo igual + observação nova: aceito
    ok = api.patch(f"/clientes/{cid}", {"nome": "Ana App", "email": "ana@app.com", "observacoes": "Prefere manhã"}, format="json")
    assert ok.status_code == 200 and ok.json()["observacoes"] == "Prefere manhã"


def test_excluir_arquiva_e_recadastrar_reativa(api, db):
    a = _cliente(api)
    assert api.delete(f"/clientes/{a['id']}").status_code == 204
    assert api.get("/clientes").json() == []
    assert api.get(f"/clientes/{a['id']}").status_code == 404
    cur = db.cursor()
    cur.execute("select status, revogado_por from oficina_clientes where customer_id=%s", (a["id"],))
    assert cur.fetchone() == ("revogado", "oficina")
    r = api.post("/clientes", {"nome": "Carlos Voltou", "cpfCnpj": CPF_1}, format="json")
    assert r.status_code == 200 and r.json()["id"] == a["id"] and r.json()["nome"] == "Carlos Voltou"
    cur.execute("select count(*) from customers where cpf='52998224725'")
    assert cur.fetchone() == (1,)  # não duplicou


def test_clientes_permissoes(fake):
    assert _api("mecanico").get("/clientes").status_code == 200
    assert _api("mecanico").post("/clientes", {"nome": "X"}, format="json").status_code == 403
    assert _api("atendente").post("/clientes", {"nome": "X"}, format="json").status_code == 201
    assert APIClient().get("/clientes").status_code == 401


def test_tabela_inexistente_vira_503(api, fake):
    fake.falhar_em[("select", "oficina_clientes")] = "42P01"
    r = api.get("/clientes")
    assert r.status_code == 503 and "migrations" in r.json()["detail"]


# ── Convites ──────────────────────────────────────────────────────────────────

def test_convite_ciclo_completo(api, api_b, db):
    r = api.post("/clientes/convites", {"dias": 3, "maxUsos": 2}, format="json")
    assert r.status_code == 201
    conv = r.json()
    assert conv["ativo"] is True and conv["maxUsos"] == 2 and conv["usos"] == 0 and conv["codigo"] == conv["id"]
    assert [c["id"] for c in api.get("/clientes/convites").json()] == [conv["id"]]
    assert api_b.get("/clientes/convites").json() == []

    # o cliente do app usa o convite (função do banco, chamada pelo backend do app do cliente)
    cid = _conta_app(db)
    cur = db.cursor()
    cur.execute("select oficina_convite_usar(%s,%s)", (conv["id"], cid))
    res = cur.fetchone()[0]
    assert res["ok"] is True and res["novo"] is True and res["oficina_doc"] == OFICINA_A
    ids = [c["id"] for c in api.get("/clientes").json()]
    assert ids == [cid]
    assert api.get("/clientes").json()[0]["temConta"] is True
    assert api_b.get("/clientes").json() == []  # outra oficina não vê
    assert api.get("/clientes/convites").json()[0]["usos"] == 1

    # outra oficina não consegue revogar; a dona consegue; depois ninguém entra
    assert api_b.delete(f"/clientes/convites/{conv['id']}").status_code == 404
    assert api.delete(f"/clientes/convites/{conv['id']}").status_code == 204
    outro = _conta_app(db, nome="Bia", email="bia@app.com")
    cur.execute("select oficina_convite_usar(%s,%s)", (conv["id"], outro))
    assert cur.fetchone()[0]["codigo"] == "convite_invalido"
    assert api.get("/clientes/convites").json()[0]["ativo"] is False


@pytest.mark.parametrize("corpo", [{"dias": 0}, {"dias": 91}, {"dias": "7"}, {"maxUsos": 0}, {"maxUsos": "x"}])
def test_convite_validacao(api, corpo):
    assert api.post("/clientes/convites", corpo, format="json").status_code == 422


def test_convite_so_para_quem_edita_clientes(fake):
    assert _api("mecanico").post("/clientes/convites", {}, format="json").status_code == 403
    assert _api("atendente").post("/clientes/convites", {}, format="json").status_code == 201


def test_oficina_nao_puxa_conta_do_app_pelo_email(api, db):
    # Cadastrar com o e-mail de uma conta do app cria um cadastro de balcão separado: não vincula a conta.
    cid = _conta_app(db, email="ana@app.com")
    novo = _cliente(api, nome="Ana Balcão", cpfCnpj=CPF_2, email="ana@app.com")
    assert novo["id"] != cid and novo["temConta"] is False
    assert cid not in [c["id"] for c in api.get("/clientes").json()]


# ── Veículos ──────────────────────────────────────────────────────────────────

def test_cria_veiculo_com_proprietario_em_texto_cadastra_o_cliente(api, db):
    v = _veiculo(api, proprietario={"nome": "Carlos Eduardo", "docCpfCnpj": CPF_1, "telefone": "11999990000"})
    assert v["placa"] == "ABC1D23" and v["marca"] == "VW" and v["ano"] == 2018
    assert v["proprietario"]["nome"] == "Carlos Eduardo" and v["proprietario"]["docCpfCnpj"] == "52998224725"
    assert v["status"] == "disponivel" and v["fotosAdicionais"] == []
    clientes = api.get("/clientes").json()
    assert [c["id"] for c in clientes] == [v["proprietario"]["clienteId"]]
    # segundo veículo do mesmo CPF reaproveita o cliente
    v2 = _veiculo(api, placa="DEF-4G56", modelo="Uno", proprietario={"nome": "Carlos E.", "docCpfCnpj": CPF_1})
    assert v2["proprietario"]["clienteId"] == v["proprietario"]["clienteId"]
    assert len(api.get("/clientes").json()) == 1


def test_veiculo_sem_proprietario_e_da_oficina(api, api_b, db):
    v = _veiculo(api)
    assert v["proprietario"] is None
    cur = db.cursor()
    cur.execute("select customer_id, oficina_origem_doc from customer_vehicles where id=%s", (v["id"],))
    assert cur.fetchone() == (None, OFICINA_A)
    assert [x["id"] for x in api.get("/veiculos").json()] == [v["id"]]
    assert api_b.get("/veiculos").json() == []
    assert api_b.get(f"/veiculos/{v['id']}").status_code == 404
    assert api_b.patch(f"/veiculos/{v['id']}", {"cor": "x"}, format="json").status_code == 404
    assert api_b.delete(f"/veiculos/{v['id']}").status_code == 404


def test_proprietario_em_branco_do_formulario_vira_sem_dono(api):
    assert _veiculo(api, proprietario={"nome": "  "})["proprietario"] is None


@pytest.mark.parametrize("corpo,campo", [
    ({"placa": "XX"}, "placa"), ({"placa": ""}, "placa"), ({"marca": ""}, "marca"), ({"modelo": " "}, "modelo"),
    ({"ano": 1800}, "ano"), ({"ano": "abc"}, "ano"), ({"categoria": "foguete"}, "categoria"),
    ({"cambio": "Roda"}, "cambio"), ({"portas": 12}, "portas"), ({"quilometragem": -1}, "quilometragem"),
])
def test_veiculo_validacao(api, corpo, campo):
    base = {"placa": "ABC1D23", "marca": "VW", "modelo": "Gol", "ano": 2018}
    r = api.post("/veiculos", {**base, **corpo}, format="json")
    assert r.status_code == 422 and campo in r.json()


def test_placa_duplicada_na_oficina_409_mesmo_formatada_diferente(api):
    _veiculo(api, placa="ABC-1D23")
    assert api.post("/veiculos", {"placa": "abc1d23", "marca": "X", "modelo": "Y", "ano": 2020}, format="json").status_code == 409


def test_veiculos_de_cliente_do_app_aparecem_so_se_estiver_na_carteira(api, db):
    dentro, fora = _conta_app(db), _conta_app(db, nome="Zé", email="ze@app.com")
    _vincular(db, OFICINA_A, dentro)
    cur = db.cursor()
    for dono, placa in ((dentro, "AAA1A11"), (fora, "BBB2B22")):
        cur.execute("insert into customer_vehicles (customer_id, brand, model, year, plate) values (%s,'Fiat','Uno',2015,%s)",
                    (dono, placa))
    assert [v["placa"] for v in api.get("/veiculos").json()] == ["AAA1A11"]
    assert api.get("/veiculos").json()[0]["proprietario"]["clienteId"] == dentro


def test_edita_veiculo_e_troca_de_dono(api, db):
    v = _veiculo(api, proprietario={"nome": "Carlos", "docCpfCnpj": CPF_1})
    novo = _cliente(api, nome="Bruno", cpfCnpj=CPF_2, email="bruno@x.com")
    r = api.patch(f"/veiculos/{v['id']}", {"quilometragem": 60000, "cor": "Preto", "proprietario": {"clienteId": novo["id"]}}, format="json")
    assert r.status_code == 200
    assert r.json()["quilometragem"] == 60000 and r.json()["proprietario"]["clienteId"] == novo["id"]
    # dono fora da carteira / inexistente: 422
    fora = _conta_app(db)
    assert api.patch(f"/veiculos/{v['id']}", {"proprietario": {"clienteId": fora}}, format="json").status_code == 422
    assert api.patch(f"/veiculos/{v['id']}", {"proprietario": {"clienteId": SEM_ID}}, format="json").status_code == 422
    # sem dono
    assert api.patch(f"/veiculos/{v['id']}", {"proprietario": None}, format="json").json()["proprietario"] is None


def test_exclui_veiculo_soft_e_status_vem_da_os(api, db):
    v = _veiculo(api)
    cur = db.cursor()
    cur.execute("insert into ordens (id, created_at, updated_at, status, payload, oficina_doc, vehicle_id) "
                "values ('os-1','2026-10-01T10:00:00Z','2026-10-01T10:00:00Z','pendente_aprovacao','{}',%s,%s)", (OFICINA_A, v["id"]))
    got = api.get(f"/veiculos/{v['id']}").json()
    assert got["status"] == "aguardando_aprovacao" and got["ultimaOSId"] == "os-1"
    cur.execute("update ordens set status='em_execucao'")
    assert api.get(f"/veiculos/{v['id']}").json()["status"] == "na_oficina"
    cur.execute("update ordens set status='finalizada'")
    assert api.get(f"/veiculos/{v['id']}").json()["status"] == "disponivel"
    assert api.delete(f"/veiculos/{v['id']}").status_code == 204
    assert api.get("/veiculos").json() == [] and api.get(f"/veiculos/{v['id']}").status_code == 404
    cur.execute("select deleted, is_active from customer_vehicles where id=%s", (v["id"],))
    assert cur.fetchone() == (True, False)  # continua no banco


def test_veiculos_permissoes(fake):
    assert _api("mecanico").get("/veiculos").status_code == 200
    assert _api("mecanico").post("/veiculos", {"placa": "ABC1D23", "marca": "a", "modelo": "b", "ano": 2020}, format="json").status_code == 403


# ── Agendamentos ──────────────────────────────────────────────────────────────

def test_cria_agendamento_por_texto_cadastra_cliente(api):
    a = _agendamento(api)
    assert a["status"] == "agendado" and a["horaInicio"] == "09:00" and a["horaFim"] == "10:30"
    assert a["cliente"] == "Carlos Eduardo" and a["veiculo"] == "VW Gol" and a["placa"] == "ABC1D23"
    assert a["titulo"] == "Revisão" and a["clienteId"]
    assert [c["nome"] for c in api.get("/clientes").json()] == ["Carlos Eduardo"]
    # mesmo nome de novo: reaproveita (não duplica)
    _agendamento(api, horaInicio="14:00", horaFim="15:00")
    assert len(api.get("/clientes").json()) == 1


def test_agendamento_acha_veiculo_pela_placa(api):
    v = _veiculo(api, proprietario={"nome": "Carlos", "docCpfCnpj": CPF_1})
    a = _agendamento(api, cliente="qualquer nome digitado", veiculo="", placa="ABC-1D23")
    assert a["veiculoId"] == v["id"] and a["clienteId"] == v["proprietario"]["clienteId"]
    assert a["cliente"] == "Carlos" and a["veiculo"] == "VW Gol"


def test_nome_ambiguo_pede_desambiguar(api):
    _cliente(api, nome="João Silva", cpfCnpj=CPF_1, email="j1@x.com")
    _cliente(api, nome="João Silva", cpfCnpj=CPF_2, email="j2@x.com")
    r = api.post("/agendamentos", {"data": "2026-11-10", "horaInicio": "09:00", "horaFim": "10:00",
                                   "cliente": "João Silva", "titulo": "X"}, format="json")
    assert r.status_code == 409 and len(r.json()["candidatos"]) == 2
    ok = api.post("/agendamentos", {"data": "2026-11-10", "horaInicio": "09:00", "horaFim": "10:00",
                                    "clienteId": r.json()["candidatos"][0]["id"], "titulo": "X"}, format="json")
    assert ok.status_code == 201


@pytest.mark.parametrize("corpo,campo", [
    ({"data": "10/11/2026"}, "data"), ({"horaInicio": "9h"}, "horaInicio"), ({"horaFim": "09:00"}, "horaFim"),
    ({"horaFim": "08:00"}, "horaFim"), ({"titulo": ""}, "titulo"), ({"cliente": ""}, "cliente"),
    ({"mecanico": "Fantasma"}, "mecanico"),
])
def test_agendamento_validacao(api, corpo, campo):
    base = {"data": "2026-11-10", "horaInicio": "09:00", "horaFim": "10:30", "cliente": "Carlos", "titulo": "Revisão"}
    r = api.post("/agendamentos", {**base, **corpo}, format="json")
    assert r.status_code == 422 and campo in r.json()


def test_agendamento_com_mecanico_da_oficina(api, db):
    cur = db.cursor()
    cur.execute("insert into funcionarios (oficina_doc, nome, email, cargo) values (%s,'André S.','andre@x.com','mecanico') returning id", (OFICINA_A,))
    cur.execute("insert into funcionarios (oficina_doc, nome, email, cargo) values (%s,'Beto','beto@x.com','mecanico')", (OFICINA_B,))
    assert _agendamento(api, mecanico="andré s.")["mecanico"] == "André S."
    assert api.post("/agendamentos", {"data": "2026-11-10", "horaInicio": "09:00", "horaFim": "10:00", "cliente": "X",
                                      "titulo": "Y", "mecanico": "Beto"}, format="json").status_code == 422  # de outra oficina


def test_lista_filtra_e_isola_por_oficina(api, api_b):
    a1 = _agendamento(api, data="2026-11-10")
    a2 = _agendamento(api, data="2026-11-20", horaInicio="10:00", horaFim="11:00")
    _agendamento(api_b, cliente="Cliente B", placa="ZZZ9Z99")
    assert [x["id"] for x in api.get("/agendamentos").json()] == [a2["id"], a1["id"]]
    assert [x["id"] for x in api.get("/agendamentos?de=2026-11-15").json()] == [a2["id"]]
    assert [x["id"] for x in api.get("/agendamentos?ate=2026-11-15").json()] == [a1["id"]]
    assert api.get("/agendamentos?status=concluido").json() == []
    assert api.get("/agendamentos?status=agendado").json()[0]["status"] == "agendado"
    assert api.get("/agendamentos?de=ontem").status_code == 422
    assert api.get("/agendamentos?status=voando").status_code == 422
    assert api_b.get(f"/agendamentos/{a1['id']}").status_code == 404
    assert api_b.patch(f"/agendamentos/{a1['id']}", {"titulo": "x"}, format="json").status_code == 404
    assert api_b.delete(f"/agendamentos/{a1['id']}").status_code == 404


def _pedido_do_app(db, oficina=OFICINA_A, nome="Ana App", email="ana@app.com"):
    """Pedido de agendamento como o app do cliente grava: pendente, ligado à oficina e ao cliente."""
    cid = _conta_app(db, nome=nome, email=email)
    _vincular(db, oficina, cid)
    cur = db.cursor()
    cur.execute("insert into appointments (customer_id, oficina_doc, vehicle_label, service_type, date, time_slot, status) "
                "values (%s,%s,'Fiat Uno 2015 — AAA1A11','Troca de óleo','2026-11-12','08:00','pendente') returning id", (cid, oficina))
    return cid, str(cur.fetchone()[0])


def test_pedido_do_app_aparece_pendente_e_confirmar_avisa_o_cliente(api, db):
    cid, ag_id = _pedido_do_app(db)
    lista = api.get("/agendamentos").json()
    assert lista[0]["id"] == ag_id and lista[0]["status"] == "pendente" and lista[0]["cliente"] == "Ana App"
    assert lista[0]["veiculo"] == "Fiat Uno 2015" and lista[0]["placa"] == "AAA1A11" and lista[0]["horaFim"] == "09:00"
    r = api.patch(f"/agendamentos/{ag_id}", {"status": "agendado"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "agendado"
    cur = db.cursor()
    cur.execute("select status, confirmado_em is not null, confirmado_por_nome from appointments where id=%s", (ag_id,))
    assert cur.fetchone() == ("confirmado", True, "dono-11")
    cur.execute("select title, type, action_url from notifications where customer_id=%s", (cid,))
    assert cur.fetchall() == [("Agendamento confirmado", "agendamento", "/agendamentos")]


def test_recusar_pedido_guarda_motivo_avisa_e_e_final(api, db):
    cid, ag_id = _pedido_do_app(db)
    r = api.patch(f"/agendamentos/{ag_id}", {"status": "recusado", "motivoRecusa": "Sem vaga nesse dia"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "recusado" and r.json()["motivoRecusa"] == "Sem vaga nesse dia"
    cur = db.cursor()
    cur.execute("select message from notifications where customer_id=%s", (cid,))
    assert "Sem vaga nesse dia" in cur.fetchone()[0]
    assert api.patch(f"/agendamentos/{ag_id}", {"status": "agendado"}, format="json").status_code == 409


def test_cliente_de_balcao_nao_recebe_notificacao(api, db):
    a = _agendamento(api)
    api.patch(f"/agendamentos/{a['id']}", {"status": "em_andamento"}, format="json")
    cur = db.cursor()
    cur.execute("select count(*) from notifications")
    assert cur.fetchone() == (0,)


def test_transicoes_de_status(api, db):
    _, pedido = _pedido_do_app(db)
    # pedido não pula direto para execução
    assert api.patch(f"/agendamentos/{pedido}", {"status": "em_andamento"}, format="json").status_code == 409
    a = _agendamento(api)
    for st in ("em_andamento", "aguardando_pagamento", "pronto_retirada", "agendado", "concluido"):
        assert api.patch(f"/agendamentos/{a['id']}", {"status": st}, format="json").json()["status"] == st
    assert api.patch(f"/agendamentos/{a['id']}", {"status": "cancelado"}, format="json").status_code == 409  # concluído é final
    assert api.patch(f"/agendamentos/{a['id']}", {"status": "inventado"}, format="json").status_code == 422


def test_reagendar_guarda_data_anterior(api):
    a = _agendamento(api)
    r = api.patch(f"/agendamentos/{a['id']}", {"data": "2026-11-15", "horaInicio": "13:00", "horaFim": "14:00",
                                               "reagendamento": {"motivo": "Cliente pediu"}}, format="json")
    assert r.status_code == 200
    reag = r.json()["reagendamento"]
    assert reag == {"dataAnterior": "2026-11-10", "novaData": "2026-11-15", "horaAnterior": "09:00",
                    "novaHora": "13:00", "motivo": "Cliente pediu"}
    assert "reagendamento" not in a


def test_horario_fim_antes_do_inicio_no_patch(api):
    a = _agendamento(api)
    assert api.patch(f"/agendamentos/{a['id']}", {"horaFim": "08:00"}, format="json").status_code == 422


def test_ligar_agendamento_a_os_so_da_mesma_oficina(api, db):
    a = _agendamento(api)
    cur = db.cursor()
    for oid, of in (("os-a", OFICINA_A), ("os-b", OFICINA_B)):
        cur.execute("insert into ordens (id, created_at, updated_at, payload, oficina_doc) values (%s,'x','x','{}',%s)", (oid, of))
    assert api.patch(f"/agendamentos/{a['id']}", {"ordemServicoId": "os-a"}, format="json").json()["ordemServicoId"] == "os-a"
    assert api.patch(f"/agendamentos/{a['id']}", {"ordemServicoId": "os-b"}, format="json").status_code == 409
    assert api.patch(f"/agendamentos/{a['id']}", {"ordemServicoId": None}, format="json").status_code == 200


def test_excluir_agendamento_so_se_nao_estiver_ativo(api):
    a = _agendamento(api)
    assert api.delete(f"/agendamentos/{a['id']}").status_code == 409
    api.patch(f"/agendamentos/{a['id']}", {"status": "cancelado"}, format="json")
    assert api.delete(f"/agendamentos/{a['id']}").status_code == 204
    assert api.get(f"/agendamentos/{a['id']}").status_code == 404


def test_agendamentos_permissoes(fake):
    assert _api("mecanico").get("/agendamentos").status_code == 200
    corpo = {"data": "2026-11-10", "horaInicio": "09:00", "horaFim": "10:00", "cliente": "X", "titulo": "Y"}
    assert _api("mecanico").post("/agendamentos", corpo, format="json").status_code == 403
    assert _api("atendente").post("/agendamentos", corpo, format="json").status_code == 201


# ── Banco: o que o app do cliente e o do mecânico não podem quebrar ───────────

def test_app_do_cliente_nao_enxerga_pedido_de_outra_oficina_nem_cliente_de_balcao(api, db):
    _cliente(api)  # balcão
    cid, _ = _pedido_do_app(db)
    cur = db.cursor()
    cur.execute("select count(*) from customers where origem = 'app'")
    assert cur.fetchone() == (1,)
    cur.execute("select count(*) from customers where origem = 'oficina'")
    assert cur.fetchone() == (1,)


def test_banco_barra_os_de_cliente_fora_da_carteira(db):
    cid = _conta_app(db)
    cur = db.cursor()
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        cur.execute("insert into ordens (id, created_at, updated_at, payload, oficina_doc, customer_id) "
                    "values ('os-x','x','x','{}',%s,%s)", (OFICINA_A, cid))


# ── OS ligada à carteira ──────────────────────────────────────────────────────

def _corpo_os(**extra):
    cli = {"nome": "Carlos Eduardo", "doc": CPF_1, "tel": "11999990000"}  # e-mail é opcional: ausente, não vazio
    cli.update(extra.pop("cliente", {}))
    cli = {k: v for k, v in cli.items() if v != ""}
    ve = {"placa": "ABC1D23", "modelo": "Gol"}
    ve.update(extra.pop("veiculo", {}))
    return {"os_header": {"os_num": "OS-1", "data": "2026-10-01"}, "cliente": cli, "veiculo": ve, **extra}


def _os_ids(db, ordem_id):
    cur = db.cursor()
    cur.execute("select customer_id, vehicle_id from ordens where id=%s", (ordem_id,))
    c, v = cur.fetchone()
    return (str(c) if c else None, str(v) if v else None)


def test_os_liga_cliente_e_veiculo_da_carteira(api, db, monkeypatch):
    cli = _cliente(api)
    v = _veiculo(api, proprietario={"clienteId": cli["id"]})
    r = api.post("/ordens", _corpo_os(), format="json")
    assert r.status_code == 201, r.content
    assert _os_ids(db, r.json()["id"]) == (cli["id"], v["id"])
    # o veículo passa a mostrar a OS e o status derivado
    assert api.get(f"/veiculos/{v['id']}").json()["ultimaOSId"] == r.json()["id"]


def test_os_liga_por_email_e_nao_cria_nada_na_carteira(api, db):
    cli = _cliente(api, cpfCnpj="", email="carlos@exemplo.com")
    r = api.post("/ordens", _corpo_os(cliente={"doc": "", "email": "CARLOS@exemplo.com"}, veiculo={"placa": "ZZZ9Z99"}), format="json")
    assert _os_ids(db, r.json()["id"]) == (cli["id"], None)
    assert len(api.get("/veiculos").json()) == 0  # placa desconhecida: não cadastra veículo sozinha


def test_os_nao_liga_cliente_de_outra_oficina_nem_conta_do_app_fora_da_carteira(api, api_b, db):
    _cliente(api_b)                                  # mesmo CPF, mas na oficina B
    _conta_app(db, email="ana@app.com")              # conta do app sem vínculo com a oficina A
    r = api.post("/ordens", _corpo_os(cliente={"email": "ana@app.com"}), format="json")
    assert r.status_code == 201
    assert _os_ids(db, r.json()["id"]) == (None, None)


def test_os_de_cliente_do_app_vinculado_fica_visivel_para_ele(api, db):
    cid = _conta_app(db)
    _vincular(db, OFICINA_A, cid)
    cur = db.cursor()
    cur.execute("update customers set cpf=%s where id=%s", ("52998224725", cid))
    r = api.post("/ordens", _corpo_os(), format="json")
    assert _os_ids(db, r.json()["id"])[0] == cid


def test_editar_os_atualiza_o_vinculo(api, db):
    cli = _cliente(api)
    r = api.post("/ordens", _corpo_os(cliente={"doc": ""}), format="json")
    oid = r.json()["id"]
    assert _os_ids(db, oid) == (None, None)
    r2 = api.put(f"/ordens/{oid}", _corpo_os(), format="json")
    assert r2.status_code == 200, r2.content
    assert _os_ids(db, oid)[0] == cli["id"]


def test_falha_no_vinculo_nao_derruba_a_os(api, fake):
    fake.falhar_em[("select", "oficina_clientes")] = "42P01"
    r = api.post("/ordens", _corpo_os(), format="json")
    assert r.status_code == 201
