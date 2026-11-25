"""Busca global (GET /busca): SQL real (Postgres descartável) + views. Isolamento por oficina, permissões por grupo,
acento/caixa, relevância e resiliência a falha de um grupo."""
import json

import django
import pytest

django.setup()

from postgrest.exceptions import APIError  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from orders import agendamentos_views, busca_views, carteira, clientes_views, estoque_views, veiculos_views, views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402


def _api(cargo="dono", oficina=OFICINA_A, permissoes=None):
    c = APIClient()
    token = make_jwt({"tipo": cargo, "nome": f"{cargo}-{oficina[:2]}", "oficina_doc": oficina,
                      "permissoes": permissoes_do_cargo(cargo) if permissoes is None else permissoes}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (views, carteira, clientes_views, veiculos_views, agendamentos_views, estoque_views, busca_views):
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


def _cliente(api, nome, **extra):
    r = api.post("/clientes", {"nome": nome, **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _veiculo(api, placa="ABC-1D23", marca="VW", modelo="Gol", **extra):
    corpo = {"placa": placa, "marca": marca, "modelo": modelo, "ano": 2018, **extra}
    r = api.post("/veiculos", corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _ordem(db, oid, os_num, cliente, placa, modelo="Gol", oficina=OFICINA_A, status="em_orcamento", criada="2026-11-10"):
    db.cursor().execute(
        "insert into ordens (id, created_at, updated_at, os_num, placa, modelo, cliente, status, payload, oficina_doc) "
        "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (oid, f"{criada}T10:00:00Z", f"{criada}T10:00:00Z", os_num, placa, modelo, cliente, status,
         json.dumps({}), oficina))


def _buscar(api, q):
    r = api.get("/busca", {"q": q})
    assert r.status_code == 200, r.content
    return r.json()


def _titulos(resposta, grupo):
    return [i["titulo"] for i in resposta[grupo]["itens"]]


# ── Regras gerais ─────────────────────────────────────────────────────────────

def test_exige_login(fake):
    assert APIClient().get("/busca", {"q": "ana"}).status_code in (401, 403)


def test_texto_curto_ou_vazio_nao_consulta(api):
    _cliente(api, "Ana Paula")
    assert _buscar(api, "") == {}
    assert _buscar(api, "a") == {}
    assert _buscar(api, "   ") == {}


def test_sem_nenhum_modulo_visivel_e_403(fake):
    r = _api(permissoes=["estoque.ver"]).get("/busca", {"q": "ana"})
    assert r.status_code == 403


# ── Clientes ──────────────────────────────────────────────────────────────────

def test_cliente_ignora_acento_e_caixa(api):
    _cliente(api, "José Antônio Souza")
    for q in ("jose", "JOSÉ", "antonio", "jose souza"):
        r = _buscar(api, q)
        assert _titulos(r, "clientes") == ["José Antônio Souza"], q
    assert _buscar(api, "maria")["clientes"] == {"itens": [], "total": 0}


def test_cliente_por_telefone_cpf_e_email(api):
    c = _cliente(api, "Carlos Eduardo", cpfCnpj="529.982.247-25", telefone="(11) 99999-0000", email="carlos@exemplo.com")
    for q in ("99999", "(11) 99999-0000", "52998224725", "529.982", "carlos@exemplo"):
        itens = _buscar(api, q)["clientes"]["itens"]
        assert [i["id"] for i in itens] == [c["id"]], q
    assert itens[0] == {"tipo": "cliente", "id": c["id"], "titulo": "Carlos Eduardo", "subtitulo": "(11) 99999-0000"}


def test_cliente_prefixo_vem_antes_de_trecho(api):
    _cliente(api, "Mariana Costa")
    _cliente(api, "Ana Maria Lima")
    assert _titulos(_buscar(api, "maria"), "clientes") == ["Mariana Costa", "Ana Maria Lima"]


def test_cliente_arquivado_nao_aparece(api):
    c = _cliente(api, "Paulo Arquivado")
    assert api.delete(f"/clientes/{c['id']}").status_code in (200, 204)
    assert _buscar(api, "paulo")["clientes"]["total"] == 0


def test_limite_por_grupo_e_total(api):
    for n in range(8):
        _cliente(api, f"Cliente Teste {n}")
    r = _buscar(api, "cliente teste")["clientes"]
    assert len(r["itens"]) == busca_views.LIMITE_POR_GRUPO and r["total"] == 8


# ── Veículos ──────────────────────────────────────────────────────────────────

def test_veiculo_por_placa_em_qualquer_formato(api):
    v = _veiculo(api, placa="ABC-1D23")
    for q in ("ABC1D23", "abc-1d23", "abc1d", "ABC"):
        itens = _buscar(api, q)["veiculos"]["itens"]
        assert [i["id"] for i in itens] == [v["id"]], q
    assert itens[0]["titulo"] == "ABC1D23 · VW Gol"


def test_veiculo_por_modelo_e_mostra_o_dono(api):
    dono = _cliente(api, "Fernanda Lopes")
    v = _veiculo(api, placa="DEF-4567", marca="Fiat", modelo="Uno Mille", proprietario={"clienteId": dono["id"]})
    itens = _buscar(api, "uno mille")["veiculos"]["itens"]
    assert [i["id"] for i in itens] == [v["id"]]
    assert "Fernanda Lopes" in itens[0]["subtitulo"] and "2018" in itens[0]["subtitulo"]


def test_veiculo_excluido_nao_aparece(api):
    v = _veiculo(api, placa="GHI-7890")
    assert api.delete(f"/veiculos/{v['id']}").status_code in (200, 204)
    assert _buscar(api, "ghi7890")["veiculos"]["total"] == 0


# ── Ordens de serviço ─────────────────────────────────────────────────────────

def test_ordem_por_numero_cliente_e_placa(api, db):
    _ordem(db, "os-1", "OS-0042", "Roberto Dias", "JKL1M23", "Corsa")
    for q in ("OS-0042", "0042", "roberto", "jkl1m23", "corsa"):
        itens = _buscar(api, q)["ordens"]["itens"]
        assert [i["id"] for i in itens] == ["os-1"], q
    assert itens[0] == {"tipo": "ordem", "id": "os-1", "titulo": "OS OS-0042",
                        "subtitulo": "Roberto Dias · JKL1M23 Corsa", "status": "em_orcamento"}


def test_ordem_mais_nova_desempata(api, db):
    _ordem(db, "os-velha", "1", "Cliente Igual", "AAA1A11", criada="2026-10-01")
    _ordem(db, "os-nova", "2", "Cliente Igual", "BBB2B22", criada="2026-11-20")
    assert [i["id"] for i in _buscar(api, "cliente igual")["ordens"]["itens"]] == ["os-nova", "os-velha"]


# ── Isolamento por oficina ────────────────────────────────────────────────────

def test_oficina_b_nao_ve_dados_da_a(api, api_b, db):
    _cliente(api, "Segredo da Oficina A")
    _veiculo(api, placa="ZZZ-9Z99", modelo="Segredo")
    _ordem(db, "os-a", "A1", "Segredo da Oficina A", "ZZZ9Z99", "Segredo")
    resposta = _buscar(api_b, "segredo")
    assert [resposta[g]["total"] for g in ("clientes", "veiculos", "ordens")] == [0, 0, 0]
    assert _buscar(api_b, "zzz9z99")["veiculos"]["total"] == 0
    # e a A continua vendo
    assert _buscar(api, "segredo")["ordens"]["total"] == 1


# ── Permissões por grupo ──────────────────────────────────────────────────────

def test_cada_grupo_so_com_a_sua_permissao(api, db):
    _cliente(api, "Ana Grupo")
    _ordem(db, "os-g", "G1", "Ana Grupo", "GGG1G11")
    so_clientes = _buscar(_api(permissoes=["clientes.ver"]), "ana grupo")
    assert set(so_clientes) == {"clientes", "veiculos"}
    so_ordens = _buscar(_api(permissoes=["ordens.ver"]), "ana grupo")
    assert set(so_ordens) == {"ordens"}
    todos = _buscar(_api(cargo="mecanico"), "ana grupo")
    assert set(todos) == {"clientes", "veiculos", "ordens"}


# ── Resiliência ───────────────────────────────────────────────────────────────

def test_falha_em_ordens_nao_derruba_clientes(api, monkeypatch):
    _cliente(api, "Ana Resiliente")

    def quebra(_oficina_doc):
        raise APIError({"message": "column ordens.oficina_doc does not exist", "code": "42703"})

    monkeypatch.setattr(busca_views, "_ordens_da_oficina", quebra)
    r = _buscar(api, "resiliente")
    assert _titulos(r, "clientes") == ["Ana Resiliente"]
    assert "ordens" not in r and r["indisponiveis"] == ["ordens"]
