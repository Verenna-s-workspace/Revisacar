"""
Testes das views de Estoque (HTTP → view → serializer → SQL real).

O Supabase é trocado por FakeSupabase (tests/fake_supabase.py), que traduz as
chamadas do supabase-py pra SQL num Postgres real. Valida o contrato JSON, as
permissões, as validações e a integração com as funções SQL.
"""
import django
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import estoque_views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402


def _token(cargo="dono", oficina=OFICINA_A):
    payload = {"tipo": cargo, "nome": f"Teste {cargo}", "oficina_doc": oficina,
               "permissoes": permissoes_do_cargo(cargo)}
    return make_jwt(payload, 900)


def _cliente(cargo="dono", oficina=OFICINA_A):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {_token(cargo, oficina)}")
    return c


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    monkeypatch.setattr(estoque_views, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


def _item(api, **extra):
    corpo = {"nome": "Filtro de óleo", "categoria": "Filtros", "quantidade": 10, "minimo": 2,
             "preco": 35.9, "localizacao": "A1", "status": "ativo"}
    corpo.update(extra)
    r = api.post("/estoque", corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _categoria_valida():
    from orders.serializers import CATEGORIAS_ESTOQUE
    return sorted(CATEGORIAS_ESTOQUE)[0]


@pytest.fixture()
def cat():
    return _categoria_valida()


# ── Autenticação e permissões ─────────────────────────────────────────────────

def test_sem_token_401(fake):
    assert APIClient().get("/estoque").status_code == 401
    assert APIClient().post("/kits/00000000-0000-0000-0000-000000000000/aplicar").status_code == 401


def test_mecanico_ve_mas_nao_edita(fake, cat):
    dono = _cliente("dono")
    item = _item(dono, categoria=cat)
    mec = _cliente("mecanico")
    assert mec.get("/estoque").status_code == 200
    assert mec.get(f"/estoque/{item['id']}").status_code == 200
    assert mec.post("/estoque", {"nome": "x"}, format="json").status_code == 403
    assert mec.patch(f"/estoque/{item['id']}", {"nome": "y"}, format="json").status_code == 403
    assert mec.delete(f"/estoque/{item['id']}").status_code == 403
    assert mec.post("/kits", {}, format="json").status_code == 403
    assert mec.post("/kits/00000000-0000-0000-0000-000000000000/aplicar").status_code == 403


def test_atendente_so_ve(fake, cat):
    at = _cliente("atendente")
    assert at.get("/estoque").status_code == 200
    assert at.post("/estoque", {"nome": "x"}, format="json").status_code == 403


# ── Itens ─────────────────────────────────────────────────────────────────────

def test_criar_item_camelcase_e_movimento_inicial(api, cat):
    item = _item(api, categoria=cat, quantidade=7)
    assert item["quantidade"] == 7
    assert item["status"] == "ativo"
    assert "createdAt" in item and "quarentena" not in item
    movs = api.get("/estoque/movimentos").json()
    assert len(movs) == 1
    assert movs[0]["itemId"] == item["id"]
    assert movs[0]["tipo"] == "entrada" and movs[0]["quantidade"] == 7
    assert movs[0]["motivo"] == "Cadastro inicial"
    assert "criadoEm" in movs[0]


def test_criar_item_quantidade_zero_nao_gera_movimento(api, cat):
    _item(api, categoria=cat, quantidade=0)
    assert api.get("/estoque/movimentos").json() == []


def test_listar_itens(api, cat):
    a = _item(api, categoria=cat, nome="A")
    b = _item(api, categoria=cat, nome="B")
    ids = [i["id"] for i in api.get("/estoque").json()]
    assert set(ids) == {a["id"], b["id"]}
    assert ids[0] == b["id"]  # mais novo primeiro


@pytest.mark.parametrize("corpo, campo", [
    ({"nome": ""}, "nome"),
    ({"categoria": "Inexistente"}, "categoria"),
    ({"quantidade": -1}, "quantidade"),
    ({"quantidade": "abc"}, "quantidade"),
    ({"preco": -5}, "preco"),
    ({"status": "quarentena"}, None),  # quarentena sem dados
])
def test_validacoes_422(api, cat, corpo, campo):
    base = {"nome": "Item", "categoria": cat, "quantidade": 1, "minimo": 0, "preco": 1, "status": "ativo"}
    base.update(corpo)
    r = api.post("/estoque", base, format="json")
    assert r.status_code == 422, r.content
    if campo:
        assert campo in r.json()


def test_nan_e_infinito_rejeitados(api, cat):
    # O client do DRF não serializa NaN; manda o JSON cru, como um cliente malicioso faria.
    for literal in ("NaN", "Infinity", "-Infinity"):
        corpo = ('{"nome":"N","categoria":"%s","quantidade":%s,"minimo":0,"preco":1,"status":"ativo"}'
                 % (cat, literal))
        r = api.post("/estoque", corpo, content_type="application/json")
        assert r.status_code in (400, 422), (literal, r.status_code)
    assert api.get("/estoque").json() == []


def test_item_em_quarentena(api, cat):
    item = _item(api, categoria=cat, status="quarentena",
                 quarentena={"motivo": "Lote com defeito", "fornecedor": "ACME", "dataEntrada": "2026-10-01"})
    assert item["status"] == "quarentena"
    q = item["quarentena"]
    assert q["motivo"] == "Lote com defeito" and q["fornecedor"] == "ACME"
    assert q["dataEntrada"].startswith("2026-10-01")


def test_quarentena_sem_motivo_422(api, cat):
    r = api.post("/estoque", {"nome": "Q", "categoria": cat, "quantidade": 1, "minimo": 0, "preco": 1,
                              "status": "quarentena", "quarentena": {"motivo": "", "fornecedor": "X"}},
                 format="json")
    assert r.status_code == 422


def test_get_item_inexistente_e_id_invalido_404(api):
    assert api.get("/estoque/00000000-0000-0000-0000-000000000000").status_code == 404
    assert api.get("/estoque/nao-e-uuid").status_code == 404


def test_patch_mescla_e_preserva_campos(api, cat):
    item = _item(api, categoria=cat, descricao="Desc", aplicacao="Gol")
    r = api.patch(f"/estoque/{item['id']}", {"nome": "Novo nome"}, format="json")
    assert r.status_code == 200, r.content
    out = r.json()
    assert out["nome"] == "Novo nome"
    assert out["descricao"] == "Desc" and out["aplicacao"] == "Gol"
    assert out["quantidade"] == item["quantidade"] and out["preco"] == item["preco"]
    assert "updatedAt" in out


def test_patch_null_limpa_foto(api, cat):
    foto = "data:image/png;base64,iVBORw0KGgo="
    item = _item(api, categoria=cat, fotoDataUrl=foto)
    assert item["fotoDataUrl"] == foto
    out = api.patch(f"/estoque/{item['id']}", {"fotoDataUrl": None}, format="json").json()
    assert "fotoDataUrl" not in out
    # sem a chave, não mexe
    item2 = _item(api, categoria=cat, fotoDataUrl=foto, nome="Outro")
    out2 = api.patch(f"/estoque/{item2['id']}", {"nome": "Outro 2"}, format="json").json()
    assert out2["fotoDataUrl"] == foto


def test_patch_quantidade_gera_ajuste(api, cat):
    item = _item(api, categoria=cat, quantidade=10)
    r = api.patch(f"/estoque/{item['id']}", {"quantidade": 4}, format="json")
    assert r.status_code == 200 and r.json()["quantidade"] == 4
    movs = api.get("/estoque/movimentos").json()
    ajuste = [m for m in movs if m["tipo"] != "entrada" or m["motivo"] != "Cadastro inicial"]
    assert len(ajuste) == 1
    assert ajuste[0]["quantidade"] == 6


def test_patch_sem_mudar_quantidade_nao_gera_movimento(api, cat):
    item = _item(api, categoria=cat, quantidade=10)
    api.patch(f"/estoque/{item['id']}", {"preco": 50}, format="json")
    assert len(api.get("/estoque/movimentos").json()) == 1


def test_patch_para_quarentena_e_volta(api, cat):
    item = _item(api, categoria=cat)
    r = api.patch(f"/estoque/{item['id']}", {"status": "quarentena",
                  "quarentena": {"motivo": "Suspeita", "fornecedor": "F", "dataEntrada": "2026-10-02"}},
                  format="json")
    assert r.status_code == 200 and r.json()["quarentena"]["motivo"] == "Suspeita"
    r = api.patch(f"/estoque/{item['id']}", {"status": "ativo"}, format="json")
    assert r.status_code == 200 and "quarentena" not in r.json()


def test_patch_invalido_422_e_corpo_nao_dict(api, cat):
    item = _item(api, categoria=cat)
    assert api.patch(f"/estoque/{item['id']}", {"preco": -1}, format="json").status_code == 422
    assert api.patch(f"/estoque/{item['id']}", [1, 2], format="json").status_code == 422


def test_delete_item(api, cat):
    item = _item(api, categoria=cat)
    assert api.delete(f"/estoque/{item['id']}").status_code == 204
    assert api.get(f"/estoque/{item['id']}").status_code == 404


# ── Isolamento entre oficinas ─────────────────────────────────────────────────

def test_isolamento_entre_oficinas(fake, cat):
    a, b = _cliente("dono", OFICINA_A), _cliente("dono", OFICINA_B)
    item = _item(a, categoria=cat)
    assert b.get("/estoque").json() == []
    assert b.get(f"/estoque/{item['id']}").status_code == 404
    assert b.patch(f"/estoque/{item['id']}", {"nome": "invasor"}, format="json").status_code == 404
    assert b.delete(f"/estoque/{item['id']}").status_code == 404
    assert b.get("/estoque/movimentos").json() == []
    assert a.get(f"/estoque/{item['id']}").json()["nome"] == item["nome"]


def test_kit_de_outra_oficina_invisivel(fake, cat):
    a, b = _cliente("dono", OFICINA_A), _cliente("dono", OFICINA_B)
    item = _item(a, categoria=cat)
    kit = a.post("/kits", {"nome": "K", "itens": [{"itemId": item["id"], "quantidade": 1}]}, format="json").json()
    assert b.get("/kits").json() == []
    assert b.get(f"/kits/{kit['id']}").status_code == 404
    r = b.post(f"/kits/{kit['id']}/aplicar")
    assert r.status_code == 404
    # e B não consegue montar kit com item de A
    r = b.post("/kits", {"nome": "Roubo", "itens": [{"itemId": item["id"], "quantidade": 1}]}, format="json")
    assert r.status_code == 422


# ── Movimentos ────────────────────────────────────────────────────────────────

def test_movimentos_desde(api, cat, db):
    _item(api, categoria=cat)
    assert len(api.get("/estoque/movimentos?desde=2000-01-01").json()) == 1
    assert api.get("/estoque/movimentos?desde=2999-01-01").json() == []
    assert api.get("/estoque/movimentos?desde=lixo").status_code == 422


# ── Kits ──────────────────────────────────────────────────────────────────────

def _dois_itens(api, cat):
    a = _item(api, categoria=cat, nome="Óleo", quantidade=10)
    b = _item(api, categoria=cat, nome="Filtro", quantidade=5)
    return a, b


def test_criar_listar_buscar_kit(api, cat):
    a, b = _dois_itens(api, cat)
    r = api.post("/kits", {"nome": "Revisão", "descricao": "Básica",
                           "itens": [{"itemId": a["id"], "quantidade": 4}, {"itemId": b["id"], "quantidade": 1}]},
                 format="json")
    assert r.status_code == 201, r.content
    kit = r.json()
    assert kit["nome"] == "Revisão" and kit["descricao"] == "Básica"
    assert [i["itemId"] for i in kit["itens"]] == [a["id"], b["id"]]  # ordem preservada
    # (createdAt é ignorado: o emulador formata microssegundos diferente do jsonb)
    sem_data = lambda k: {c: v for c, v in k.items() if c != "createdAt"}  # noqa: E731
    assert sem_data(api.get(f"/kits/{kit['id']}").json()) == sem_data(kit)
    assert [sem_data(k) for k in api.get("/kits").json()] == [sem_data(kit)]


def test_kit_validacoes(api, cat):
    a, _ = _dois_itens(api, cat)
    item = {"itemId": a["id"], "quantidade": 1}
    assert api.post("/kits", {"nome": "", "itens": [item]}, format="json").status_code == 422
    assert api.post("/kits", {"nome": "K", "itens": []}, format="json").status_code == 422
    assert api.post("/kits", {"nome": "K", "itens": [item, item]}, format="json").status_code == 422
    assert api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 0}]},
                    format="json").status_code == 422
    inexistente = {"itemId": "00000000-0000-0000-0000-000000000000", "quantidade": 1}
    assert api.post("/kits", {"nome": "K", "itens": [inexistente]}, format="json").status_code == 422


