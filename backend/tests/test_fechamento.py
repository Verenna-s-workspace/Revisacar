"""Fase 5: execução, conclusão (baixa de estoque) e resumo de fechamento."""
import django
import pytest

django.setup()

from orders import estoque_views, fechamento_views  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .test_orcamento import (  # noqa: E402,F401
    _cliente, _enviado, _forca_os, _os, _peca, _servico, _status_os, dono, fake, gerente, hoje,
)
from .test_orcamento_efeitos import _aprovar, _item_estoque, _lancamentos, _reservas  # noqa: E402


@pytest.fixture(autouse=True)
def _modulos_no_fake(fake, monkeypatch):
    monkeypatch.setattr(estoque_views, "supabase", fake)
    monkeypatch.setattr(fechamento_views, "supabase", fake)


def _quantidade(db, item):
    cur = db.cursor()
    cur.execute("select quantidade from estoque_itens where id=%s", (item,))
    return float(cur.fetchone()[0])


def _movimentos(db, oid):
    cur = db.cursor()
    cur.execute("select item_id::text, tipo, quantidade, motivo from estoque_movimentos where ordem_servico_id=%s order by criado_em", (oid,))
    return [(r[0], r[1], float(r[2]), r[3]) for r in cur.fetchall()]


def _executando(api, db, itens):
    oid = _os(api)
    _aprovar(api, _enviado(api, oid, itens))
    assert api.patch(f"/ordens/{oid}/status", {"status": "em_execucao"}, format="json").status_code == 200
    return oid


def _concluir(api, oid, corpo=None):
    return api.post(f"/ordens/{oid}/concluir", corpo or {}, format="json")


# ── concluir ─────────────────────────────────────────────────────────────────

def test_concluir_baixa_estoque_registra_movimento_e_libera_reserva(dono, db):
    item = _item_estoque(db, quantidade=10)
    oid = _executando(dono, db, [_peca("Pastilha", 2, 100, estoqueItemId=item), _servico("Alinhamento", 1, 80)])
    r = _concluir(dono, oid, {"observacao": "  Cliente retirou às 17h  "})
    assert r.status_code == 200, r.content
    corpo = r.json()

    assert corpo["osStatus"] == "finalizada" and _status_os(db, oid) == "finalizada"
    assert _quantidade(db, item) == 8
    assert _reservas(db, oid) == {}
    mov = _movimentos(db, oid)
    assert len(mov) == 1 and mov[0][:3] == (item, "saida", 2.0) and "v1" in mov[0][3]
    assert corpo["baixasFeitas"] == [{"itemId": item, "nome": "Pastilha", "reservado": 2, "baixado": 2, "faltou": 0}]
    assert corpo["obsConclusao"] == "Cliente retirou às 17h" and corpo["concluidaEm"] and corpo["concluidaPorNome"] == "dono"
    assert [b["quantidade"] for b in corpo["baixas"]] == [2] and corpo["reservas"] == []


def test_concluir_nao_mexe_nos_lancamentos_do_financeiro(dono, db):
    oid = _executando(dono, db, [_peca("P", 1, 100), _servico("S", 1, 50)])
    assert _concluir(dono, oid).status_code == 200
    assert [(l["categoria"], l["status"]) for l in _lancamentos(db, oid)] == [("pecas", "pendente"), ("servicos", "pendente")]


def test_falta_de_estoque_bloqueia_e_nada_muda(dono, db):
    item = _item_estoque(db, "Filtro", quantidade=1)
    oid = _executando(dono, db, [_peca("Filtro", 2, 40, estoqueItemId=item)])
    r = _concluir(dono, oid)
    assert r.status_code == 409
    assert r.json()["codigo"] == "estoque_insuficiente"
    assert r.json()["faltas"] == [{"itemId": item, "nome": "Filtro", "necessario": 2, "disponivel": 1}]
    assert _status_os(db, oid) == "em_execucao" and _quantidade(db, item) == 1
    assert _reservas(db, oid) == {item: 2.0} and _movimentos(db, oid) == []


def test_ignorar_faltas_baixa_so_o_que_existe(dono, db):
    item = _item_estoque(db, "Filtro", quantidade=1)
    oid = _executando(dono, db, [_peca("Filtro", 2, 40, estoqueItemId=item)])
    r = _concluir(dono, oid, {"ignorarFaltas": True})
    assert r.status_code == 200, r.content
    assert r.json()["baixasFeitas"] == [{"itemId": item, "nome": "Filtro", "reservado": 2, "baixado": 1, "faltou": 1}]
    assert _quantidade(db, item) == 0 and _status_os(db, oid) == "finalizada"
    assert _movimentos(db, oid)[0][2] == 1.0 and _reservas(db, oid) == {}


