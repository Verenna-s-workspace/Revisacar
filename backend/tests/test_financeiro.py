"""Testes do Financeiro (/financeiro/*) — Postgres real."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import django
import psycopg2
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import estoque_views, financeiro_views, relatorios_views, views, visao_geral_views  # noqa: E402

from .conftest import BACKEND_DIR, OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
URL = "/financeiro/transacoes"


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (financeiro_views, relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    # Sexta, 9/10/2026, 15h em São Paulo.
    monkeypatch.setattr(visao_geral_views, "_agora", lambda tz: datetime(2026, 10, 9, 15, 0, tzinfo=SP).astimezone(tz))
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


def _lanca(db, valor, dia, tipo="entrada", status="pago", categoria=None, oficina=OFICINA_A,
           vencimento=None, descricao="", pagamento=None):
    cur = db.cursor()
    cur.execute(
        "insert into financeiro_transacoes "
        "(oficina_doc, tipo, categoria, valor, status, data_competencia, data_vencimento, descricao, data_pagamento) "
        "values (%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id",
        (oficina, tipo, categoria or ("servicos" if tipo == "entrada" else "aluguel"),
         valor, status, dia, vencimento, descricao, pagamento),
    )
    return str(cur.fetchone()[0])


def _corpo(**extra):
    base = {"tipo": "entrada", "categoria": "servicos", "descricao": "Troca de óleo",
            "valor": 150, "forma_pagamento": "pix", "status": "pago", "data_competencia": "2026-10-09"}
    base.update(extra)
    return base


def _linha(db, id_):
    cur = db.cursor()
    cur.execute("select status, valor, data_pagamento, descricao from financeiro_transacoes where id=%s", (id_,))
    return cur.fetchone()


# ── SQL: financeiro.sql ───────────────────────────────────────────────────────

def _sql():
    return (BACKEND_DIR / "sql" / "financeiro.sql").read_text(encoding="utf-8")


def test_sql_cria_a_tabela_do_zero_e_e_idempotente(pg_dsn, db):
    # DDL do Postgres é transacional: dropa, recria, confere e desfaz tudo.
    conn = psycopg2.connect(pg_dsn)
    try:
        cur = conn.cursor()
        cur.execute("drop table public.financeiro_transacoes cascade")
        cur.execute(_sql())
        cur.execute(_sql())
        cur.execute("select column_name from information_schema.columns where table_name='financeiro_transacoes'")
        colunas = {r[0] for r in cur.fetchall()}
        assert {"id", "oficina_doc", "tipo", "categoria", "descricao", "valor", "forma_pagamento", "status",
                "data_competencia", "data_vencimento", "data_pagamento", "cliente_nome", "ordem_servico_id",
                "criado_por_nome", "criado_por_tipo", "created_at"} <= colunas
        cur.execute("insert into financeiro_transacoes (oficina_doc, tipo, categoria, valor, data_competencia) "
                    "values (%s,'entrada','servicos',10,'2026-10-01') returning status", (OFICINA_A,))
        assert cur.fetchone() == ("pendente",)
    finally:
        conn.rollback()
        conn.close()


def test_sql_acrescenta_colunas_que_faltam_numa_tabela_antiga(pg_dsn, db):
    conn = psycopg2.connect(pg_dsn)
    try:
        cur = conn.cursor()
        cur.execute("drop table public.financeiro_transacoes cascade")
        cur.execute(
            "create table public.financeiro_transacoes (id uuid primary key default gen_random_uuid(), "
            "oficina_doc text not null, tipo text not null, categoria text not null, valor numeric not null, "
            "status text not null default 'pendente', data_competencia date not null)"
        )
        cur.execute("insert into financeiro_transacoes (oficina_doc, tipo, categoria, valor, data_competencia) "
                    "values (%s,'entrada','servicos',10,'2026-10-01')", (OFICINA_A,))
        cur.execute(_sql())
        cur.execute("select count(*) from information_schema.columns where table_name='financeiro_transacoes' "
                    "and column_name in ('ordem_servico_id','data_pagamento','cliente_nome','created_at')")
        assert cur.fetchone() == (4,)
        cur.execute("select count(*) from financeiro_transacoes")
        assert cur.fetchone() == (1,)   # não mexe no que já existe
    finally:
        conn.rollback()
        conn.close()


@pytest.mark.parametrize("tipo,status,valor", [
    ("transferencia", "pago", 10),
    ("entrada", "atrasado", 10),
    ("entrada", "pago", 0),
    ("entrada", "pago", -5),
])
def test_sql_trava_dados_invalidos(db, tipo, status, valor):
    with pytest.raises(psycopg2.errors.CheckViolation):
        _lanca(db, valor, "2026-10-01", tipo=tipo, status=status)


def test_sql_exige_oficina_existente(db):
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        _lanca(db, 10, "2026-10-01", oficina="999")


def test_sql_indices(db):
    cur = db.cursor()
    cur.execute("select indexname from pg_indexes where tablename='financeiro_transacoes'")
    nomes = {r[0] for r in cur.fetchall()}
    assert {"financeiro_oficina_competencia_idx", "financeiro_pendentes_idx"} <= nomes


# ── acesso ────────────────────────────────────────────────────────────────────

def test_sem_token_401(fake):
    assert APIClient().get(URL).status_code == 401
    assert APIClient().get("/financeiro/resumo").status_code == 401
    assert APIClient().patch(f"{URL}/x", {}, format="json").status_code == 401


@pytest.mark.parametrize("cargo", ["mecanico", "atendente"])
def test_cargos_sem_financeiro_levam_403(fake, cargo):
    c = _cliente(cargo)
    assert c.get(URL).status_code == 403
    assert c.post(URL, _corpo(), format="json").status_code == 403
    assert c.get("/financeiro/resumo").status_code == 403
    assert c.patch(f"{URL}/x", {"valor": 1}, format="json").status_code == 403
    assert c.delete(f"{URL}/x").status_code == 403


def test_gerente_lanca_e_ve_mas_sem_margem(fake, db):
    g = _cliente("gerente")
    assert g.post(URL, _corpo(), format="json").status_code == 201
    corpo = g.get("/financeiro/resumo").json()
    assert corpo["faturamento"] == 150
    assert "lucro" not in corpo and "margem_percentual" not in corpo


def test_categorias_e_publica(fake):
    corpo = APIClient().get("/financeiro/categorias").json()
    assert "servicos" in corpo["entrada"] and "aluguel" in corpo["saida"] and "pix" in corpo["formas_pagamento"]


# ── POST ──────────────────────────────────────────────────────────────────────

def test_cria_lancamento_pago(api, db):
    r = api.post(URL, _corpo(valor="150.50", cliente_nome="Marcos"), format="json")
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["valor"] == 150.5 and corpo["status"] == "pago" and corpo["vencido"] is False
    assert corpo["data_pagamento"] is not None          # pago ganha data de pagamento sozinho
    assert corpo["criado_por_nome"] == "dono" and corpo["criado_por_tipo"] == "dono"
    assert "oficina_doc" not in corpo
    cur = db.cursor()
    cur.execute("select oficina_doc from financeiro_transacoes where id=%s", (corpo["id"],))
    assert cur.fetchone() == (OFICINA_A,)


def test_pendente_nunca_guarda_data_de_pagamento(api):
    r = api.post(URL, _corpo(status="pendente", data_pagamento="2026-10-01T10:00:00Z", data_vencimento="2026-10-20"),
                 format="json")
    assert r.status_code == 201
    assert r.json()["data_pagamento"] is None


def test_lancamento_cancelado_nao_pode_ser_criado(api):
    r = api.post(URL, _corpo(status="cancelado"), format="json")
    assert r.status_code == 422 and "status" in r.json()


@pytest.mark.parametrize("ajuste", [
    {"valor": 0}, {"valor": -3}, {"valor": "abc"}, {"valor": "NaN"}, {"valor": "Infinity"}, {"valor": 12345678901},
    {"categoria": "aluguel"},            # categoria de saída num lançamento de entrada
    {"tipo": "outro"},
    {"forma_pagamento": "cheque"},
    {"data_competencia": "09/10/2026"},
    {"descricao": "x" * 201},
    {"cliente_nome": "x" * 121},
])
def test_lancamento_invalido_422(api, ajuste):
    assert api.post(URL, _corpo(**ajuste), format="json").status_code == 422


def test_corpo_que_nao_e_objeto_400(api):
    assert api.post(URL, [1, 2], format="json").status_code == 400


def test_nao_cria_na_oficina_de_outro(api, db):
    api.post(URL, _corpo(oficina_doc=OFICINA_B), format="json")   # campo extra é ignorado
    cur = db.cursor()
    cur.execute("select oficina_doc from financeiro_transacoes")
    assert cur.fetchall() == [(OFICINA_A,)]


# ── GET /financeiro/transacoes ────────────────────────────────────────────────

def test_lista_o_mes_atual_por_padrao_e_so_da_oficina(api, db):
    _lanca(db, 10, "2026-10-01")
    _lanca(db, 20, "2026-10-31")
    _lanca(db, 30, "2026-09-30")
    _lanca(db, 40, "2026-11-01")
    _lanca(db, 50, "2026-10-05", oficina=OFICINA_B)
    r = api.get(URL)
    assert r.status_code == 200
    assert sorted(l["valor"] for l in r.json()) == [10, 20]


def test_lista_do_mais_novo_para_o_mais_antigo(api, db):
    _lanca(db, 1, "2026-10-02")
    _lanca(db, 2, "2026-10-08")
    _lanca(db, 3, "2026-10-05")
    assert [l["valor"] for l in api.get(URL).json()] == [2, 3, 1]


def test_filtra_por_periodo_tipo_e_status(api, db):
    _lanca(db, 10, "2026-09-10")
    _lanca(db, 20, "2026-09-20", tipo="saida")
    _lanca(db, 30, "2026-09-25", status="pendente")
    _lanca(db, 40, "2026-10-02")
    periodo = {"de": "2026-09-01", "ate": "2026-09-30"}
    assert len(api.get(URL, periodo).json()) == 3
    assert [l["valor"] for l in api.get(URL, {**periodo, "tipo": "saida"}).json()] == [20]
    assert [l["valor"] for l in api.get(URL, {**periodo, "status": "pendente"}).json()] == [30]


def test_nao_lista_cancelados(api, db):
    _lanca(db, 10, "2026-10-02", status="cancelado")
    _lanca(db, 20, "2026-10-02")
    assert [l["valor"] for l in api.get(URL).json()] == [20]


def test_sem_periodo_traz_pendentes_de_qualquer_data(api, db):
    _lanca(db, 10, "2026-03-02", status="pendente")
    _lanca(db, 20, "2026-10-02", status="pendente")
    _lanca(db, 30, "2026-10-02", status="pago")
    r = api.get(URL, {"status": "pendente", "sem_periodo": "1"})
    assert sorted(l["valor"] for l in r.json()) == [10, 20]


def test_formato_da_linha(api, db):
    _lanca(db, 12.5, "2026-10-02", descricao="x")
    linha = api.get(URL).json()[0]
    assert linha["valor"] == 12.5 and isinstance(linha["valor"], float)
    assert "oficina_doc" not in linha
    assert linha["cliente_nome"] == "" and linha["vencido"] is False


@pytest.mark.parametrize("params", [
    {"de": "2026-10-01"},                       # só um dos dois
    {"ate": "2026-10-31"},
    {"de": "01/10/2026", "ate": "2026-10-31"},
    {"de": "2026-13-01", "ate": "2026-10-31"},
    {"de": "2026-10-31", "ate": "2026-10-01"},  # invertido
    {"de": "2020-01-01", "ate": "2026-10-31"},  # grande demais
    {"tz": "Marte/Olimpo"},
])
def test_parametros_invalidos_422(api, params):
    assert api.get(URL, params).status_code == 422


def test_vencido_usa_o_dia_de_hoje_do_usuario(api, db):
    _lanca(db, 10, "2026-10-01", status="pendente", vencimento="2026-10-08")   # venceu ontem
    _lanca(db, 20, "2026-10-01", status="pendente", vencimento="2026-10-09")   # vence hoje: ainda não venceu
    _lanca(db, 30, "2026-10-01", status="pago", vencimento="2026-10-01")       # pago nunca é vencido
    venc = {l["valor"]: l["vencido"] for l in api.get(URL).json()}
    assert venc == {10: True, 20: False, 30: False}


def test_vencido_respeita_o_fuso_enviado(api, db):
    _lanca(db, 20, "2026-10-01", status="pendente", vencimento="2026-10-09")
    # 15h em São Paulo já é dia 10 de manhã em Kiritimati (UTC+14).
    assert api.get(URL, {"tz": "Pacific/Kiritimati"}).json()[0]["vencido"] is True
    assert api.get(URL).json()[0]["vencido"] is False


def test_pagina_alem_do_limite_do_postgrest(fake, api, db, monkeypatch):
    fake.max_linhas = 3
    monkeypatch.setattr(estoque_views, "TAMANHO_PAGINA", 3)
    for i in range(8):
        _lanca(db, i + 1, f"2026-10-0{i + 1}")
    corpo = api.get(URL).json()
    assert sorted(l["valor"] for l in corpo) == list(range(1, 9))


# ── PATCH ─────────────────────────────────────────────────────────────────────

def test_edita_campos(api, db):
    id_ = _lanca(db, 100, "2026-10-02", descricao="velha")
    r = api.patch(f"{URL}/{id_}", {"valor": "180.90", "descricao": "nova", "categoria": "pecas"}, format="json")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["valor"] == 180.9 and corpo["descricao"] == "nova" and corpo["categoria"] == "pecas"
    assert corpo["id"] == id_ and "oficina_doc" not in corpo


def test_editar_valor_nao_mexe_na_data_de_pagamento(api, db):
    id_ = _lanca(db, 100, "2026-10-02", pagamento="2026-10-02T12:00:00+00:00")
    api.patch(f"{URL}/{id_}", {"valor": 120}, format="json")
    cur = db.cursor()
    cur.execute("select data_pagamento from financeiro_transacoes where id=%s", (id_,))
    assert cur.fetchone()[0] == datetime.fromisoformat("2026-10-02T12:00:00+00:00")


def test_marcar_como_pago_grava_data_de_pagamento(api, db):
    id_ = _lanca(db, 100, "2026-10-02", status="pendente", vencimento="2026-10-01")
    r = api.patch(f"{URL}/{id_}", {"status": "pago"}, format="json")
    assert r.status_code == 200
    assert r.json()["status"] == "pago" and r.json()["data_pagamento"] is not None
    assert r.json()["vencido"] is False


def test_voltar_para_pendente_apaga_a_data_de_pagamento(api, db):
    id_ = _lanca(db, 100, "2026-10-02", pagamento="2026-10-02T12:00:00+00:00")
    r = api.patch(f"{URL}/{id_}", {"status": "pendente"}, format="json")
    assert r.status_code == 200 and r.json()["data_pagamento"] is None


def test_edita_linha_antiga_com_texto_nulo(api, db):
    id_ = _lanca(db, 100, "2026-10-02")
    db.cursor().execute("update financeiro_transacoes set descricao = null, cliente_nome = null where id=%s", (id_,))
    r = api.patch(f"{URL}/{id_}", {"valor": 130}, format="json")
    assert r.status_code == 200 and r.json()["descricao"] == "" and r.json()["cliente_nome"] == ""


def test_patch_de_outra_oficina_e_404_e_nao_altera(api, db):
    id_ = _lanca(db, 100, "2026-10-02", oficina=OFICINA_B)
    assert api.patch(f"{URL}/{id_}", {"valor": 1}, format="json").status_code == 404
    assert _linha(db, id_)[1] == 100


def test_id_invalido_e_404(api):
    assert api.patch(f"{URL}/nao-e-id", {"valor": 1}, format="json").status_code == 404
    assert api.delete(f"{URL}/nao-e-id").status_code == 404


def test_cancelado_nao_pode_ser_editado_409(api, db):
    id_ = _lanca(db, 100, "2026-10-02", status="cancelado")
    assert api.patch(f"{URL}/{id_}", {"valor": 1}, format="json").status_code == 409


@pytest.mark.parametrize("corpo,codigo", [
    ({}, 400),
    ({"id": "x", "created_at": "2020-01-01"}, 400),        # campos que não se editam
    ({"tipo": "saida"}, 422),                             # tipo não muda
    ({"status": "cancelado"}, 422),                       # cancelar é DELETE
    ({"valor": 0}, 422),
    ({"categoria": "aluguel"}, 422),                      # categoria de saída em entrada
    ({"data_competencia": "ontem"}, 422),
])
def test_patch_invalido(api, db, corpo, codigo):
    id_ = _lanca(db, 100, "2026-10-02")
    assert api.patch(f"{URL}/{id_}", corpo, format="json").status_code == codigo
    assert _linha(db, id_)[1] == 100


def test_patch_corpo_que_nao_e_objeto_400(api, db):
    id_ = _lanca(db, 100, "2026-10-02")
    assert api.patch(f"{URL}/{id_}", [1], format="json").status_code == 400


# ── DELETE ────────────────────────────────────────────────────────────────────

def test_delete_cancela_e_mantem_o_historico(api, db):
    id_ = _lanca(db, 100, "2026-10-02", pagamento="2026-10-02T12:00:00+00:00")
    assert api.delete(f"{URL}/{id_}").status_code == 204
    status, _, pagamento, _ = _linha(db, id_)
    assert status == "cancelado" and pagamento is not None
    assert api.get(URL).json() == []
    assert api.delete(f"{URL}/{id_}").status_code == 204    # repetir é inofensivo


def test_delete_de_outra_oficina_404(api, db):
    id_ = _lanca(db, 100, "2026-10-02", oficina=OFICINA_B)
    assert api.delete(f"{URL}/{id_}").status_code == 404
    assert _linha(db, id_)[0] == "pago"


# ── GET /financeiro/resumo ────────────────────────────────────────────────────

def test_resumo_totais_do_periodo(api, db):
    _lanca(db, 1000, "2026-10-02")                                       # entrada paga
    _lanca(db, 500, "2026-10-03", status="pendente")                     # entrada pendente: faturou, não recebeu
    _lanca(db, 300, "2026-10-04", tipo="saida")                          # saída paga
    _lanca(db, 200, "2026-10-05", tipo="saida", status="pendente")       # saída pendente
    _lanca(db, 999, "2026-10-06", status="cancelado")                    # cancelado não conta
    _lanca(db, 777, "2026-09-30")                                        # fora do período
    _lanca(db, 888, "2026-10-02", oficina=OFICINA_B)                     # outra oficina
    r = api.get("/financeiro/resumo")
    assert r.status_code == 200
    assert r.json() == {
        "periodo": {"de": "2026-10-01", "ate": "2026-10-31"},
        "faturamento": 1500, "despesas": 500, "recebido": 1000, "saldo": 700,
        "a_receber": 500, "a_pagar": 200, "vencido_receber": 0, "vencido_pagar": 0,
        "lucro": 1000, "margem_percentual": 66.7,
    }


def test_resumo_pendente_e_divida_de_agora_nao_de_periodo(api, db):
    _lanca(db, 400, "2026-08-10", status="pendente", vencimento="2026-08-20")                   # de agosto, vencida
    _lanca(db, 100, "2026-09-10", tipo="saida", status="pendente", vencimento="2026-10-08")     # vencida ontem
    _lanca(db, 50, "2026-10-01", tipo="saida", status="pendente", vencimento="2026-10-09")      # vence hoje
    _lanca(db, 25, "2026-10-01", tipo="saida", status="pendente")                               # sem vencimento
    corpo = api.get("/financeiro/resumo").json()
    assert corpo["a_receber"] == 400 and corpo["vencido_receber"] == 400
    assert corpo["a_pagar"] == 175 and corpo["vencido_pagar"] == 100
    assert corpo["faturamento"] == 0                       # a de agosto não é deste mês


def test_resumo_soma_centavos_sem_erro_de_ponto_flutuante(api, db):
    _lanca(db, 0.10, "2026-10-02")
    _lanca(db, 0.20, "2026-10-03")
    assert api.get("/financeiro/resumo").json()["faturamento"] == 0.3


def test_resumo_vazio(api):
    corpo = api.get("/financeiro/resumo").json()
    assert corpo["faturamento"] == 0 and corpo["lucro"] == 0 and corpo["margem_percentual"] == 0.0


def test_resumo_prejuizo(api, db):
    _lanca(db, 100, "2026-10-02")
    _lanca(db, 300, "2026-10-03", tipo="saida")
    corpo = api.get("/financeiro/resumo").json()
    assert corpo["lucro"] == -200 and corpo["margem_percentual"] == -200.0


def test_resumo_periodo_informado_e_validacao(api, db):
    _lanca(db, 10, "2026-09-15")
    assert api.get("/financeiro/resumo", {"de": "2026-09-01", "ate": "2026-09-30"}).json()["faturamento"] == 10
    assert api.get("/financeiro/resumo", {"de": "2026-09-30", "ate": "2026-09-01"}).status_code == 422
    assert api.get("/financeiro/resumo", {"de": "2026-09-01"}).status_code == 422


def test_resumo_pagina_alem_do_limite(fake, api, db, monkeypatch):
    fake.max_linhas = 3
    monkeypatch.setattr(estoque_views, "TAMANHO_PAGINA", 3)
    for i in range(8):
        _lanca(db, 10, f"2026-10-0{i + 1}", status="pendente")
    corpo = api.get("/financeiro/resumo").json()
    assert corpo["faturamento"] == 80 and corpo["a_receber"] == 80


# ── erros do banco ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("operacao,chamada", [
    ("select", lambda a: a.get(URL)),
    ("select", lambda a: a.get("/financeiro/resumo")),
    ("insert", lambda a: a.post(URL, _corpo(), format="json")),
])
def test_tabela_ausente_vira_503_com_instrucao(api, fake, operacao, chamada):
    fake.falhar_em[(operacao, "financeiro_transacoes")] = "42P01"
    r = chamada(api)
    assert r.status_code == 503 and "financeiro.sql" in r.json()["detail"]


def test_sem_permissao_no_banco_vira_500_explicado(api, fake):
    fake.falhar_em[("select", "financeiro_transacoes")] = "42501"
    r = api.get(URL)
    assert r.status_code == 500 and "supabase.env" in r.json()["detail"]


def test_erro_inesperado_do_banco_nao_vaza_detalhe(api, fake):
    fake.falhar_em[("select", "financeiro_transacoes")] = "XX000"
    r = api.get(URL)
    assert r.status_code == 500 and "banco de dados" in r.json()["detail"]
