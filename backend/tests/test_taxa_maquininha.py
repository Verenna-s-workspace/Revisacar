"""
Taxa da maquininha nas entradas do Financeiro (migration 0009) — Postgres real.

O que importa provar:
  • `valor` continua sendo o bruto (o que o cliente pagou); o líquido é `valor - taxa`, calculado na leitura;
  • quem não usa taxa não muda nada (nem o payload, nem os totais);
  • taxa só em entrada, nunca negativa e sempre menor que o valor — na API e no banco;
  • Resumo: faturamento bruto, recebido/saldo líquidos, taxa descontada do lucro;
  • Visão Geral: o lucro bate com o do Financeiro;
  • reserva de caixa incide sobre o líquido e acompanha a taxa quando ela é corrigida depois;
  • antes da migration (coluna ausente) o Financeiro segue funcionando.
"""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import django
import psycopg2
import pytest
from postgrest.exceptions import APIError

django.setup()

from orders import estoque_views, financeiro_views, relatorios_views, reserva_views, views, visao_geral_views  # noqa: E402
from orders.taxa import com_taxa, soma_liquido, soma_taxas  # noqa: E402

from .conftest import OFICINA_A  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
URL = "/financeiro/transacoes"
RESUMO = "/financeiro/resumo?de=2026-10-01&ate=2026-10-31"


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (financeiro_views, relatorios_views, reserva_views, views, visao_geral_views, estoque_views):
        monkeypatch.setattr(modulo, "supabase", f)
    # Sexta, 9/10/2026, 15h em São Paulo (mesmo "hoje" dos testes do Financeiro).
    monkeypatch.setattr(visao_geral_views, "_agora", lambda tz: datetime(2026, 10, 9, 15, 0, tzinfo=SP).astimezone(tz))
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


# ── helpers ───────────────────────────────────────────────────────────────────

def _corpo(**extra):
    base = {"tipo": "entrada", "categoria": "servicos", "descricao": "Troca de óleo", "valor": 1000,
            "forma_pagamento": "credito", "status": "pago", "data_competencia": "2026-10-09"}
    base.update(extra)
    return base


def _lanca(db, valor, tipo="entrada", status="pago", taxa=0, categoria=None, dia="2026-10-05", oficina=OFICINA_A):
    cur = db.cursor()
    cur.execute(
        "insert into financeiro_transacoes (oficina_doc, tipo, categoria, valor, taxa, status, data_competencia) "
        "values (%s,%s,%s,%s,%s,%s,%s) returning id",
        (oficina, tipo, categoria or ("servicos" if tipo == "entrada" else "aluguel"), valor, taxa, status, dia),
    )
    return str(cur.fetchone()[0])


def _taxa_no_banco(db, id_):
    cur = db.cursor()
    cur.execute("select taxa from financeiro_transacoes where id=%s", (id_,))
    return float(cur.fetchone()[0])


def _ligar_reserva(db, percentual=20, escopo="servicos"):
    import json
    cur = db.cursor()
    cur.execute("update admins set reserva_config = %s where doc = %s",
                (json.dumps({"ativa": True, "percentual": percentual, "escopo": escopo}), OFICINA_A))


def _depositos(db, status="ativo"):
    cur = db.cursor()
    cur.execute("select valor, base_valor from financeiro_reservas "
                "where oficina_doc=%s and tipo='deposito' and status=%s order by created_at, id", (OFICINA_A, status))
    return [(float(v), float(b)) for v, b in cur.fetchall()]


# ── API: criar e editar ───────────────────────────────────────────────────────

def test_entrada_com_taxa_guarda_o_bruto_e_devolve_o_liquido(api, db):
    r = api.post(URL, _corpo(valor=1000, taxa=35.5), format="json")
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["valor"] == 1000 and corpo["taxa"] == 35.5 and corpo["valor_liquido"] == 964.5
    assert _taxa_no_banco(db, corpo["id"]) == 35.5


