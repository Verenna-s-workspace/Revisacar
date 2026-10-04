"""
Testes do SQL de Estoque (backend/sql/estoque.sql) contra Postgres real.
"""
import json
import threading

import psycopg2
import psycopg2.errors as pgerr
import pytest

from .conftest import OFICINA_A, OFICINA_B


# ── helpers ────────────────────────────────────────────────────────────────

def novo_item(db, oficina=OFICINA_A, nome="Filtro de óleo", quantidade=10, status="ativo", **extra):
    cols = {
        "oficina_doc": oficina, "nome": nome, "categoria": "Filtros",
        "quantidade": quantidade, "minimo": 2, "preco": 35.5, "localizacao": "A1",
        "status": status,
    }
    if status == "quarentena":
        cols.update(quarentena_motivo="Defeito", quarentena_fornecedor="Beta", quarentena_data_entrada="2026-09-01")
    cols.update(extra)
    cur = db.cursor()
    cur.execute(
        f"insert into estoque_itens ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) returning id",
        list(cols.values()),
    )
    return str(cur.fetchone()[0])


def salvar_kit(db, itens, oficina=OFICINA_A, nome="Kit Revisão", kit_id=None):
    cur = db.cursor()
    cur.execute(
        "select estoque_salvar_kit(%s, %s, %s, %s, %s, %s, %s)",
        (oficina, kit_id, nome, None, None, None,
         json.dumps([{"item_id": i, "quantidade": q} for i, q in itens])),
    )
    return cur.fetchone()[0]


def aplicar(db, kit_id, oficina=OFICINA_A):
    cur = db.cursor()
    cur.execute("select estoque_aplicar_kit(%s, %s)", (oficina, kit_id))
    return cur.fetchone()[0]


def qtd(db, item_id):
    cur = db.cursor()
    cur.execute("select quantidade from estoque_itens where id = %s", (item_id,))
    return float(cur.fetchone()[0])


def movimentos(db, item_id=None):
    cur = db.cursor()
    if item_id:
        cur.execute("select tipo, quantidade, motivo from estoque_movimentos where item_id = %s order by criado_em, id", (item_id,))
    else:
        cur.execute("select tipo, quantidade, motivo from estoque_movimentos")
    return cur.fetchall()


# ── constraints ────────────────────────────────────────────────────────────

def test_quantidade_negativa_e_recusada(db):
    with pytest.raises(pgerr.CheckViolation):
        novo_item(db, quantidade=-1)


def test_quarentena_exige_motivo_e_fornecedor(db):
    cur = db.cursor()
    with pytest.raises(pgerr.CheckViolation):
        cur.execute(
            "insert into estoque_itens (oficina_doc, nome, categoria, status) values (%s, 'X', 'Filtros', 'quarentena')",
            (OFICINA_A,),
        )


def test_item_ativo_nao_carrega_dados_de_quarentena(db):
    cur = db.cursor()
    with pytest.raises(pgerr.CheckViolation):
        cur.execute(
            "insert into estoque_itens (oficina_doc, nome, categoria, status, quarentena_motivo) "
            "values (%s, 'X', 'Filtros', 'ativo', 'sobrou')",
            (OFICINA_A,),
        )


def test_oficina_inexistente_e_recusada(db):
    with pytest.raises(pgerr.ForeignKeyViolation):
        novo_item(db, oficina="99999999000199")


def test_updated_at_comeca_nulo_e_preenche_na_edicao(db):
    item = novo_item(db)
    cur = db.cursor()
    cur.execute("select updated_at from estoque_itens where id = %s", (item,))
    assert cur.fetchone()[0] is None
    cur.execute("update estoque_itens set nome = 'Outro' where id = %s", (item,))
    cur.execute("select updated_at from estoque_itens where id = %s", (item,))
    assert cur.fetchone()[0] is not None


