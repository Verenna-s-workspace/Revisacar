"""Fase 4: aprovar/enviar-revisão/recusar mexem no Financeiro e na reserva de estoque, na mesma transação."""
import uuid

import django
import pytest

django.setup()

from orders import estoque_views  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .test_orcamento import (  # noqa: E402,F401
    _cliente, _enviado, _forca_os, _os, _peca, _rascunho, _servico, _status_os, dono, fake, gerente, hoje,
)


@pytest.fixture(autouse=True)
def _estoque_no_fake(fake, monkeypatch):
    monkeypatch.setattr(estoque_views, "supabase", fake)


def _item_estoque(db, nome="Pastilha", quantidade=10, oficina=OFICINA_A):
    cur = db.cursor()
    cur.execute(
        "insert into estoque_itens (oficina_doc, nome, categoria, quantidade, preco) values (%s,%s,'freios',%s,50) returning id",
        (oficina, nome, quantidade),
    )
    return str(cur.fetchone()[0])


def _lancamentos(db, oid, incluir_cancelados=False):
    cur = db.cursor()
    cur.execute(
        "select categoria, valor, status, descricao, cliente_nome, origem, data_competencia::text, tipo "
        "from financeiro_transacoes where ordem_servico_id=%s and origem='orcamento' "
        + ("" if incluir_cancelados else "and status <> 'cancelado' ") + "order by categoria",
        (oid,),
    )
    return [dict(zip(("categoria", "valor", "status", "descricao", "cliente", "origem", "competencia", "tipo"), r)) for r in cur.fetchall()]


def _reservas(db, oid):
    cur = db.cursor()
    cur.execute("select item_id::text, quantidade from estoque_reservas where ordem_id=%s order by item_id", (oid,))
    return {r[0]: float(r[1]) for r in cur.fetchall()}


def _aprovar(api, orc):
    r = api.post(f"/orcamentos/{orc['id']}/aprovar", format="json")
    assert r.status_code == 200, r.content
    return r.json()


def _revisar(api, oid, itens):
    """Nova versão a partir da ativa, com `itens`, já enviada."""
    r = api.post(f"/ordens/{oid}/orcamentos", format="json")
    assert r.status_code == 201, r.content
    v = api.patch(f"/orcamentos/{r.json()['id']}", {"itens": itens}, format="json").json()
    env = api.post(f"/orcamentos/{v['id']}/enviar", format="json")
    assert env.status_code == 200, env.content
    return env.json()


# ── aprovar ──────────────────────────────────────────────────────────────────

def test_aprovar_cria_lancamentos_pendentes_e_reserva(dono, db):
    oid = _os(dono)
    item = _item_estoque(db, quantidade=10)
    orc = _enviado(dono, oid, [_peca("Pastilha", 2, 100, estoqueItemId=item), _servico("Alinhamento", 1, 80)])
    assert _lancamentos(db, oid) == []          # enviar sozinho não gera nada
    corpo = _aprovar(dono, orc)

    lanc = _lancamentos(db, oid)
    assert [(l["categoria"], l["valor"], l["status"]) for l in lanc] == [("pecas", 200, "pendente"), ("servicos", 80, "pendente")]
    assert all(l["tipo"] == "entrada" and l["origem"] == "orcamento" and l["competencia"] == "2026-10-12" for l in lanc)
    assert "v1" in lanc[0]["descricao"] and lanc[0]["cliente"]
    assert _reservas(db, oid) == {item: 2.0}

    ef = corpo["efeitos"]
    assert {f["categoria"]: (f["acao"], f["valor"]) for f in ef["financeiro"]} == {"pecas": ("criado", 200), "servicos": ("criado", 80)}
    assert ef["reservas"] == 1 and ef["faltas"] == [] and ef["avisos"] == []


def test_so_servicos_gera_um_lancamento_e_total_zero_nenhum(dono, db):
    oid = _os(dono)
    _aprovar(dono, _enviado(dono, oid, [_servico("Diagnóstico", 1, 90)]))
    assert [(l["categoria"], l["valor"]) for l in _lancamentos(db, oid)] == [("servicos", 90)]

    oid2 = _os(dono)
    corpo = _aprovar(dono, _enviado(dono, oid2, [_servico("Cortesia", 1, 0)]))
    assert _lancamentos(db, oid2) == [] and "efeitos" not in corpo