def test_patch_kit_substitui_receita(api, cat):
    a, b = _dois_itens(api, cat)
    kit = api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 1}]}, format="json").json()
    r = api.patch(f"/kits/{kit['id']}", {"itens": [{"itemId": b["id"], "quantidade": 2}]}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["itens"] == [{"itemId": b["id"], "quantidade": 2}]
    assert r.json()["nome"] == "K"
    r = api.patch(f"/kits/{kit['id']}", {"nome": "Renomeado"}, format="json")
    assert r.json()["nome"] == "Renomeado" and len(r.json()["itens"]) == 1


def test_delete_kit_nao_mexe_no_estoque(api, cat):
    a, _ = _dois_itens(api, cat)
    kit = api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 1}]}, format="json").json()
    assert api.delete(f"/kits/{kit['id']}").status_code == 204
    assert api.get(f"/kits/{kit['id']}").status_code == 404
    assert api.get(f"/estoque/{a['id']}").status_code == 200


def test_delete_item_em_kit_409_com_nome(api, cat):
    a, _ = _dois_itens(api, cat)
    api.post("/kits", {"nome": "Kit Revisão", "itens": [{"itemId": a["id"], "quantidade": 1}]}, format="json")
    r = api.delete(f"/estoque/{a['id']}")
    assert r.status_code == 409
    assert "Kit Revisão" in r.json()["detail"]
    assert api.get(f"/estoque/{a['id']}").status_code == 200


