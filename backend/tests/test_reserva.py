"""
Reserva de caixa (migration 0008 + /financeiro/reserva*) — Postgres real.

O que importa provar:
  • desligada por padrão: nada muda para quem não usa (nem o gatilho cria linha, nem o Resumo muda);
  • o gatilho acompanha a entrada (pagou / editou / voltou a pendente / cancelou) com a regra da época;
  • o escopo (serviços, peças, ambos) escolhe quais entradas geram reserva;
  • retirada confere o saldo sob trava; permissões; isolamento entre oficinas; migration ausente → 503.
"""
import threading

import django
import psycopg2
import pytest

django.setup()

from orders import estoque_views, financeiro_views, relatorios_views, reserva_views, views, visao_geral_views  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente  # noqa: E402

CONFIG = "/financeiro/reserva/config"
RESERVA = "/financeiro/reserva"
RETIRADAS = "/financeiro/reserva/retiradas"
TRANSACOES = "/financeiro/transacoes"


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (financeiro_views, reserva_views, relatorios_views, views, visao_geral_views, estoque_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


# ── helpers ───────────────────────────────────────────────────────────────────

def _ligar(db, percentual=20, escopo="servicos", ativa=True, oficina=OFICINA_A):
    import json
    cur = db.cursor()
    cur.execute("update admins set reserva_config = %s where doc = %s",
                (json.dumps({"ativa": ativa, "percentual": percentual, "escopo": escopo}), oficina))


def _entrada(db, valor=1000, categoria="servicos", status="pago", tipo="entrada", oficina=OFICINA_A, os_id=None):
    cur = db.cursor()
    cur.execute(
        "insert into financeiro_transacoes (oficina_doc, tipo, categoria, valor, status, data_competencia, ordem_servico_id) "
        "values (%s,%s,%s,%s,%s,'2026-11-05',%s) returning id",
        (oficina, tipo, categoria if tipo == "entrada" else "aluguel", valor, status, os_id),
    )
    return str(cur.fetchone()[0])


def _depositos(db, oficina=OFICINA_A, status="ativo"):
    cur = db.cursor()
    cur.execute("select transacao_id, valor, percentual, escopo, categoria, base_valor, ordem_servico_id "
                "from financeiro_reservas where oficina_doc=%s and tipo='deposito' and status=%s order by created_at, id",
                (oficina, status))
    return cur.fetchall()


def _saldo(api_):
    return api_.get(RESERVA).json()["saldo"]


# ── desligada por padrão ──────────────────────────────────────────────────────

def test_sem_configuracao_nada_e_reservado(db):
    _entrada(db, 1000, "servicos")
    assert _depositos(db) == []


def test_configuracao_desligada_nao_reserva_mesmo_com_percentual(db):
    _ligar(db, 20, "ambos", ativa=False)
    _entrada(db, 1000, "servicos")
    assert _depositos(db) == []


def test_get_config_padrao_vem_desligada(api):
    r = api.get(CONFIG)
    assert r.status_code == 200
    assert r.json() == {"ativa": False, "percentual": 0, "escopo": "servicos", "salvo": False, "atualizadoEm": None}


def test_resumo_nao_muda_com_a_reserva_ligada(api, db):
    _ligar(db, 20, "ambos")
    _entrada(db, 1000, "servicos")
    _entrada(db, 500, "pecas")
    r = api.get("/financeiro/resumo?de=2026-11-01&ate=2026-11-30").json()
    # A reserva é separação interna: receita e saldo do caixa continuam inteiros.
    assert r["faturamento"] == 1500 and r["recebido"] == 1500 and r["saldo"] == 1500


# ── escopo ────────────────────────────────────────────────────────────────────

def test_escopo_servicos_reserva_so_servicos(db):
    _ligar(db, 20, "servicos")
    s = _entrada(db, 1000, "servicos")
    _entrada(db, 500, "pecas")
    _entrada(db, 300, "acessorios")
    _entrada(db, 300, "outros")
    d = _depositos(db)
    assert len(d) == 1 and str(d[0][0]) == s and float(d[0][1]) == 200 and float(d[0][2]) == 20 and d[0][3] == "servicos"


def test_escopo_pecas_reserva_so_pecas(db):
    _ligar(db, 10, "pecas")
    _entrada(db, 1000, "servicos")
    _entrada(db, 500, "pecas")
    d = _depositos(db)
    assert len(d) == 1 and d[0][4] == "pecas" and float(d[0][1]) == 50


def test_escopo_ambos_reserva_servicos_e_pecas(db):
    _ligar(db, 20, "ambos")
    _entrada(db, 1000, "servicos")
    _entrada(db, 500, "pecas")
    _entrada(db, 300, "acessorios")
    assert sorted(float(x[1]) for x in _depositos(db)) == [100, 200]


def test_saida_nunca_gera_reserva(db):
    _ligar(db, 20, "ambos")
    _entrada(db, 1000, tipo="saida")
    assert _depositos(db) == []


def test_arredonda_centavos(db):
    _ligar(db, 20, "servicos")
    _entrada(db, 33.33, "servicos")          # 6,666 → 6,67
    assert float(_depositos(db)[0][1]) == 6.67


def test_copia_a_os_e_a_base_para_o_historico(db):
    _ligar(db, 20, "servicos")
    _entrada(db, 800, "servicos", os_id="OS-77")
    d = _depositos(db)[0]
    assert d[6] == "OS-77" and float(d[5]) == 800


# ── ciclo de vida da entrada ──────────────────────────────────────────────────

def test_pendente_so_reserva_quando_paga(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos", status="pendente")
    assert _depositos(db) == []
    assert api.patch(f"{TRANSACOES}/{tid}", {"status": "pago"}, format="json").status_code == 200
    assert float(_depositos(db)[0][1]) == 200 and _saldo(api) == 200


def test_editar_o_valor_recalcula_com_o_percentual_da_epoca(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    # A oficina muda a regra depois: o depósito existente continua com 20%.
    _ligar(db, 50, "ambos")
    assert api.patch(f"{TRANSACOES}/{tid}", {"valor": 600}, format="json").status_code == 200
    d = _depositos(db)
    assert len(d) == 1 and float(d[0][1]) == 120 and float(d[0][2]) == 20 and d[0][3] == "servicos"


def test_voltar_a_pendente_cancela_a_reserva_e_pagar_de_novo_recria(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    api.patch(f"{TRANSACOES}/{tid}", {"status": "pendente"}, format="json")
    assert _depositos(db) == [] and len(_depositos(db, status="cancelado")) == 1 and _saldo(api) == 0
    api.patch(f"{TRANSACOES}/{tid}", {"status": "pago"}, format="json")
    assert len(_depositos(db)) == 1 and _saldo(api) == 200


def test_cancelar_a_entrada_cancela_a_reserva(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    assert api.delete(f"{TRANSACOES}/{tid}").status_code == 204
    assert _depositos(db) == [] and _saldo(api) == 0


def test_trocar_categoria_para_fora_do_escopo_cancela(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    api.patch(f"{TRANSACOES}/{tid}", {"categoria": "outros"}, format="json")
    assert _depositos(db) == []


def test_trocar_categoria_dentro_do_escopo_mantem(api, db):
    _ligar(db, 20, "ambos")
    tid = _entrada(db, 1000, "servicos")
    api.patch(f"{TRANSACOES}/{tid}", {"categoria": "pecas"}, format="json")
    d = _depositos(db)
    assert len(d) == 1 and d[0][4] == "pecas" and float(d[0][1]) == 200


def test_criar_ja_paga_pela_api_reserva(api, db):
    _ligar(db, 20, "servicos")
    r = api.post(TRANSACOES, {"tipo": "entrada", "categoria": "servicos", "valor": 250, "status": "pago",
                              "data_competencia": "2026-11-05"}, format="json")
    assert r.status_code == 201
    assert _saldo(api) == 50


# ── sem efeito retroativo ─────────────────────────────────────────────────────

def test_ligar_a_reserva_nao_cria_reserva_de_pagamentos_antigos(api, db):
    tid = _entrada(db, 1000, "servicos")                  # pago ANTES de ligar
    _ligar(db, 20, "servicos")
    api.patch(f"{TRANSACOES}/{tid}", {"valor": 1200, "descricao": "ajuste"}, format="json")
    assert _depositos(db) == [] and _saldo(api) == 0


def test_desligar_nao_apaga_o_historico_nem_para_de_acompanhar_a_entrada(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    _ligar(db, 20, "servicos", ativa=False)
    assert _saldo(api) == 200                              # saldo guardado continua lá
    _entrada(db, 1000, "servicos")                         # novo pagamento: já não reserva
    assert _saldo(api) == 200
    api.patch(f"{TRANSACOES}/{tid}", {"valor": 500}, format="json")
    assert _saldo(api) == 100                              # a reserva já feita acompanha a entrada


def test_config_corrompida_nunca_derruba_o_lancamento(db):
    import json
    cur = db.cursor()
    for cfg in ({"ativa": True, "percentual": "abc", "escopo": "servicos"},
                {"ativa": True, "percentual": 20, "escopo": "tudo"},
                {"ativa": True, "percentual": 250, "escopo": "ambos"},
                {"ativa": True, "percentual": -5, "escopo": "ambos"},
                {"ativa": "sim", "percentual": 20, "escopo": "ambos"}):
        cur.execute("update admins set reserva_config = %s where doc = %s", (json.dumps(cfg), OFICINA_A))
        _entrada(db, 1000, "servicos")                     # não pode levantar erro
    assert _depositos(db) == []


# ── configuração (GET/PUT) ────────────────────────────────────────────────────

def test_dono_salva_e_le_a_configuracao(api):
    r = api.put(CONFIG, {"ativa": True, "percentual": 20, "escopo": "ambos"}, format="json")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ativa"] is True and corpo["percentual"] == 20 and corpo["escopo"] == "ambos" and corpo["salvo"] is True
    assert api.get(CONFIG).json()["escopo"] == "ambos"


def test_percentual_com_casas_decimais(api, db):
    api.put(CONFIG, {"ativa": True, "percentual": 12.5, "escopo": "servicos"}, format="json")
    assert api.get(CONFIG).json()["percentual"] == 12.5
    _entrada(db, 1000, "servicos")
    assert float(_depositos(db)[0][1]) == 125


@pytest.mark.parametrize("corpo", [
    {"ativa": True, "percentual": 0, "escopo": "servicos"},
    {"ativa": True, "percentual": 100.01, "escopo": "servicos"},
    {"ativa": True, "percentual": -1, "escopo": "servicos"},
    {"ativa": True, "percentual": 20, "escopo": "tudo"},
    {"ativa": True, "percentual": 20},
    {"percentual": 20, "escopo": "ambos"},
])
def test_configuracao_invalida_e_422(api, corpo):
    assert api.put(CONFIG, corpo, format="json").status_code == 422


def test_desligar_aceita_percentual_zero(api):
    assert api.put(CONFIG, {"ativa": False, "percentual": 0, "escopo": "servicos"}, format="json").status_code == 200


def test_corpo_que_nao_e_objeto_e_400(api):
    assert api.put(CONFIG, [1, 2], format="json").status_code == 400


# ── permissões ────────────────────────────────────────────────────────────────

def test_gerente_ve_o_saldo_mas_nao_configura_nem_retira(fake, db):
    gerente = _cliente("gerente")
    assert gerente.get(RESERVA).status_code == 200
    assert gerente.get(CONFIG).status_code == 200
    assert gerente.put(CONFIG, {"ativa": True, "percentual": 20, "escopo": "ambos"}, format="json").status_code == 403
    assert gerente.post(RETIRADAS, {"valor": 10}, format="json").status_code == 403


@pytest.mark.parametrize("cargo", ["mecanico", "atendente"])
def test_cargos_sem_financeiro_nao_veem_nada(fake, cargo):
    c = _cliente(cargo)
    assert c.get(RESERVA).status_code == 403
    assert c.get(CONFIG).status_code == 403
    assert c.put(CONFIG, {"ativa": True, "percentual": 20, "escopo": "ambos"}, format="json").status_code == 403


def test_sem_token_e_401(fake):
    from rest_framework.test import APIClient
    assert APIClient().get(RESERVA).status_code == 401


# ── retiradas ─────────────────────────────────────────────────────────────────

def test_retirada_abate_o_saldo_e_aparece_no_historico(api, db):
    _ligar(db, 20, "servicos")
    _entrada(db, 1000, "servicos")
    r = api.post(RETIRADAS, {"valor": 75.5, "descricao": "Conserto do compressor"}, format="json")
    assert r.status_code == 201 and r.json()["saldo"] == 124.5
    corpo = api.get(RESERVA).json()
    assert corpo["saldo"] == 124.5 and corpo["totalGuardado"] == 200 and corpo["totalRetirado"] == 75.5
    tipos = sorted(m["tipo"] for m in corpo["movimentos"])
    assert tipos == ["deposito", "retirada"]
    retirada = next(m for m in corpo["movimentos"] if m["tipo"] == "retirada")
    assert retirada["descricao"] == "Conserto do compressor" and retirada["valor"] == 75.5


def test_retirada_acima_do_saldo_e_409_e_nada_muda(api, db):
    _ligar(db, 20, "servicos")
    _entrada(db, 1000, "servicos")
    r = api.post(RETIRADAS, {"valor": 200.01}, format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "saldo_insuficiente" and r.json()["saldo"] == 200
    assert "200,00" in r.json()["detail"]
    assert _saldo(api) == 200


def test_retirada_do_saldo_inteiro_deixa_zero(api, db):
    _ligar(db, 20, "servicos")
    _entrada(db, 1000, "servicos")
    assert api.post(RETIRADAS, {"valor": 200}, format="json").status_code == 201
    assert _saldo(api) == 0


@pytest.mark.parametrize("corpo", [{}, {"valor": 0}, {"valor": -5}, {"valor": "abc"}, {"valor": 1, "descricao": "x" * 201}])
def test_retirada_invalida_e_422(api, corpo):
    assert api.post(RETIRADAS, corpo, format="json").status_code == 422


def test_desfazer_retirada_devolve_o_valor_ao_saldo(api, db):
    _ligar(db, 20, "servicos")
    _entrada(db, 1000, "servicos")
    rid = api.post(RETIRADAS, {"valor": 80}, format="json").json()["id"]
    assert _saldo(api) == 120
    assert api.delete(f"{RETIRADAS}/{rid}").status_code == 204
    assert _saldo(api) == 200
    assert api.delete(f"{RETIRADAS}/{rid}").status_code == 204        # repetir é inofensivo


def test_desfazer_retirada_inexistente_ou_de_outra_oficina_e_404(api, db, fake):
    _ligar(db, 20, "servicos")
    _entrada(db, 1000, "servicos")
    rid = api.post(RETIRADAS, {"valor": 10}, format="json").json()["id"]
    assert _cliente(oficina=OFICINA_B).delete(f"{RETIRADAS}/{rid}").status_code == 404
    assert api.delete(f"{RETIRADAS}/00000000-0000-0000-0000-000000000000").status_code == 404
    assert api.delete(f"{RETIRADAS}/abc").status_code == 404
    assert _saldo(api) == 190


def test_nao_da_para_desfazer_um_deposito_pela_rota_de_retiradas(api, db):
    _ligar(db, 20, "servicos")
    _entrada(db, 1000, "servicos")
    cur = db.cursor()
    cur.execute("select id from financeiro_reservas where tipo='deposito'")
    dep_id = str(cur.fetchone()[0])
    assert api.delete(f"{RETIRADAS}/{dep_id}").status_code == 404
    assert _saldo(api) == 200


def test_duas_retiradas_ao_mesmo_tempo_nao_estouram_o_saldo(pg_dsn, db):
    _ligar(db, 20, "servicos")
    _entrada(db, 500, "servicos")                           # saldo 100
    resultados = []

    def retirar():
        conn = psycopg2.connect(pg_dsn)
        conn.autocommit = False
        try:
            cur = conn.cursor()
            cur.execute("select reserva_retirar(%s, %s, %s, %s)", (OFICINA_A, 80, "concorrente", "t"))
            resultados.append(cur.fetchone()[0]["ok"])
            conn.commit()
        finally:
            conn.close()

    ts = [threading.Thread(target=retirar) for _ in range(2)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(resultados) == [False, True]


def test_estorno_depois_de_gastar_deixa_o_saldo_negativo_visivel(api, db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    api.post(RETIRADAS, {"valor": 200}, format="json")
    api.patch(f"{TRANSACOES}/{tid}", {"status": "pendente"}, format="json")
    assert _saldo(api) == -200


# ── isolamento entre oficinas ─────────────────────────────────────────────────

def test_cada_oficina_tem_sua_config_e_seu_saldo(api, db, fake):
    outra = _cliente(oficina=OFICINA_B)
    _ligar(db, 20, "servicos", oficina=OFICINA_A)
    _entrada(db, 1000, "servicos", oficina=OFICINA_A)
    _entrada(db, 1000, "servicos", oficina=OFICINA_B)       # B não ligou a reserva
    assert _saldo(api) == 200
    assert _saldo(outra) == 0
    assert outra.get(CONFIG).json()["ativa"] is False
    assert outra.post(RETIRADAS, {"valor": 1}, format="json").status_code == 409


# ── migration ausente ─────────────────────────────────────────────────────────

def test_sem_a_migration_as_rotas_dizem_para_rodar_e_o_resto_segue(api, fake):
    fake.falhar_em[("select", "financeiro_reservas")] = "42P01"
    r = api.get(RESERVA)
    assert r.status_code == 503 and "0008" in r.json()["detail"]
    # O Financeiro em si não depende da reserva.
    assert api.get("/financeiro/resumo?de=2026-11-01&ate=2026-11-30").status_code == 200


def test_sem_a_coluna_a_config_vem_desligada_e_salvar_manda_rodar(api, fake):
    fake.falhar_em[("select", "admins")] = "42703"
    assert api.get(CONFIG).json()["ativa"] is False
    fake.falhar_em.clear()
    fake.falhar_em[("update", "admins")] = "42703"
    r = api.put(CONFIG, {"ativa": True, "percentual": 20, "escopo": "ambos"}, format="json")
    assert r.status_code == 503 and "0008" in r.json()["detail"]


# ── SQL ───────────────────────────────────────────────────────────────────────

def test_so_um_deposito_vivo_por_entrada(db):
    _ligar(db, 20, "servicos")
    tid = _entrada(db, 1000, "servicos")
    cur = db.cursor()
    with pytest.raises(psycopg2.errors.UniqueViolation):
        cur.execute("insert into financeiro_reservas (oficina_doc, tipo, valor, transacao_id, percentual, escopo) "
                    "values (%s,'deposito',1,%s,20,'servicos')", (OFICINA_A, tid))


def test_deposito_exige_origem_e_regra(db):
    cur = db.cursor()
    with pytest.raises(psycopg2.errors.CheckViolation):
        cur.execute("insert into financeiro_reservas (oficina_doc, tipo, valor) values (%s,'deposito',10)", (OFICINA_A,))


def test_listagem_limita_os_movimentos_mas_soma_tudo(api, db):
    _ligar(db, 10, "servicos")
    for _ in range(105):
        _entrada(db, 100, "servicos")                      # 10 cada
    corpo = api.get(RESERVA).json()
    assert len(corpo["movimentos"]) == 100 and corpo["truncado"] is True and corpo["saldo"] == 1050