def test_lancamentos_somam_o_total_do_orcamento(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("A", 1.5, 33.33), _peca("B", 3, 0.335), _servico("C", 2.5, 19.99)])
    _aprovar(dono, orc)
    assert sum(l["valor"] for l in _lancamentos(db, oid)) == pytest.approx(orc["total"])


def test_estoque_insuficiente_nao_bloqueia_e_avisa(dono, db):
    oid = _os(dono)
    item = _item_estoque(db, "Filtro", quantidade=3)
    outra = _os(dono)
    _aprovar(dono, _enviado(dono, outra, [_peca("Filtro", 2, 40, estoqueItemId=item)]))      # 2 de 3 já reservados
    corpo = _aprovar(dono, _enviado(dono, oid, [_peca("Filtro", 2, 40, estoqueItemId=item)]))
    assert _status_os(db, oid) == "aprovada"
    assert corpo["efeitos"]["faltas"] == [{"itemId": item, "nome": "Filtro", "reservado": 2, "disponivel": 1}]
    assert _reservas(db, oid) == {item: 2.0} and _reservas(db, outra) == {item: 2.0}


def test_item_sem_vinculo_ou_de_outra_oficina_nao_reserva(dono, db):
    oid = _os(dono)
    alheio = _item_estoque(db, "Alheio", oficina=OFICINA_B)
    _aprovar(dono, _enviado(dono, oid, [_peca("Sem vínculo", 1, 10), _peca("Alheio", 1, 10, estoqueItemId=alheio)]))
    assert _reservas(db, oid) == {}


def test_aprovar_de_novo_nao_duplica(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("X", 1, 10), _servico("Y", 1, 5)])
    _aprovar(dono, orc)
    assert dono.post(f"/orcamentos/{orc['id']}/aprovar", format="json").status_code == 409
    assert len(_lancamentos(db, oid)) == 2


def test_vencido_nao_gera_efeitos(dono, db, hoje):
    from datetime import timedelta
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("X", 1, 10)])
    hoje["agora"] = hoje["agora"] + timedelta(days=30)
    assert dono.post(f"/orcamentos/{orc['id']}/aprovar", format="json").status_code == 409
    assert _lancamentos(db, oid, True) == []


# ── revisão de orçamento aprovado ────────────────────────────────────────────

def test_revisao_enviada_atualiza_lancamentos_e_reserva(dono, db):
    oid = _os(dono)
    a, b = _item_estoque(db, "A"), _item_estoque(db, "B")
    _aprovar(dono, _enviado(dono, oid, [_peca("A", 2, 100, estoqueItemId=a), _servico("Mão de obra", 1, 80)]))
    v2 = _revisar(dono, oid, [_peca("B", 1, 150, estoqueItemId=b), _servico("Mão de obra", 1, 120)])

    assert v2["osStatus"] == "pendente_aprovacao" and _status_os(db, oid) == "pendente_aprovacao"
    assert [(l["categoria"], l["valor"], l["status"]) for l in _lancamentos(db, oid)] == [("pecas", 150, "pendente"), ("servicos", 120, "pendente")]
    assert "v2" in _lancamentos(db, oid)[0]["descricao"]
    assert _reservas(db, oid) == {b: 1.0}
    assert {f["acao"] for f in v2["efeitos"]["financeiro"]} == {"atualizado"}

    _aprovar(dono, v2)                                    # reaprovar não duplica
    assert len(_lancamentos(db, oid)) == 2 and _reservas(db, oid) == {b: 1.0}


def test_revisao_sem_servico_cancela_so_aquele_lancamento(dono, db):
    oid = _os(dono)
    _aprovar(dono, _enviado(dono, oid, [_peca("P", 1, 100), _servico("S", 1, 50)]))
    v2 = _revisar(dono, oid, [_peca("P", 1, 100)])
    assert [(l["categoria"], l["status"]) for l in _lancamentos(db, oid)] == [("pecas", "pendente")]
    assert {(f["categoria"], f["acao"]) for f in v2["efeitos"]["financeiro"]} == {("pecas", "atualizado"), ("servicos", "cancelado")}


def test_enviar_primeiro_orcamento_de_os_sem_aprovacao_nao_cria_nada(dono, db):
    oid = _os(dono)
    corpo = _enviado(dono, oid, [_peca("P", 1, 100)])
    assert "efeitos" not in corpo and _lancamentos(db, oid, True) == []


# ── recusar / cancelar ───────────────────────────────────────────────────────