def test_delete_item_corrida_fk_vira_409(api, cat, fake):
    """Item entra num kit entre a checagem e o delete: o banco recusa (23001) e vira 409."""
    a, _ = _dois_itens(api, cat)
    api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 1}]}, format="json")
    original = estoque_views.supabase.table
    estado = {"primeira": True}

    class _Vazio:
        def __getattr__(self, _):
            return lambda *a, **k: self
        def execute(self):
            class R: data = []
            return R()

    def table(nome):
        if nome == estoque_views.KIT_ITENS and estado["primeira"]:
            estado["primeira"] = False
            return _Vazio()  # checagem prévia "não vê" o vínculo
        return original(nome)

    fake.table = table
    r = api.delete(f"/estoque/{a['id']}")
    assert r.status_code == 409


def test_aplicar_kit_ok(api, cat):
    a, b = _dois_itens(api, cat)
    kit = api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 4},
                                                    {"itemId": b["id"], "quantidade": 1}]}, format="json").json()
    r = api.post(f"/kits/{kit['id']}/aplicar")
    assert r.status_code == 200, r.content
    out = r.json()
    assert out["ok"] is True
    qtd = {i["id"]: i["quantidade"] for i in out["itens"]}
    assert qtd == {a["id"]: 6, b["id"]: 4}
    assert len(out["movimentos"]) == 2 and all(m["tipo"] == "saida" for m in out["movimentos"])
    assert api.get(f"/estoque/{a['id']}").json()["quantidade"] == 6


