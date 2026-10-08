"""Testes de Relatórios (GET /relatorios) e do escopo por oficina das ordens
(`ordens_oficina.sql` + rotas de /ordens). Rodam contra Postgres real."""
import json
import time
import uuid

import django
import psycopg2
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import estoque_views, relatorios_views, views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402


def _cliente(cargo="dono", oficina=OFICINA_A):
    c = APIClient()
    token = make_jwt({"tipo": cargo, "nome": cargo, "oficina_doc": oficina,
                      "permissoes": permissoes_do_cargo(cargo)}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


class _StorageVazio:
    """Só o suficiente pro DELETE /ordens/<id> (lista e remove arquivos)."""
    def from_(self, _bucket):
        return self

    def list(self, path=""):
        return []

    def remove(self, _paths):
        return None


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    f.storage = _StorageVazio()
    monkeypatch.setattr(relatorios_views, "supabase", f)
    monkeypatch.setattr(views, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


@pytest.fixture()
def tz_servidor_utc(monkeypatch):
    """OS antigas foram gravadas sem fuso, no relógio do servidor: fixa o servidor em UTC."""
    monkeypatch.setenv("TZ", "UTC")
    time.tzset()
    yield
    monkeypatch.undo()
    time.tzset()


def _ordem(db, created_at, status="finalizada", servicos=None, oficina=OFICINA_A, payload=None):
    if payload is None:
        payload = json.dumps({"servicos_selecionados": servicos or []})
    oid = str(uuid.uuid4())
    cur = db.cursor()
    cur.execute(
        "insert into ordens (id, created_at, updated_at, status, payload, oficina_doc, fotos_paths) "
        "values (%s,%s,%s,%s,%s,%s,'[]')",
        (oid, created_at, created_at, status, payload, oficina),
    )
    return oid


def _entrada(db, valor, dia, status="pago", tipo="entrada", oficina=OFICINA_A):
    db.cursor().execute(
        "insert into financeiro_transacoes (oficina_doc, tipo, categoria, valor, status, data_competencia) "
        "values (%s,%s,'servicos',%s,%s,%s)",
        (oficina, tipo, valor, status, dia),
    )


def _get(api, **params):
    base = {"de": "2026-10-01", "ate": "2026-10-31"}
    base.update(params)
    return api.get("/relatorios", {k: v for k, v in base.items() if v is not None})


# ── SQL: ordens_oficina.sql ───────────────────────────────────────────────────

def test_sql_coluna_indice_e_fk(db):
    cur = db.cursor()
    cur.execute("select is_nullable from information_schema.columns "
                "where table_name='ordens' and column_name='oficina_doc'")
    assert cur.fetchone() == ("YES",)   # nullable: OS antigas ainda sem oficina
    cur.execute("select 1 from pg_indexes where indexname='ordens_oficina_created_idx'")
    assert cur.fetchone()
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        cur.execute("insert into ordens (id, created_at, updated_at, payload, oficina_doc) "
                    "values ('x','2026-10-01','2026-10-01','{}','0')")


def test_sql_nao_preenche_ordens_antigas_com_varias_oficinas(db):
    # O banco de teste tem 2 oficinas: não dá pra adivinhar de quem é a OS antiga.
    cur = db.cursor()
    cur.execute("insert into ordens (id, created_at, updated_at, payload) values ('antiga','2026-01-01','2026-01-01','{}')")
    sql = (views.__file__.rsplit("/orders/", 1)[0] + "/sql/ordens_oficina.sql")
    cur.execute(open(sql, encoding="utf-8").read())
    cur.execute("select oficina_doc from ordens where id='antiga'")
    assert cur.fetchone() == (None,)


def test_sql_preenche_ordens_antigas_com_uma_oficina_so(pg_dsn, db):
    # Transação descartável: remove a oficina B, roda o script e desfaz tudo.
    conn = psycopg2.connect(pg_dsn)
    try:
        cur = conn.cursor()
        cur.execute("delete from admins where doc=%s", (OFICINA_B,))
        cur.execute("insert into ordens (id, created_at, updated_at, payload) values ('antiga','2026-01-01','2026-01-01','{}')")
        sql = (views.__file__.rsplit("/orders/", 1)[0] + "/sql/ordens_oficina.sql")
        cur.execute(open(sql, encoding="utf-8").read())
        cur.execute("select oficina_doc from ordens where id='antiga'")
        assert cur.fetchone() == (OFICINA_A,)
    finally:
        conn.rollback()
        conn.close()


# ── Permissão e parâmetros ────────────────────────────────────────────────────

def test_sem_token_401(fake):
    assert APIClient().get("/relatorios", {"de": "2026-10-01", "ate": "2026-10-31"}).status_code == 401


@pytest.mark.parametrize("cargo,esperado", [
    ("dono", 200), ("gerente", 200), ("mecanico", 403), ("atendente", 403),
])
def test_permissao_por_cargo(fake, cargo, esperado):
    assert _get(_cliente(cargo)).status_code == esperado


@pytest.mark.parametrize("params", [
    {"de": None},
    {"ate": None},
    {"de": "01/10/2026"},
    {"ate": "2026-13-40"},
    {"de": "2026-10-31", "ate": "2026-10-01"},
    {"de": "2025-01-01", "ate": "2026-10-31"},                 # mais de 400 dias
    {"de_anterior": "2026-09-01"},                              # só metade do par
    {"de_anterior": "2026-09-30", "ate_anterior": "2026-09-01"},
    {"tz": "Marte/Olympus"},
])
def test_parametros_invalidos_422(api, params):
    r = _get(api, **params)
    assert r.status_code == 422, r.content
    assert r.json()["detail"]


# ── Agregação (faturamento estimado: oficina sem Financeiro) ──────────────────

def test_periodo_vazio(api):
    r = _get(api)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["faturamentoOrigem"] == "estimado"
    assert corpo["totais"] == {"atual": {"faturamento": 0, "ordens": 0, "finalizadas": 0}, "anterior": None}
    assert corpo["dias"] == [] and corpo["servicos"] == []
    assert corpo["periodo"]["tz"] == "America/Sao_Paulo"


def test_estimativa_usa_servicos_do_payload_texto(api, db):
    # payload é coluna text: o servidor precisa ler a string JSON (o bug do frontend).
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor", "Pneus"])        # 800 + 120
    _ordem(db, "2026-10-05T15:00:00-03:00", servicos=["Serviço desconhecido"])   # → ticket padrão 480
    _ordem(db, "2026-10-06T09:00:00-03:00", servicos=[])                         # → ticket padrão 480
    corpo = _get(api).json()
    assert corpo["dias"] == [
        {"dia": "2026-10-05", "ordens": 2, "finalizadas": 2, "faturamento": 1400.0},
        {"dia": "2026-10-06", "ordens": 1, "finalizadas": 1, "faturamento": 480.0},
    ]
    assert corpo["totais"]["atual"] == {"faturamento": 1880.0, "ordens": 3, "finalizadas": 3}
    assert corpo["servicos"] == [
        {"nome": "Motor", "quantidade": 1},
        {"nome": "Pneus", "quantidade": 1},
        {"nome": "Serviço desconhecido", "quantidade": 1},
    ]


def test_ordens_nao_finalizadas_contam_como_ordem_mas_nao_faturam(api, db):
    _ordem(db, "2026-10-05T12:00:00-03:00", status="rascunho", servicos=["Motor"])
    _ordem(db, "2026-10-05T13:00:00-03:00", status="aguardando", servicos=["Motor"])
    _ordem(db, "2026-10-05T14:00:00-03:00", status="finalizada", servicos=["Freios"])
    corpo = _get(api).json()
    assert corpo["totais"]["atual"] == {"faturamento": 320.0, "ordens": 3, "finalizadas": 1}
    assert corpo["servicos"] == [{"nome": "Freios", "quantidade": 1}]   # só OS finalizadas


def test_payload_estranho_nao_derruba(api, db):
    _ordem(db, "2026-10-05T12:00:00-03:00", payload="isso não é json")
    _ordem(db, "2026-10-05T12:01:00-03:00", payload="[1, 2]")
    _ordem(db, "2026-10-05T12:02:00-03:00", payload=json.dumps({"servicos_selecionados": "Motor"}))
    _ordem(db, "2026-10-05T12:03:00-03:00", payload=json.dumps({"servicos_selecionados": ["Motor", 7, None, "  "]}))
    corpo = _get(api).json()
    assert corpo["totais"]["atual"]["ordens"] == 4
    assert corpo["servicos"] == [{"nome": "Motor", "quantidade": 1}]
    assert corpo["totais"]["atual"]["faturamento"] == 480 * 3 + 800


def test_isolamento_entre_oficinas(fake, db):
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"], oficina=OFICINA_A)
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"], oficina=OFICINA_B)
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"], oficina=None)   # OS antiga sem oficina
    a = _get(_cliente(oficina=OFICINA_A)).json()["totais"]["atual"]
    b = _get(_cliente(oficina=OFICINA_B)).json()["totais"]["atual"]
    assert a["ordens"] == 1 and b["ordens"] == 1


def test_funcionario_usa_a_oficina_do_dono(fake, db):
    _ordem(db, "2026-10-05T12:00:00-03:00")
    c = APIClient()
    token = make_jwt({"tipo": "funcionario", "nome": "Gi", "cargo": "gerente", "doc": "x",
                      "oficina_doc": OFICINA_A, "permissoes": permissoes_do_cargo("gerente")}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert _get(c).json()["totais"]["atual"]["ordens"] == 1


# ── Períodos, comparação e fuso ───────────────────────────────────────────────

def test_limites_do_periodo_inclusivos(api, db):
    _ordem(db, "2026-09-30T23:59:59-03:00")   # um segundo antes
    _ordem(db, "2026-10-01T00:00:00-03:00")   # primeiro instante
    _ordem(db, "2026-10-31T23:59:59-03:00")   # último instante
    _ordem(db, "2026-11-01T00:00:00-03:00")   # já fora
    corpo = _get(api).json()
    assert [d["dia"] for d in corpo["dias"]] == ["2026-10-01", "2026-10-31"]
    assert corpo["totais"]["atual"]["ordens"] == 2


def test_fuso_define_o_dia_da_os(api, db):
    # 01:30 UTC do dia 06 = 22:30 do dia 05 em São Paulo.
    _ordem(db, "2026-10-06T01:30:00+00:00")
    assert [d["dia"] for d in _get(api).json()["dias"]] == ["2026-10-05"]
    assert [d["dia"] for d in _get(api, tz="UTC").json()["dias"]] == ["2026-10-06"]
    assert [d["dia"] for d in _get(api, tz="America/Sao_Paulo").json()["dias"]] == ["2026-10-05"]


def test_fuso_pode_empurrar_os_pra_fora_do_periodo(api, db):
    # 02:00 UTC de 01/10 = 23:00 de 30/09 em São Paulo → fora de outubro.
    _ordem(db, "2026-10-01T02:00:00+00:00")
    assert _get(api).json()["totais"]["atual"]["ordens"] == 0
    assert _get(api, tz="UTC").json()["totais"]["atual"]["ordens"] == 1


def test_os_antiga_sem_fuso_e_lida_como_horario_do_servidor(api, db, tz_servidor_utc):
    # Gravada sem fuso por um servidor em UTC: 01:30 do dia 06 → dia 05 em São Paulo.
    _ordem(db, "2026-10-06T01:30:00.123456")
    assert [d["dia"] for d in _get(api).json()["dias"]] == ["2026-10-05"]


def test_created_at_ilegivel_e_ignorado(api, db):
    _ordem(db, "2026-10-05T12:00:00-03:00")
    _ordem(db, "2026-10-05 lixo")
    assert _get(api).json()["totais"]["atual"]["ordens"] == 1


def test_comparacao_com_periodo_anterior(api, db):
    _ordem(db, "2026-09-10T12:00:00-03:00", servicos=["Freios"])     # anterior: 320
    _ordem(db, "2026-09-11T12:00:00-03:00", status="rascunho")        # anterior: sem faturamento
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"])       # atual: 800
    corpo = _get(api, de="2026-10-01", ate="2026-10-31", de_anterior="2026-09-01", ate_anterior="2026-09-30").json()
    assert corpo["totais"]["atual"] == {"faturamento": 800.0, "ordens": 1, "finalizadas": 1}
    assert corpo["totais"]["anterior"] == {"faturamento": 320.0, "ordens": 2, "finalizadas": 1}
    assert [d["dia"] for d in corpo["dias"]] == ["2026-09-10", "2026-09-11", "2026-10-05"]
    # os serviços ranqueados são só do período atual
    assert corpo["servicos"] == [{"nome": "Motor", "quantidade": 1}]
    assert corpo["periodo"]["deAnterior"] == "2026-09-01"


def test_anterior_sem_nenhuma_os_vira_null(api, db):
    _ordem(db, "2026-10-05T12:00:00-03:00")
    corpo = _get(api, de_anterior="2026-09-01", ate_anterior="2026-09-30").json()
    assert corpo["totais"]["anterior"] is None


def test_periodos_sobrepostos_ou_fora_de_ordem(api, db):
    # "Anterior" depois do "atual" (cliente pode mandar qualquer coisa válida): sem erro.
    _ordem(db, "2026-10-05T12:00:00-03:00")
    _ordem(db, "2026-11-05T12:00:00-03:00")
    corpo = _get(api, de="2026-10-01", ate="2026-10-31", de_anterior="2026-11-01", ate_anterior="2026-11-30").json()
    assert corpo["totais"]["atual"]["ordens"] == 1 and corpo["totais"]["anterior"]["ordens"] == 1


def test_paginacao_percorre_todas_as_paginas(api, fake, db, monkeypatch):
    fake.max_linhas = 3
    monkeypatch.setattr(estoque_views, "TAMANHO_PAGINA", 3)
    for i in range(10):
        _ordem(db, f"2026-10-05T10:{i:02d}:00-03:00")
    assert _get(api).json()["totais"]["atual"]["ordens"] == 10


# ── Faturamento real (Financeiro) ─────────────────────────────────────────────

def test_usa_entradas_do_financeiro_quando_existem(api, db):
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"])      # estimativa seria 800: ignorada
    _entrada(db, 1000, "2026-10-05", status="pago")
    _entrada(db, 250.5, "2026-10-05", status="pendente")             # pendente também é faturamento (como /financeiro/resumo)
    _entrada(db, 999, "2026-10-06", status="cancelado")              # cancelada fora
    _entrada(db, 700, "2026-10-06", tipo="saida")                    # saída não é faturamento
    _entrada(db, 5000, "2026-10-06", oficina=OFICINA_B)              # outra oficina
    _entrada(db, 40, "2026-09-30")                                   # fora do período
    corpo = _get(api).json()
    assert corpo["faturamentoOrigem"] == "financeiro"
    assert corpo["totais"]["atual"] == {"faturamento": 1250.5, "ordens": 1, "finalizadas": 1}
    assert corpo["dias"] == [{"dia": "2026-10-05", "ordens": 1, "finalizadas": 1, "faturamento": 1250.5}]


def test_entrada_em_dia_sem_os_aparece_na_serie(api, db):
    _entrada(db, 300, "2026-10-07")
    corpo = _get(api).json()
    assert corpo["dias"] == [{"dia": "2026-10-07", "ordens": 0, "finalizadas": 0, "faturamento": 300.0}]


def test_financeiro_de_outra_oficina_nao_muda_a_origem(fake, db):
    _entrada(db, 100, "2026-10-05", oficina=OFICINA_B)
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"])
    corpo = _get(_cliente(oficina=OFICINA_A)).json()
    assert corpo["faturamentoOrigem"] == "estimado"
    assert corpo["totais"]["atual"]["faturamento"] == 800.0


def test_so_entradas_canceladas_conta_como_sem_financeiro(api, db):
    _entrada(db, 100, "2026-10-05", status="cancelado")
    assert _get(api).json()["faturamentoOrigem"] == "estimado"


def test_sem_tabela_financeiro_cai_na_estimativa(api, fake, db):
    fake.falhar_em[("select", "financeiro_transacoes")] = "42P01"
    _ordem(db, "2026-10-05T12:00:00-03:00", servicos=["Motor"])
    corpo = _get(api).json()
    assert corpo["faturamentoOrigem"] == "estimado"
    assert corpo["totais"]["atual"]["faturamento"] == 800.0


# ── Erros do banco ────────────────────────────────────────────────────────────

def test_coluna_oficina_ausente_vira_503_com_instrucao(api, fake):
    fake.falhar_em[("select", "ordens")] = "42703"
    r = _get(api)
    assert r.status_code == 503 and "ordens_oficina.sql" in r.json()["detail"]


def test_permissao_negada_no_banco_aponta_a_chave(api, fake):
    fake.falhar_em[("select", "ordens")] = "42501"
    r = _get(api)
    assert r.status_code == 500 and "supabase.env" in r.json()["detail"]


def test_erro_inesperado_do_banco_vira_500_generico(api, fake):
    fake.falhar_em[("select", "ordens")] = "XX000"
    r = _get(api)
    assert r.status_code == 500 and r.json()["detail"] == "Erro ao acessar o banco de dados."


# ── /ordens escopado por oficina ──────────────────────────────────────────────

def _corpo_ordem(num="OS-1", placa="ABC1D23", servicos=("Motor",)):
    return {
        "os_header": {"os_num": num},
        "cliente": {"nome": "Maria", "tel": "11999999999"},
        "veiculo": {"placa": placa, "modelo": "Onix"},
        "servicos_selecionados": list(servicos),
        "status": "finalizada",
    }


def test_criar_ordem_grava_oficina_e_data_com_fuso(fake, db):
    r = _cliente().post("/ordens", _corpo_ordem(), format="json")
    assert r.status_code == 201, r.content
    cur = db.cursor()
    cur.execute("select oficina_doc, created_at, payload from ordens where id=%s", (r.json()["id"],))
    oficina, criado, payload = cur.fetchone()
    assert oficina == OFICINA_A
    assert criado.endswith(("+00:00", "-03:00")) or criado[-6] in "+-"   # tem offset
    assert json.loads(payload)["servicos_selecionados"] == ["Motor"]


def test_ordem_criada_pela_api_aparece_no_relatorio_do_dia(fake, db):
    api = _cliente()
    assert api.post("/ordens", _corpo_ordem(), format="json").status_code == 201
    # janela em volta de hoje (o período máximo é de 400 dias)
    from datetime import date, timedelta
    hoje = date.today()
    corpo = api.get("/relatorios", {"de": (hoje - timedelta(days=2)).isoformat(),
                                    "ate": (hoje + timedelta(days=2)).isoformat(), "tz": "UTC"}).json()
    assert corpo["totais"]["atual"]["finalizadas"] == 1
    assert corpo["servicos"] == [{"nome": "Motor", "quantidade": 1}]


def test_listar_ordens_so_da_propria_oficina(fake, db):
    _ordem(db, "2026-10-05T12:00:00-03:00", oficina=OFICINA_A)
    _ordem(db, "2026-10-05T12:00:00-03:00", oficina=OFICINA_B)
    _ordem(db, "2026-10-05T12:00:00-03:00", oficina=None)
    assert len(_cliente(oficina=OFICINA_A).get("/ordens").json()) == 1
    assert len(_cliente(oficina=OFICINA_B).get("/ordens").json()) == 1
    assert len(_cliente(oficina=OFICINA_A).get("/ordens", {"status": "rascunho"}).json()) == 0


def test_ordem_de_outra_oficina_e_404_em_todas_as_rotas(fake, db):
    oid = _ordem(db, "2026-10-05T12:00:00-03:00", oficina=OFICINA_B)
    a = _cliente(oficina=OFICINA_A)
    assert a.get(f"/ordens/{oid}").status_code == 404
    assert a.put(f"/ordens/{oid}", _corpo_ordem(), format="json").status_code == 404
    assert a.patch(f"/ordens/{oid}/status", {"status": "finalizada"}, format="json").status_code == 404
    assert a.delete(f"/ordens/{oid}").status_code == 404
    assert a.delete(f"/ordens/{oid}/fotos/{oid}%2Ffoto.jpg").status_code == 404
    assert a.post(f"/ordens/{oid}/fotos", {}, format="multipart").status_code == 404
    # nada mudou na ordem da oficina B
    cur = db.cursor()
    cur.execute("select status, oficina_doc from ordens where id=%s", (oid,))
    assert cur.fetchone() == ("finalizada", OFICINA_B)


def test_crud_da_propria_ordem_continua_funcionando(fake, db):
    a = _cliente()
    oid = a.post("/ordens", _corpo_ordem(), format="json").json()["id"]
    assert a.get(f"/ordens/{oid}").status_code == 200
    r = a.put(f"/ordens/{oid}", _corpo_ordem(num="OS-2"), format="json")
    assert r.status_code == 200 and r.json()["os_num"] == "OS-2"
    assert a.patch(f"/ordens/{oid}/status", {"status": "aguardando"}, format="json").json()["status"] == "aguardando"
    assert a.delete(f"/ordens/{oid}").status_code == 200
    assert a.get(f"/ordens/{oid}").status_code == 404


def test_atualizar_ordem_nao_troca_a_oficina(fake, db):
    a = _cliente()
    oid = a.post("/ordens", _corpo_ordem(), format="json").json()["id"]
    a.put(f"/ordens/{oid}", _corpo_ordem(num="OS-9"), format="json")
    cur = db.cursor()
    cur.execute("select oficina_doc from ordens where id=%s", (oid,))
    assert cur.fetchone() == (OFICINA_A,)


def test_ordens_sem_a_coluna_vira_503_com_instrucao(fake):
    fake.falhar_em[("select", "ordens")] = "42703"
    r = _cliente().get("/ordens")
    assert r.status_code == 503 and "ordens_oficina.sql" in r.json()["detail"]
    fake.falhar_em.clear()
    fake.falhar_em[("insert", "ordens")] = "PGRST204"
    r = _cliente().post("/ordens", _corpo_ordem(), format="json")
    assert r.status_code == 503 and "ordens_oficina.sql" in r.json()["detail"]