def test_cancelar_aprovado_cancela_lancamentos_e_libera_reserva(dono, db):
    oid = _os(dono)
    item = _item_estoque(db)
    orc = _enviado(dono, oid, [_peca("P", 2, 100, estoqueItemId=item), _servico("S", 1, 50)])
    _aprovar(dono, orc)
    r = dono.post(f"/orcamentos/{orc['id']}/recusar", {"motivo": "desistiu"}, format="json")
    assert r.status_code == 200, r.content
    assert [l["status"] for l in _lancamentos(db, oid, True)] == ["cancelado", "cancelado"]
    assert _reservas(db, oid) == {}
    ef = r.json()["efeitos"]
    assert {f["acao"] for f in ef["financeiro"]} == {"cancelado"} and ef["liberadas"] == 1


def test_recusar_a_revisao_tambem_cancela(dono, db):
    oid = _os(dono)
    item = _item_estoque(db)
    _aprovar(dono, _enviado(dono, oid, [_peca("P", 1, 100, estoqueItemId=item)]))
    v2 = _revisar(dono, oid, [_peca("P", 1, 130, estoqueItemId=item)])
    assert dono.post(f"/orcamentos/{v2['id']}/recusar", format="json").status_code == 200
    assert _lancamentos(db, oid) == [] and _reservas(db, oid) == {}
    assert _status_os(db, oid) == "recusada"


def test_recusar_orcamento_enviado_sem_aprovacao_nao_tem_efeitos(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("P", 1, 100)])
    r = dono.post(f"/orcamentos/{orc['id']}/recusar", format="json")
    assert r.status_code == 200 and "efeitos" not in r.json()


def test_refazer_depois_de_recusar_e_aprovar_cria_lancamento_novo(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("P", 1, 100)])
    _aprovar(dono, orc)
    dono.post(f"/orcamentos/{orc['id']}/recusar", format="json")
    r = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    v2 = dono.post(f"/orcamentos/{r.json()['id']}/enviar", format="json")
    assert v2.status_code == 200
    _aprovar(dono, v2.json())
    vivos = _lancamentos(db, oid)
    assert [(l["categoria"], l["valor"]) for l in vivos] == [("pecas", 100)]
    assert len(_lancamentos(db, oid, True)) == 2          # o cancelado fica no histórico


# ── lançamento já pago nunca é mexido ────────────────────────────────────────

def test_lancamento_pago_e_preservado(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("P", 1, 100)])
    _aprovar(dono, orc)
    db.cursor().execute("update financeiro_transacoes set status='pago' where ordem_servico_id=%s", (oid,))

    v2 = _revisar(dono, oid, [_peca("P", 1, 999)])
    assert v2["efeitos"]["avisos"] == [{"codigo": "lancamento_pago", "categoria": "pecas"}]
    assert [(l["valor"], l["status"]) for l in _lancamentos(db, oid)] == [(100, "pago")]

    r = dono.post(f"/orcamentos/{v2['id']}/recusar", format="json")
    assert r.json()["efeitos"]["avisos"] == [{"codigo": "lancamento_pago", "categoria": "pecas"}]
    assert [l["status"] for l in _lancamentos(db, oid)] == ["pago"]


# ── estoque, OS apagada, permissões ──────────────────────────────────────────

def test_listagem_do_estoque_traz_reservado(dono, db):
    oid = _os(dono)
    item = _item_estoque(db, quantidade=10)
    outro = _item_estoque(db, "Sem reserva")
    _aprovar(dono, _enviado(dono, oid, [_peca("P", 2.5, 10, estoqueItemId=item)]))
    itens = {i["id"]: i for i in dono.get("/estoque").json()}
    assert itens[item]["reservado"] == 2.5 and itens[item]["quantidade"] == 10
    assert "reservado" not in itens[outro]


def test_apagar_a_os_cancela_lancamentos_pendentes_e_leva_a_reserva(dono, db):
    oid = _os(dono)
    item = _item_estoque(db)
    _aprovar(dono, _enviado(dono, oid, [_peca("P", 1, 100, estoqueItemId=item), _servico("S", 1, 40)]))
    assert dono.delete(f"/ordens/{oid}").status_code == 200
    assert [l["status"] for l in _lancamentos(db, oid, True)] == ["cancelado", "cancelado"]
    assert _reservas(db, oid) == {}


def test_atendente_nao_dispara_efeitos(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("P", 1, 100)])
    assert _cliente("atendente").post(f"/orcamentos/{orc['id']}/aprovar", format="json").status_code == 403
    assert _lancamentos(db, oid, True) == []