def test_aplicar_kit_estoque_insuficiente_nao_baixa_nada(api, cat):
    a, b = _dois_itens(api, cat)
    kit = api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 4},
                                                    {"itemId": b["id"], "quantidade": 99}]}, format="json").json()
    r = api.post(f"/kits/{kit['id']}/aplicar")
    assert r.status_code == 200
    assert r.json()["ok"] is False and r.json()["mensagem"]
    assert api.get(f"/estoque/{a['id']}").json()["quantidade"] == 10
    assert api.get(f"/estoque/{b['id']}").json()["quantidade"] == 5
    assert all(m["tipo"] != "saida" for m in api.get("/estoque/movimentos").json())


def test_aplicar_kit_com_item_em_quarentena_rejeita(api, cat):
    a, b = _dois_itens(api, cat)
    kit = api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 1},
                                                    {"itemId": b["id"], "quantidade": 1}]}, format="json").json()
    api.patch(f"/estoque/{b['id']}", {"status": "quarentena",
              "quarentena": {"motivo": "M", "fornecedor": "F", "dataEntrada": "2026-10-02"}}, format="json")
    r = api.post(f"/kits/{kit['id']}/aplicar").json()
    assert r["ok"] is False
    assert api.get(f"/estoque/{a['id']}").json()["quantidade"] == 10