def test_sem_taxa_nada_muda(api, db):
    r = api.post(URL, _corpo(valor=150), format="json")
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["taxa"] == 0 and corpo["valor_liquido"] == 150
    assert _taxa_no_banco(db, corpo["id"]) == 0


@pytest.mark.parametrize("corpo,campo", [
    (_corpo(valor=100, taxa=100), "taxa"),       # a taxa não pode comer o valor inteiro
    (_corpo(valor=100, taxa=150), "taxa"),
    (_corpo(taxa=-1), "taxa"),                   # nunca negativa
    (_corpo(tipo="saida", categoria="aluguel", taxa=5), "taxa"),   # só entrada tem taxa de maquininha
])
def test_taxa_invalida_e_422(api, corpo, campo):
    r = api.post(URL, corpo, format="json")
    assert r.status_code == 422 and campo in r.json()


def test_editar_a_taxa_depois_de_ler_o_extrato(api, db):
    tid = api.post(URL, _corpo(valor=500), format="json").json()["id"]
    r = api.patch(f"{URL}/{tid}", {"taxa": 17.25}, format="json")
    assert r.status_code == 200 and r.json()["valor_liquido"] == 482.75
    assert _taxa_no_banco(db, tid) == 17.25
    # E dá para zerar de novo.
    r = api.patch(f"{URL}/{tid}", {"taxa": 0}, format="json")
    assert r.status_code == 200 and r.json()["valor_liquido"] == 500


def test_nao_da_para_baixar_o_valor_abaixo_da_taxa(api, db):
    tid = api.post(URL, _corpo(valor=500, taxa=40), format="json").json()["id"]
    r = api.patch(f"{URL}/{tid}", {"valor": 30}, format="json")
    assert r.status_code == 422 and "taxa" in r.json()
    assert api.patch(f"{URL}/{tid}", {"valor": 400}, format="json").json()["valor_liquido"] == 360


def test_listagem_traz_taxa_e_liquido(api, db):
    _lanca(db, 200, taxa=10)
    _lanca(db, 80)
    linhas = {l["valor"]: l for l in api.get(f"{URL}?de=2026-10-01&ate=2026-10-31").json()}
    assert linhas[200]["taxa"] == 10 and linhas[200]["valor_liquido"] == 190
    assert linhas[80]["taxa"] == 0 and linhas[80]["valor_liquido"] == 80


# ── banco: travas ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("tipo,valor,taxa", [
    ("entrada", 100, 100),
    ("entrada", 100, 120),
    ("entrada", 100, -1),
    ("saida", 100, 5),
])
def test_banco_recusa_taxa_invalida(db, tipo, valor, taxa):
    with pytest.raises(psycopg2.errors.CheckViolation):
        _lanca(db, valor, tipo=tipo, taxa=taxa)


# ── Resumo ────────────────────────────────────────────────────────────────────

def test_resumo_separa_bruto_liquido_e_taxa(api, db):
    _lanca(db, 1000, taxa=35)                      # paga, com taxa
    _lanca(db, 500)                                # paga, sem taxa
    _lanca(db, 200, status="pendente")             # ainda a receber
    _lanca(db, 300, tipo="saida")                  # despesa paga
    r = api.get(RESUMO).json()
    assert r["faturamento"] == 1700                # bruto: o que os clientes pagaram (inclui o pendente)
    assert r["taxas"] == 35
    assert r["recebido"] == 1465                   # líquido das pagas: 965 + 500
    assert r["saldo"] == 1165                      # 1465 - 300
    assert r["a_receber"] == 200
    assert r["lucro"] == 1365                      # 1700 - 35 - 300: a taxa é custo
    assert r["margem_percentual"] == round(1365 / 1700 * 100, 1)


def test_resumo_sem_nenhuma_taxa_fica_igual_ao_de_antes(api, db):
    _lanca(db, 1000)
    _lanca(db, 300, tipo="saida")
    r = api.get(RESUMO).json()
    assert r["faturamento"] == 1000 and r["recebido"] == 1000 and r["saldo"] == 700
    assert r["taxas"] == 0 and r["lucro"] == 700


