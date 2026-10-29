"""Dados da oficina (tela Configurações): GET/PUT /oficina/config sobre admins.config_oficina (migração 0005)."""
import django
import pytest
from postgrest.exceptions import APIError

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import oficina_config_views, views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402

CORPO = {"nome": "Auto Center Silva", "telefone": "(11) 98765-4321", "email": "contato@silva.com.br",
         "endereco": "Rua das Oficinas, 100", "valorHora": 150, "horaAbertura": "07:30", "horaFechamento": "18:00"}


def _api(cargo="dono", oficina=OFICINA_A):
    c = APIClient()
    token = make_jwt({"tipo": cargo, "nome": f"{cargo}-{oficina[:2]}", "oficina_doc": oficina, "doc": oficina,
                      "permissoes": permissoes_do_cargo(cargo)}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (views, oficina_config_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _api()


def test_sem_nada_salvo_vem_o_nome_da_conta_e_o_horario_padrao(api):
    r = api.get("/oficina/config")
    assert r.status_code == 200
    assert r.json() == {"nome": "Oficina A", "cnpj": OFICINA_A, "telefone": "", "email": "", "endereco": "",
                        "valorHora": 0, "horaAbertura": "08:00", "horaFechamento": "19:00",
                        "salvo": False, "atualizadoEm": None}


def test_salva_e_le_de_volta_de_outro_aparelho(api):
    r = api.put("/oficina/config", CORPO, format="json")
    assert r.status_code == 200, r.content
    lido = _api().get("/oficina/config").json()        # outro cliente, mesmo login
    assert {k: lido[k] for k in CORPO} == CORPO
    assert lido["cnpj"] == OFICINA_A and lido["salvo"] is True and lido["atualizadoEm"]


def test_cada_oficina_ve_so_a_sua(api, fake):
    api.put("/oficina/config", CORPO, format="json")
    b = _api(oficina=OFICINA_B).get("/oficina/config").json()
    assert b["nome"] == "Oficina B" and b["salvo"] is False


def test_cnpj_nao_se_edita_por_aqui(api):
    api.put("/oficina/config", {**CORPO, "cnpj": "99999999000199"}, format="json")
    assert api.get("/oficina/config").json()["cnpj"] == OFICINA_A


@pytest.mark.parametrize("mudanca,campo", [
    ({"nome": " x "}, "nome"),
    ({"email": "sem-arroba"}, "email"),
    ({"valorHora": -1}, "valorHora"),
    ({"horaAbertura": "25:00"}, "horaAbertura"),
    ({"horaAbertura": "18:00", "horaFechamento": "08:00"}, "horaFechamento"),
])
def test_validacao(api, mudanca, campo):
    r = api.put("/oficina/config", {**CORPO, **mudanca}, format="json")
    assert r.status_code == 422 and campo in r.json()


def test_so_quem_edita_configuracoes_salva_mas_todos_leem(fake):
    assert _api("mecanico").put("/oficina/config", CORPO, format="json").status_code == 403
    assert _api("mecanico").get("/oficina/config").status_code == 200
    assert _api("gerente").put("/oficina/config", CORPO, format="json").status_code == 200


def test_sem_a_migracao_le_os_padroes_e_salvar_vira_503(api, fake, monkeypatch):
    original = oficina_config_views._admin

    def sem_coluna(oficina_doc, colunas):
        if "config_oficina" in colunas:
            raise APIError({"message": "coluna ausente", "code": "42703"})
        return original(oficina_doc, colunas)
    monkeypatch.setattr(oficina_config_views, "_admin", sem_coluna)
    assert api.get("/oficina/config").json()["salvo"] is False
    fake.falhar_em[("update", "admins")] = "42703"
    r = api.put("/oficina/config", CORPO, format="json")
    assert r.status_code == 503 and "0005" in r.json()["detail"]