def test_fk_composta_impede_kit_de_uma_oficina_usar_item_de_outra(db):
    item_b = novo_item(db, oficina=OFICINA_B)
    cur = db.cursor()
    cur.execute(
        "insert into estoque_kits (oficina_doc, nome) values (%s, 'Kit A') returning id", (OFICINA_A,)
    )
    kit_a = cur.fetchone()[0]
    with pytest.raises(pgerr.ForeignKeyViolation):
        cur.execute(
            "insert into estoque_kit_itens (kit_id, item_id, oficina_doc, quantidade) values (%s, %s, %s, 1)",
            (kit_a, item_b, OFICINA_A),
        )


def test_item_que_esta_numa_receita_nao_pode_ser_apagado(db):
    item = novo_item(db)
    kit = salvar_kit(db, [(item, 1)])["kit"]["id"]
    cur = db.cursor()
    # ON DELETE RESTRICT => SQLSTATE 23001 (não 23503). A view trata os dois.
    with pytest.raises(pgerr.RestrictViolation):
        cur.execute("delete from estoque_itens where id = %s", (item,))
    # depois de apagar o kit, apaga normal
    cur.execute("delete from estoque_kits where id = %s", (kit,))
    cur.execute("delete from estoque_itens where id = %s", (item,))


def test_apagar_kit_leva_a_receita_e_apagar_item_leva_o_historico(db):
    item = novo_item(db)
    kit = salvar_kit(db, [(item, 1)])["kit"]["id"]
    cur = db.cursor()
    cur.execute("insert into estoque_movimentos (oficina_doc, item_id, tipo, quantidade) values (%s, %s, 'entrada', 5)", (OFICINA_A, item))
    cur.execute("delete from estoque_kits where id = %s", (kit,))
    cur.execute("select count(*) from estoque_kit_itens")
    assert cur.fetchone()[0] == 0
    cur.execute("delete from estoque_itens where id = %s", (item,))
    cur.execute("select count(*) from estoque_movimentos")
    assert cur.fetchone()[0] == 0


# ── aplicar kit ────────────────────────────────────────────────────────────

def test_aplicar_kit_baixa_cada_componente_e_registra_saidas(db):
    a = novo_item(db, nome="Filtro", quantidade=10)
    b = novo_item(db, nome="Óleo", quantidade=6)
    kit = salvar_kit(db, [(a, 1), (b, 4)], nome="Kit Básico")["kit"]["id"]

    r = aplicar(db, kit)

    assert r["ok"] is True
    assert qtd(db, a) == 9 and qtd(db, b) == 2
    assert sorted(movimentos(db)) == sorted([("saida", 1, "Kit: Kit Básico"), ("saida", 4, "Kit: Kit Básico")])
    # devolve o estado novo pro frontend sincronizar sem recarregar tudo
    assert {i["id"]: float(i["quantidade"]) for i in r["itens"]} == {a: 9.0, b: 2.0}
    assert len(r["movimentos"]) == 2
    # a baixa também preenche o updated_at (trigger)
    assert all(i["updated_at"] is not None for i in r["itens"])


def test_aplicar_kit_nunca_aplica_parcial(db):
    a = novo_item(db, nome="Filtro", quantidade=10)
    b = novo_item(db, nome="Óleo", quantidade=2)          # só tem 2, receita pede 4
    kit = salvar_kit(db, [(a, 1), (b, 4)])["kit"]["id"]

    r = aplicar(db, kit)

    assert r["ok"] is False and r["codigo"] == "estoque_insuficiente"
    assert r["mensagem"] == "Estoque insuficiente de Óleo (precisa de 4, disponível 2)."
    assert qtd(db, a) == 10 and qtd(db, b) == 2           # nada foi baixado
    assert movimentos(db) == []


def test_aplicar_kit_bloqueia_item_em_quarentena(db):
    a = novo_item(db, nome="Filtro", quantidade=10)
    b = novo_item(db, nome="Retrovisor", quantidade=10, status="quarentena")
    kit = salvar_kit(db, [(a, 1), (b, 1)])["kit"]["id"]

    r = aplicar(db, kit)

    assert r["ok"] is False and r["codigo"] == "quarentena"
    assert r["mensagem"] == "Retrovisor está em quarentena e não pode ser usado."
    assert qtd(db, a) == 10