def test_item_zerado_e_ignorar_faltas_nao_gera_movimento(dono, db):
    item = _item_estoque(db, "Raro", quantidade=0)
    oid = _executando(dono, db, [_peca("Raro", 1, 40, estoqueItemId=item)])
    assert _concluir(dono, oid, {"ignorarFaltas": True}).status_code == 200
    assert _movimentos(db, oid) == [] and _quantidade(db, item) == 0


def test_concluir_duas_vezes_baixa_uma_vez(dono, db):
    item = _item_estoque(db, quantidade=10)
    oid = _executando(dono, db, [_peca("P", 3, 10, estoqueItemId=item)])
    assert _concluir(dono, oid).status_code == 200
    r = _concluir(dono, oid)
    assert r.status_code == 409 and r.json()["codigo"] == "os_status"
    assert _quantidade(db, item) == 7 and len(_movimentos(db, oid)) == 1


@pytest.mark.parametrize("status", ["rascunho", "em_orcamento", "pendente_aprovacao", "aprovada", "recusada"])
def test_so_conclui_de_execucao_ou_aguardando(dono, db, status):
    oid = _os(dono)
    _forca_os(db, oid, status)
    r = _concluir(dono, oid)
    assert r.status_code == 409 and r.json()["osStatus"] == status
    assert _status_os(db, oid) == status


def test_concluir_a_partir_de_aguardando(dono, db):
    oid = _executando(dono, db, [_servico("S", 1, 50)])
    assert dono.patch(f"/ordens/{oid}/status", {"status": "aguardando"}, format="json").status_code == 200
    assert _concluir(dono, oid).status_code == 200


def test_os_sem_orcamento_conclui_sem_baixa(dono, db):
    oid = _os(dono)
    _forca_os(db, oid, "em_execucao")
    r = _concluir(dono, oid)
    assert r.status_code == 200 and r.json()["baixasFeitas"] == [] and r.json()["orcamento"] is None