def test_a_receber_pendente_tambem_e_liquido(api, db):
    _lanca(db, 400, status="pendente", taxa=20)
    assert api.get(RESUMO).json()["a_receber"] == 380


# ── Visão Geral ───────────────────────────────────────────────────────────────

def test_visao_geral_desconta_a_taxa_do_lucro(api, db):
    _lanca(db, 1000, taxa=50, dia="2026-10-05")
    _lanca(db, 300, tipo="saida", dia="2026-10-06")
    f = api.get("/visao-geral").json()["financeiro"]
    assert f["receitas"] == 1000                   # receita segue bruta
    assert f["despesas"] == 300
    assert f["lucro"] == 650                       # 1000 - 50 - 300, igual ao Financeiro


# ── Reserva de caixa sobre o líquido ──────────────────────────────────────────

def test_reserva_incide_sobre_o_liquido(api, db):
    _ligar_reserva(db, 20, "servicos")
    api.post(URL, _corpo(valor=1000, taxa=50), format="json")
    # 20% de (1000 - 50) = 190, e a base guardada é o líquido.
    assert _depositos(db) == [(190.0, 950.0)]


def test_reserva_sem_taxa_continua_igual(api, db):
    _ligar_reserva(db, 20, "servicos")
    api.post(URL, _corpo(valor=1000), format="json")
    assert _depositos(db) == [(200.0, 1000.0)]


def test_corrigir_a_taxa_depois_recalcula_a_reserva(api, db):
    _ligar_reserva(db, 20, "servicos")
    tid = api.post(URL, _corpo(valor=1000), format="json").json()["id"]
    assert _depositos(db) == [(200.0, 1000.0)]
    assert api.patch(f"{URL}/{tid}", {"taxa": 100}, format="json").status_code == 200
    assert _depositos(db) == [(180.0, 900.0)]
    assert api.patch(f"{URL}/{tid}", {"taxa": 0}, format="json").status_code == 200
    assert _depositos(db) == [(200.0, 1000.0)]


def test_taxa_em_entrada_pendente_so_conta_quando_paga(api, db):
    _ligar_reserva(db, 20, "servicos")
    tid = api.post(URL, _corpo(valor=1000, taxa=50, status="pendente"), format="json").json()["id"]
    assert _depositos(db) == []
    assert api.patch(f"{URL}/{tid}", {"status": "pago"}, format="json").status_code == 200
    assert _depositos(db) == [(190.0, 950.0)]


def test_deposito_antigo_nao_e_reescrito_pela_migration(db):
    # Depósito nascido antes da 0009 (base = bruto) segue como está até a entrada ser editada.
    _ligar_reserva(db, 20, "servicos")
    tid = _lanca(db, 1000)
    assert _depositos(db) == [(200.0, 1000.0)]
    cur = db.cursor()
    cur.execute("update financeiro_transacoes set descricao = 'só texto' where id = %s", (tid,))
    assert _depositos(db) == [(200.0, 1000.0)]


# ── Antes da migration (coluna ausente) ───────────────────────────────────────

def test_com_taxa_tenta_de_novo_sem_a_coluna():
    chamadas = []

    def consultar(campos):
        chamadas.append(campos)
        if "taxa" in campos:
            raise APIError({"message": "column financeiro_transacoes.taxa does not exist", "code": "42703"})
        return [{"id": "1", "valor": 100}]

    assert com_taxa(consultar, "id,valor") == [{"id": "1", "valor": 100}]
    assert chamadas == ["id,valor,taxa", "id,valor"]


def test_com_taxa_nao_engole_outros_erros():
    def consultar(campos):
        raise APIError({"message": "sem permissão", "code": "42501"})

    with pytest.raises(APIError):
        com_taxa(consultar, "id,valor")


def test_linhas_sem_a_coluna_valem_taxa_zero():
    linhas = [{"valor": 100}, {"valor": 50.5, "taxa": None}, {"valor": 200, "taxa": 10}]
    assert soma_taxas(linhas) == Decimal("10")
    assert soma_liquido(linhas) == Decimal("340.5")