def test_mensagem_segue_a_ordem_da_receita(db):
    a = novo_item(db, nome="Primeiro", quantidade=0)
    b = novo_item(db, nome="Segundo", quantidade=0)
    kit = salvar_kit(db, [(b, 1), (a, 1)])["kit"]["id"]     # Segundo vem primeiro na receita
    assert "Segundo" in aplicar(db, kit)["mensagem"]


def test_aplicar_kit_de_outra_oficina_e_kit_inexistente(db):
    a = novo_item(db, quantidade=10)
    kit = salvar_kit(db, [(a, 1)])["kit"]["id"]
    r = aplicar(db, kit, oficina=OFICINA_B)
    assert r["ok"] is False and r["codigo"] == "nao_encontrado"
    assert qtd(db, a) == 10
    r2 = aplicar(db, "00000000-0000-0000-0000-000000000000")
    assert r2["codigo"] == "nao_encontrado"


def test_aplicar_kit_com_decimais(db):
    a = novo_item(db, nome="Fluido", quantidade=3.5)
    kit = salvar_kit(db, [(a, 1.5)])["kit"]["id"]
    assert aplicar(db, kit)["ok"] is True
    assert qtd(db, a) == 2.0
    assert aplicar(db, kit)["ok"] is True
    msg = aplicar(db, kit)["mensagem"]
    assert msg == "Estoque insuficiente de Fluido (precisa de 1.5, disponível 0.5)."


def test_concorrencia_estoque_pra_uma_aplicacao_so_uma_passa(db, pg_dsn):
    """8 pessoas clicando 'aplicar' ao mesmo tempo num kit que só tem
    estoque pra uma vez: exatamente uma passa e nunca fica negativo."""
    a = novo_item(db, nome="Filtro", quantidade=1)
    kit = salvar_kit(db, [(a, 1)])["kit"]["id"]

    resultados, barreira = [], threading.Barrier(8)

    def worker():
        conn = psycopg2.connect(pg_dsn)
        conn.autocommit = True
        try:
            barreira.wait()
            resultados.append(aplicar(conn, kit)["ok"])
        finally:
            conn.close()

    threads = [threading.Thread(target=worker) for _ in range(8)]
    [t.start() for t in threads]
    [t.join() for t in threads]

    assert resultados.count(True) == 1 and resultados.count(False) == 7
    assert qtd(db, a) == 0
    assert len(movimentos(db, a)) == 1


def test_concorrencia_receitas_em_ordem_oposta_nao_dao_deadlock(db, pg_dsn):
    """Kit1 usa [A,B], Kit2 usa [B,A]. Sem ordem de trava fixa isso gera
    deadlock; com a ordem por id, todas as chamadas terminam e as contas fecham."""
    a = novo_item(db, nome="A", quantidade=100)
    b = novo_item(db, nome="B", quantidade=100)
    k1 = salvar_kit(db, [(a, 1), (b, 1)], nome="K1")["kit"]["id"]
    k2 = salvar_kit(db, [(b, 1), (a, 1)], nome="K2")["kit"]["id"]

    erros, oks = [], []

    def worker(kit, n):
        conn = psycopg2.connect(pg_dsn)
        conn.autocommit = True
        try:
            for _ in range(n):
                oks.append(aplicar(conn, kit)["ok"])
        except Exception as e:  # DeadlockDetected apareceria aqui
            erros.append(repr(e))
        finally:
            conn.close()

    threads = [threading.Thread(target=worker, args=(k, 10)) for k in (k1, k2) * 4]
    [t.start() for t in threads]
    [t.join() for t in threads]

    assert erros == []
    assert all(oks) and len(oks) == 80
    assert qtd(db, a) == 20 and qtd(db, b) == 20


# ── ajustar quantidade ─────────────────────────────────────────────────────