def test_patch_status_finalizada_tambem_baixa(dono, db):
    item = _item_estoque(db, quantidade=5)
    oid = _executando(dono, db, [_peca("P", 2, 10, estoqueItemId=item)])
    r = dono.patch(f"/ordens/{oid}/status", {"status": "finalizada"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "finalizada"
    assert _quantidade(db, item) == 3 and len(_movimentos(db, oid)) == 1


def test_patch_status_finalizada_com_falta_da_409(dono, db):
    item = _item_estoque(db, quantidade=1)
    oid = _executando(dono, db, [_peca("P", 2, 10, estoqueItemId=item)])
    r = dono.patch(f"/ordens/{oid}/status", {"status": "finalizada"}, format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "estoque_insuficiente"
    assert _status_os(db, oid) == "em_execucao"


def test_permissoes_e_isolamento(dono, db):
    oid = _executando(dono, db, [_servico("S", 1, 50)])
    assert _concluir(_cliente("atendente"), oid).status_code == 403
    assert _concluir(_cliente("dono", OFICINA_B), oid).status_code == 404
    assert _concluir(dono, "nao-existe").status_code == 404
    assert _status_os(db, oid) == "em_execucao"
    assert _concluir(_cliente("mecanico"), oid).status_code == 200


@pytest.mark.parametrize("corpo", [{"observacao": "x" * 1001}, {"ignorarFaltas": "talvez"}])
def test_corpo_invalido_422(dono, db, corpo):
    oid = _executando(dono, db, [_servico("S", 1, 50)])
    assert _concluir(dono, oid, corpo).status_code == 422


def test_apos_concluir_o_orcamento_nao_aceita_nova_versao(dono, db):
    oid = _executando(dono, db, [_servico("S", 1, 50)])
    _concluir(dono, oid)
    assert dono.post(f"/ordens/{oid}/orcamentos", format="json").status_code == 409


# ── resumo de fechamento ─────────────────────────────────────────────────────

def test_fechamento_antes_de_concluir(dono, db):
    ok = _item_estoque(db, "Óleo", quantidade=10)
    curto = _item_estoque(db, "Filtro", quantidade=1)
    oid = _executando(dono, db, [_peca("Óleo", 4, 30, custoUnitario=20, estoqueItemId=ok),
                                 _peca("Filtro", 2, 40, estoqueItemId=curto), _servico("Troca", 1, 90)])
    r = dono.get(f"/ordens/{oid}/fechamento")
    assert r.status_code == 200, r.content
    c = r.json()
    assert c["osStatus"] == "em_execucao" and "concluidaEm" not in c and c["baixas"] == []
    assert c["orcamento"]["status"] == "aprovado" and c["orcamento"]["total"] == 290 and "custoTotal" in c["orcamento"]
    assert c["reservas"] == [
        {"itemId": curto, "nome": "Filtro", "reservado": 2, "disponivel": 1, "falta": True},
        {"itemId": ok, "nome": "Óleo", "reservado": 4, "disponivel": 10, "falta": False},
    ]
    assert {(l["categoria"], l["status"], l["valor"]) for l in c["financeiro"]} == {("pecas", "pendente", 200), ("servicos", "pendente", 90)}


def test_fechamento_depois_de_concluir(dono, db):
    item = _item_estoque(db, quantidade=10)
    oid = _executando(dono, db, [_peca("P", 3, 10, estoqueItemId=item)])
    _concluir(dono, oid, {"observacao": "ok"})
    c = dono.get(f"/ordens/{oid}/fechamento").json()
    assert c["osStatus"] == "finalizada" and c["obsConclusao"] == "ok" and c["reservas"] == []
    assert [(b["itemId"], b["quantidade"]) for b in c["baixas"]] == [(item, 3)]


def test_fechamento_esconde_custo_e_financeiro_de_quem_nao_pode(dono, db):
    oid = _executando(dono, db, [_peca("P", 1, 100, custoUnitario=60)])
    c = _cliente("mecanico").get(f"/ordens/{oid}/fechamento").json()
    assert "financeiro" not in c and "custoTotal" not in c["orcamento"]
    assert "custoUnitario" not in c["orcamento"]["itens"][0]
    g = _cliente("gerente").get(f"/ordens/{oid}/fechamento").json()
    assert "financeiro" in g and "custoTotal" not in g["orcamento"]


def test_fechamento_404_e_permissao(dono, db):
    oid = _executando(dono, db, [_servico("S", 1, 50)])
    assert _cliente("dono", OFICINA_B).get(f"/ordens/{oid}/fechamento").status_code == 404
    assert dono.get("/ordens/nao-existe/fechamento").status_code == 404


# ── Relatórios e Visão Geral com valores reais ───────────────────────────────

def _finalizada_em(db, oid, dia="2026-10-12T10:00:00-03:00"):
    db.cursor().execute("update ordens set created_at=%s, status='finalizada' where id=%s", (dia, oid))


def _cenario_relatorios(dono, db):
    # OS 1: orçamento aprovado com serviços de verdade.
    o1 = _executando(dono, db, [_servico("Alinhamento", 2, 80), _servico("Troca de óleo", 1, 120), _peca("Filtro", 1, 50)])
    _concluir(dono, o1)
    _finalizada_em(db, o1)
    # OS 2: antiga, sem orçamento — vale o checklist (a OS de teste marca "Motor").
    o2 = _os(dono)
    _finalizada_em(db, o2)
    # OS 3: outra com "alinhamento" em caixa diferente: soma com a primeira.
    o3 = _executando(dono, db, [_servico("alinhamento ", 1, 90)])
    _concluir(dono, o3)
    _finalizada_em(db, o3)


def test_relatorios_usam_servicos_do_orcamento_aprovado(dono, db):
    _cenario_relatorios(dono, db)
    r = dono.get("/relatorios", {"de": "2026-10-01", "ate": "2026-10-31"})
    assert r.status_code == 200, r.content
    servicos = {s["nome"]: s["quantidade"] for s in r.json()["servicos"]}
    assert servicos == {"Alinhamento": 3, "Troca de óleo": 1, "Motor": 1}      # peça não é serviço; OS antiga cai no checklist


def test_visao_geral_traz_valor_real_dos_servicos(dono, db):
    _cenario_relatorios(dono, db)
    r = dono.get("/visao-geral")
    assert r.status_code == 200, r.content
    s = {x["nome"]: x for x in r.json()["servicos"]}
    assert s["Alinhamento"]["quantidade"] == 3 and s["Alinhamento"]["valorEstimado"] == 250 and s["Alinhamento"]["valorReal"] is True
    assert s["Troca de óleo"]["valorEstimado"] == 120 and s["Troca de óleo"]["valorReal"] is True
    assert s["Motor"]["valorReal"] is False
    assert sum(s["Alinhamento"]["semana"]) == 3


def test_servico_de_orcamento_nao_aprovado_nao_conta(dono, db):
    oid = _os(dono)
    _enviado(dono, oid, [_servico("Cortesia fantasma", 1, 10)])      # enviado, nunca aprovado
    _finalizada_em(db, oid)
    r = dono.get("/relatorios", {"de": "2026-10-01", "ate": "2026-10-31"})
    assert "Cortesia fantasma" not in {s["nome"] for s in r.json()["servicos"]}
    assert {s["nome"] for s in r.json()["servicos"]} == {"Motor"}
