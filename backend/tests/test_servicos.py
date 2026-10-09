"""Testes do Catálogo de Serviços: SQL (funções/constraints) e views (HTTP → SQL real)."""
import django
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import estoque_views, servicos_views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402

SEM_ID = "00000000-0000-0000-0000-000000000000"


def _cliente(cargo="dono", oficina=OFICINA_A):
    c = APIClient()
    token = make_jwt({"tipo": cargo, "nome": cargo, "oficina_doc": oficina,
                      "permissoes": permissoes_do_cargo(cargo)}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    monkeypatch.setattr(servicos_views, "supabase", f)
    monkeypatch.setattr(estoque_views, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


def _servico(api, **extra):
    corpo = {"nome": "Troca de Óleo", "categoria": "Lubrificantes", "preco": 180,
             "duracao": "45 min", "descricao": "Óleo e filtro", "ativo": True}
    corpo.update(extra)
    r = api.post("/servicos", corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


# ── SQL ───────────────────────────────────────────────────────────────────────

def test_sql_constraints(db):
    import psycopg2
    cur = db.cursor()
    for nome, cat, preco in (("", "x", 1), ("a", "  ", 1), ("a", "x", -1)):
        with pytest.raises(psycopg2.errors.CheckViolation):
            cur.execute("insert into servicos (oficina_doc, nome, categoria, preco) values (%s,%s,%s,%s)",
                        (OFICINA_A, nome, cat, preco))
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        cur.execute("insert into servicos (oficina_doc, nome, categoria) values ('0', 'a', 'b')")


def test_sql_updated_at_so_apos_edicao(db):
    cur = db.cursor()
    cur.execute("insert into servicos (oficina_doc, nome, categoria) values (%s,'a','b') returning id, updated_at",
                (OFICINA_A,))
    sid, upd = cur.fetchone()
    assert upd is None
    cur.execute("update servicos set nome='c' where id=%s returning updated_at", (sid,))
    assert cur.fetchone()[0] is not None


def test_sql_excluir_desvincula_kits_da_mesma_oficina_apenas(db):
    cur = db.cursor()
    cur.execute("insert into servicos (oficina_doc, nome, categoria) values (%s,'a','b') returning id", (OFICINA_A,))
    sid = cur.fetchone()[0]
    cur.execute("insert into estoque_kits (oficina_doc, nome, servico_id) values (%s,'KA',%s),(%s,'KB',%s)",
                (OFICINA_A, str(sid), OFICINA_B, str(sid)))
    cur.execute("select servicos_excluir(%s, %s)", (OFICINA_A, str(sid)))
    r = cur.fetchone()[0]
    assert r["ok"] is True and r["kits_desvinculados"] == 1
    cur.execute("select nome, servico_id from estoque_kits order by nome")
    assert cur.fetchall() == [("KA", None), ("KB", str(sid))]  # kit de outra oficina não é tocado
    cur.execute("select count(*) from servicos")
    assert cur.fetchone()[0] == 0


def test_sql_excluir_de_outra_oficina_nao_apaga(db):
    cur = db.cursor()
    cur.execute("insert into servicos (oficina_doc, nome, categoria) values (%s,'a','b') returning id", (OFICINA_A,))
    sid = cur.fetchone()[0]
    cur.execute("select servicos_excluir(%s, %s)", (OFICINA_B, str(sid)))
    r = cur.fetchone()[0]
    assert r["ok"] is False and r["codigo"] == "nao_encontrado"
    cur.execute("select count(*) from servicos")
    assert cur.fetchone()[0] == 1


# ── Views ─────────────────────────────────────────────────────────────────────

def test_sem_token_401(fake):
    assert APIClient().get("/servicos").status_code == 401


def test_permissoes_por_cargo(fake):
    dono = _cliente("dono")
    s = _servico(dono)
    for cargo in ("mecanico", "atendente"):
        c = _cliente(cargo)
        assert c.get("/servicos").status_code == 200
        assert c.get(f"/servicos/{s['id']}").status_code == 200
        assert c.post("/servicos", {"nome": "x"}, format="json").status_code == 403
        assert c.patch(f"/servicos/{s['id']}", {"ativo": False}, format="json").status_code == 403
        assert c.delete(f"/servicos/{s['id']}").status_code == 403
    gerente = _cliente("gerente")
    assert gerente.patch(f"/servicos/{s['id']}", {"ativo": False}, format="json").status_code == 200


def test_criar_e_listar_camelcase(api):
    s = _servico(api)
    assert s["nome"] == "Troca de Óleo" and s["preco"] == 180 and s["ativo"] is True
    assert s["duracao"] == "45 min" and s["descricao"] == "Óleo e filtro"
    assert "createdAt" in s and "updatedAt" not in s
    b = _servico(api, nome="B", preco=99.9)
    lista = api.get("/servicos").json()
    assert [x["id"] for x in lista] == [b["id"], s["id"]]  # mais novo primeiro
    assert lista[0]["preco"] == 99.9


@pytest.mark.parametrize("corpo, campo", [
    ({"nome": ""}, "nome"),
    ({"nome": "   "}, "nome"),
    ({"categoria": ""}, "categoria"),
    ({"preco": -1}, "preco"),
    ({"preco": "abc"}, "preco"),
    ({"nome": "x" * 201}, "nome"),
])
def test_validacoes_422(api, corpo, campo):
    base = {"nome": "N", "categoria": "C", "preco": 10, "duracao": "1h", "descricao": ""}
    base.update(corpo)
    r = api.post("/servicos", base, format="json")
    assert r.status_code == 422
    assert campo in r.json()


def test_nan_rejeitado(api):
    r = api.post("/servicos", '{"nome":"N","categoria":"C","preco":NaN}', content_type="application/json")
    assert r.status_code in (400, 422)
    assert api.get("/servicos").json() == []


def test_campos_opcionais_tem_padrao(api):
    r = api.post("/servicos", {"nome": "N", "categoria": "C", "preco": 5}, format="json")
    assert r.status_code == 201
    out = r.json()
    assert out["duracao"] == "" and out["descricao"] == "" and out["ativo"] is True


def test_patch_mescla_e_toggle_ativo(api):
    s = _servico(api)
    r = api.patch(f"/servicos/{s['id']}", {"ativo": False}, format="json")
    assert r.status_code == 200
    out = r.json()
    assert out["ativo"] is False and out["nome"] == s["nome"] and out["preco"] == 180
    assert "updatedAt" in out
    r = api.patch(f"/servicos/{s['id']}", {"preco": 200.5, "descricao": ""}, format="json")
    assert r.json()["preco"] == 200.5 and r.json()["descricao"] == "" and r.json()["ativo"] is False


def test_patch_invalido(api):
    s = _servico(api)
    assert api.patch(f"/servicos/{s['id']}", {"preco": -5}, format="json").status_code == 422
    assert api.patch(f"/servicos/{s['id']}", {"nome": ""}, format="json").status_code == 422
    assert api.patch(f"/servicos/{s['id']}", [1], format="json").status_code == 422


def test_404s(api):
    assert api.get(f"/servicos/{SEM_ID}").status_code == 404
    assert api.get("/servicos/nao-uuid").status_code == 404
    assert api.patch(f"/servicos/{SEM_ID}", {"ativo": False}, format="json").status_code == 404
    assert api.delete(f"/servicos/{SEM_ID}").status_code == 404


def test_delete_desvincula_kit(api):
    s = _servico(api)
    item = api.post("/estoque", {"nome": "Óleo", "categoria": "Fluidos", "quantidade": 5, "minimo": 0,
                                 "preco": 1, "localizacao": "A", "status": "ativo"}, format="json").json()
    kit = api.post("/kits", {"nome": "Kit Óleo", "servicoId": s["id"],
                             "itens": [{"itemId": item["id"], "quantidade": 1}]}, format="json").json()
    assert kit["servicoId"] == s["id"]
    assert api.delete(f"/servicos/{s['id']}").status_code == 204
    assert api.get(f"/servicos/{s['id']}").status_code == 404
    assert "servicoId" not in api.get(f"/kits/{kit['id']}").json()


def test_isolamento_entre_oficinas(fake):
    a, b = _cliente("dono", OFICINA_A), _cliente("dono", OFICINA_B)
    s = _servico(a)
    assert b.get("/servicos").json() == []
    assert b.get(f"/servicos/{s['id']}").status_code == 404
    assert b.patch(f"/servicos/{s['id']}", {"nome": "invasor"}, format="json").status_code == 404
    assert b.delete(f"/servicos/{s['id']}").status_code == 404
    assert a.get(f"/servicos/{s['id']}").json()["nome"] == s["nome"]


def test_paginacao_nao_trunca(api, fake, monkeypatch):
    for i in range(7):
        _servico(api, nome=f"S{i}")
    fake.max_linhas = 3
    monkeypatch.setattr(estoque_views, "TAMANHO_PAGINA", 3)
    ids = [s["id"] for s in api.get("/servicos").json()]
    assert len(ids) == 7 and len(set(ids)) == 7


def test_tabela_ausente_503(api, fake):
    fake.falhar_em[("select", "servicos")] = "42P01"
    r = api.get("/servicos")
    assert r.status_code == 503 and "servicos.sql" in r.json()["detail"]


def test_permissao_negada_no_banco_mensagem_clara(api, fake):
    fake.falhar_em[("select", "servicos")] = "42501"
    r = api.get("/servicos")
    assert r.status_code == 500 and "supabase.env" in r.json()["detail"]