def test_aplicar_kit_inexistente_404(api):
    assert api.post("/kits/00000000-0000-0000-0000-000000000000/aplicar").status_code == 404
    assert api.post("/kits/nao-uuid/aplicar").status_code == 404


# ── Infra: banco ausente, rollback, paginação ─────────────────────────────────

def test_tabelas_ausentes_503(api, fake):
    fake.falhar_em[("select", "estoque_itens")] = "42P01"
    r = api.get("/estoque")
    assert r.status_code == 503
    assert "estoque.sql" in r.json()["detail"]


def test_funcao_ausente_503(api, cat, fake):
    a, _ = _dois_itens(api, cat)
    kit = api.post("/kits", {"nome": "K", "itens": [{"itemId": a["id"], "quantidade": 1}]}, format="json").json()
    fake.falhar_em[("rpc", "estoque_aplicar_kit")] = "PGRST202"
    assert api.post(f"/kits/{kit['id']}/aplicar").status_code == 503


def test_erro_generico_do_banco_500_limpo(api, fake):
    fake.falhar_em[("select", "estoque_itens")] = "XX000"
    r = api.get("/estoque")
    assert r.status_code == 500
    assert r.json() == {"detail": "Erro ao acessar o banco de dados."}


def test_rollback_se_movimento_inicial_falhar(api, cat, fake, db):
    fake.falhar_em[("insert", "estoque_movimentos")] = "XX000"
    r = api.post("/estoque", {"nome": "X", "categoria": cat, "quantidade": 5, "minimo": 0,
                              "preco": 1, "localizacao": "A1", "status": "ativo"}, format="json")
    assert r.status_code == 500
    cur = db.cursor()
    cur.execute("select count(*) from estoque_itens")
    assert cur.fetchone()[0] == 0


def test_paginacao_nao_trunca(api, cat, fake):
    for i in range(7):
        _item(api, categoria=cat, nome=f"I{i}")
    fake.max_linhas = 3
    estoque_views.TAMANHO_PAGINA, original = 3, estoque_views.TAMANHO_PAGINA
    try:
        assert len(api.get("/estoque").json()) == 7
        assert len(api.get("/estoque/movimentos").json()) == 7
        ids = [i["id"] for i in api.get("/estoque").json()]
        assert len(set(ids)) == 7  # sem duplicados entre páginas
    finally:
        estoque_views.TAMANHO_PAGINA = original