def test_ajuste_manual_registra_movimento_ajuste(db):
    item = novo_item(db, quantidade=12)
    cur = db.cursor()
    cur.execute("select estoque_ajustar_quantidade(%s, %s, %s)", (OFICINA_A, item, 8))
    r = cur.fetchone()[0]
    assert r["ok"] is True and float(r["item"]["quantidade"]) == 8
    assert movimentos(db, item) == [("ajuste", 4, "Ajuste manual: 12 → 8")]


def test_ajuste_sem_mudanca_nao_gera_log(db):
    item = novo_item(db, quantidade=5)
    cur = db.cursor()
    cur.execute("select estoque_ajustar_quantidade(%s, %s, %s)", (OFICINA_A, item, 5))
    r = cur.fetchone()[0]
    assert r["ok"] is True and r["movimento"] is None
    assert movimentos(db, item) == []


def test_ajuste_negativo_inexistente_e_de_outra_oficina(db):
    item = novo_item(db, quantidade=5)
    cur = db.cursor()
    cur.execute("select estoque_ajustar_quantidade(%s, %s, %s)", (OFICINA_A, item, -1))
    assert cur.fetchone()[0]["codigo"] == "quantidade_invalida"
    cur.execute("select estoque_ajustar_quantidade(%s, %s, %s)", (OFICINA_B, item, 1))
    assert cur.fetchone()[0]["codigo"] == "nao_encontrado"
    assert qtd(db, item) == 5


# ── salvar kit ─────────────────────────────────────────────────────────────

def test_salvar_kit_cria_e_edita_substituindo_a_receita(db):
    a, b, c = (novo_item(db, nome=n) for n in "ABC")
    r = salvar_kit(db, [(a, 1), (b, 2)], nome="  Kit  ")
    assert r["ok"] is True and r["kit"]["nome"] == "Kit"
    kit_id = r["kit"]["id"]
    assert [(i["item_id"], float(i["quantidade"])) for i in r["itens"]] == [(a, 1.0), (b, 2.0)]

    r2 = salvar_kit(db, [(c, 3), (a, 1)], nome="Kit v2", kit_id=kit_id)
    assert r2["ok"] is True and r2["kit"]["id"] == kit_id and r2["kit"]["updated_at"] is not None
    assert [(i["item_id"], float(i["quantidade"])) for i in r2["itens"]] == [(c, 3.0), (a, 1.0)]  # ordem preservada


def test_salvar_kit_invalido_nao_estraga_a_receita_antiga(db):
    a = novo_item(db, nome="A")
    item_b = novo_item(db, oficina=OFICINA_B, nome="De outra oficina")
    kit_id = salvar_kit(db, [(a, 2)])["kit"]["id"]

    r = salvar_kit(db, [(item_b, 1)], kit_id=kit_id, nome="Tentativa")
    assert r["ok"] is False and r["codigo"] == "item_inexistente"
    r2 = salvar_kit(db, [], kit_id=kit_id)
    assert r2["ok"] is False and r2["codigo"] == "kit_vazio"
    r3 = salvar_kit(db, [(a, 1)], kit_id=kit_id, nome="   ")
    assert r3["ok"] is False and r3["codigo"] == "nome_obrigatorio"

    cur = db.cursor()
    cur.execute("select nome from estoque_kits where id = %s", (kit_id,))
    assert cur.fetchone()[0] == "Kit Revisão"                       # nome antigo intacto
    cur.execute("select quantidade from estoque_kit_itens where kit_id = %s", (kit_id,))
    assert [float(x[0]) for x in cur.fetchall()] == [2.0]           # receita antiga intacta


def test_salvar_kit_de_outra_oficina_ou_inexistente(db):
    a = novo_item(db)
    kit_id = salvar_kit(db, [(a, 1)])["kit"]["id"]
    r = salvar_kit(db, [(a, 1)], oficina=OFICINA_B, kit_id=kit_id)
    assert r["ok"] is False                                         # item de A não existe pra B
    item_b = novo_item(db, oficina=OFICINA_B)
    r2 = salvar_kit(db, [(item_b, 1)], oficina=OFICINA_B, kit_id=kit_id)
    assert r2["ok"] is False and r2["codigo"] == "nao_encontrado"   # kit de A não é editável por B
