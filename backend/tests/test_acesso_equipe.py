"""Acesso da equipe: código curto da oficina (admins.codigo_acesso, migração 0006) e o link /f/<código>."""
import re

import django
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import acesso_equipe_views as av  # noqa: E402
from orders import orcamento_link_views as lv  # noqa: E402
from orders import views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402

FORMATO = re.compile(r"^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$")


def _api(cargo="dono", oficina=OFICINA_A):
    c = APIClient()
    token = make_jwt({"tipo": cargo, "nome": f"{cargo}-{oficina[:2]}", "oficina_doc": oficina, "doc": oficina,
                      "permissoes": permissoes_do_cargo(cargo)}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (views, av):
        monkeypatch.setattr(modulo, "supabase", f)
    lv._marcas.clear()
    yield f
    lv._marcas.clear()
    f.close()


@pytest.fixture()
def api(fake):
    return _api()


@pytest.fixture()
def publico(fake):
    return APIClient()      # sem credenciais: é o aparelho do funcionário


def test_sem_codigo_gerado_vem_null(api):
    r = api.get("/oficina/acesso-equipe")
    assert r.status_code == 200 and r.json() == {"codigo": None}


def test_gera_codigo_no_formato_e_devolve_o_mesmo_nas_proximas(api):
    r = api.post("/oficina/acesso-equipe", {}, format="json")
    assert r.status_code == 201
    codigo = r.json()["codigo"]
    assert FORMATO.match(codigo)
    de_novo = api.post("/oficina/acesso-equipe", {}, format="json")
    assert de_novo.status_code == 200 and de_novo.json()["codigo"] == codigo
    assert api.get("/oficina/acesso-equipe").json()["codigo"] == codigo


def test_renovar_troca_o_codigo_e_o_antigo_para_de_valer(api, publico):
    antigo = api.post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    novo = api.post("/oficina/acesso-equipe", {"renovar": True}, format="json").json()["codigo"]
    assert novo != antigo and FORMATO.match(novo)
    assert publico.get(f"/publico/oficina/{antigo}").status_code == 404
    assert publico.get(f"/publico/oficina/{novo}").status_code == 200


def test_desativar_apaga_o_codigo(api, publico):
    codigo = api.post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    assert api.delete("/oficina/acesso-equipe").status_code == 204
    assert api.get("/oficina/acesso-equipe").json() == {"codigo": None}
    assert publico.get(f"/publico/oficina/{codigo}").status_code == 404


def test_cada_oficina_tem_o_seu_codigo(api, publico):
    a = api.post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    b = _api(oficina=OFICINA_B).post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    assert a != b
    assert publico.get(f"/publico/oficina/{a}").json()["oficinaDoc"] == OFICINA_A
    assert publico.get(f"/publico/oficina/{b}").json()["oficinaDoc"] == OFICINA_B
    assert _api(oficina=OFICINA_B).get("/oficina/acesso-equipe").json()["codigo"] == b


def test_publico_devolve_so_o_documento_e_o_nome(api, publico):
    codigo = api.post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    r = publico.get(f"/publico/oficina/{codigo}")
    assert r.status_code == 200
    assert r.json() == {"oficinaDoc": OFICINA_A, "nome": "Oficina A"}
    assert r["Cache-Control"] == "no-store" and r["X-Robots-Tag"] == "noindex"


def test_publico_aceita_minuscula_hifen_e_espaco(api, publico):
    codigo = api.post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    digitado = f"{codigo[:4].lower()}-{codigo[4:].lower()}"
    assert publico.get(f"/publico/oficina/{digitado}").status_code == 200
    assert publico.get(f"/publico/oficina/{codigo[:4]}%20{codigo[4:]}").status_code == 200


@pytest.mark.parametrize("lixo", ["ABC", "ABCDEFGHI", "ABCD0OIL", "ÁÉÍÓÚÇÃÕ", "ABCD-EFG", "........"])
def test_publico_formato_invalido_e_404_sem_tocar_no_banco(publico, monkeypatch, lixo):
    class Explode:
        def table(self, *_a, **_k):
            raise AssertionError("não devia consultar o banco")
    monkeypatch.setattr(av, "supabase", Explode())
    assert publico.get(f"/publico/oficina/{lixo}").status_code == 404


def test_codigo_inexistente_e_404_igual_ao_desativado(publico):
    r = publico.get("/publico/oficina/ABCD2345")
    assert r.status_code == 404 and r.json() == {"detail": "Código inválido ou desativado."}


def test_publico_limita_tentativas_por_ip(publico):
    for _ in range(av.CONSULTAS_POR_IP):
        assert publico.get("/publico/oficina/ABCD2345").status_code == 404
    r = publico.get("/publico/oficina/ABCD2345")
    assert r.status_code == 429 and r["Retry-After"] == "60"


@pytest.mark.parametrize("cargo", ["gerente", "mecanico", "atendente"])
def test_so_quem_gerencia_funcionarios_mexe_no_codigo(fake, cargo):
    api = _api(cargo)
    assert api.get("/oficina/acesso-equipe").status_code == 403
    assert api.post("/oficina/acesso-equipe", {}, format="json").status_code == 403
    assert api.delete("/oficina/acesso-equipe").status_code == 403


def test_sem_login_nao_mexe_no_codigo(publico):
    assert publico.get("/oficina/acesso-equipe").status_code == 401
    assert publico.post("/oficina/acesso-equipe", {}, format="json").status_code == 401


def test_fluxo_completo_codigo_lista_nomes_e_login(api, publico, fake):
    """O que o aparelho novo faz: código → oficina → lista de nomes (a rota que já existia)."""
    codigo = api.post("/oficina/acesso-equipe", {}, format="json").json()["codigo"]
    oficina = publico.get(f"/publico/oficina/{codigo}").json()["oficinaDoc"]
    fake.table("funcionarios").insert({"oficina_doc": oficina, "nome": "João", "email": "joao@x.com",
                                       "cargo": "mecanico"}).execute()
    r = publico.get(f"/funcionarios/publicos?oficina_doc={oficina}")
    assert r.status_code == 200 and [f["nome"] for f in r.json()] == ["João"]


def test_coluna_ausente_responde_503_claro(api, publico, fake, monkeypatch):
    from postgrest.exceptions import APIError

    class SemColuna:
        def table(self, *_a, **_k):
            raise APIError({"code": "42703", "message": "column admins.codigo_acesso does not exist"})
    monkeypatch.setattr(av, "supabase", SemColuna())
    r = api.get("/oficina/acesso-equipe")
    assert r.status_code == 503 and "0006_codigo_acesso_equipe.sql" in r.json()["detail"]
    assert publico.get("/publico/oficina/ABCD2345").status_code == 503
