"""Alertas: cliente avisado no banco e GET /alertas (orçamento, aprovada parada, reserva sem estoque, sem pagamento)."""
from datetime import timedelta

import django
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import alertas_views, estoque_views, fechamento_views  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .test_orcamento import (  # noqa: E402,F401
    HOJE, _cliente, _enviado, _forca_os, _os, _peca, _servico, dono, fake, gerente, hoje,
)
from .test_orcamento_efeitos import _aprovar, _item_estoque  # noqa: E402


@pytest.fixture(autouse=True)
def _modulos_no_fake(fake, monkeypatch):
    for modulo in (alertas_views, estoque_views, fechamento_views):
        monkeypatch.setattr(modulo, "supabase", fake)


@pytest.fixture()
def mecanico(fake):
    return _cliente("mecanico")


@pytest.fixture()
def atendente(fake):
    return _cliente("atendente")


def _recuar(db, sql, params, dias):
    """Executa `sql` (com %s pro timestamp e depois `params`) com HOJE − `dias`."""
    db.cursor().execute(sql, (HOJE - timedelta(days=dias), *params))


def _enviado_ha(db, orc_id, dias):
    _recuar(db, "update orcamentos set enviado_em=%s where id=%s", (orc_id,), dias)


def _aprovado_ha(db, orc_id, dias):
    _recuar(db, "update orcamentos set aprovado_em=%s where id=%s", (orc_id,), dias)


def _concluida_ha(db, oid, dias):
    _recuar(db, "update ordens set concluida_em=%s where id=%s", (oid,), dias)


def _get(api, **q):
    r = api.get("/alertas", q)
    assert r.status_code == 200, r.content
    return r.json()


def _executando_e_concluida(api, db, itens):
    oid = _os(api)
    _aprovar(api, _enviado(api, oid, itens))
    assert api.patch(f"/ordens/{oid}/status", {"status": "em_execucao"}, format="json").status_code == 200
    assert api.post(f"/ordens/{oid}/concluir", {}, format="json").status_code == 200
    return oid


# ── cliente avisado ──────────────────────────────────────────────────────────

def test_marcar_cliente_avisado_grava_quando_e_quem(dono, db):
    oid = _os(dono)
    r = dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["cliente_avisado"] is True and r.json()["cliente_avisado_por_nome"] == "dono"
    cur = db.cursor()
    cur.execute("select cliente_avisado, cliente_avisado_em is not null, cliente_avisado_por_nome from ordens where id=%s", (oid,))
    assert cur.fetchone() == (True, True, "dono")


def test_desmarcar_limpa_quando_e_quem(dono, db):
    oid = _os(dono)
    dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    r = dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": False}, format="json")
    assert r.status_code == 200 and r.json()["cliente_avisado"] is False
    cur = db.cursor()
    cur.execute("select cliente_avisado, cliente_avisado_em, cliente_avisado_por_nome from ordens where id=%s", (oid,))
    assert cur.fetchone() == (False, None, None)


def test_repetir_marcacao_nao_muda_quem_avisou(dono, gerente, db):
    oid = _os(dono)
    dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    r = gerente.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    assert r.status_code == 200
    cur = db.cursor()
    cur.execute("select cliente_avisado_por_nome from ordens where id=%s", (oid,))
    assert cur.fetchone()[0] == "dono"


def test_marcar_nao_mexe_em_updated_at_nem_status(dono, db):
    oid = _os(dono)
    cur = db.cursor()
    cur.execute("select updated_at, status from ordens where id=%s", (oid,))
    antes = cur.fetchone()
    dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    cur.execute("select updated_at, status from ordens where id=%s", (oid,))
    assert cur.fetchone() == antes


@pytest.mark.parametrize("cargo,esperado", [("dono", 200), ("gerente", 200), ("mecanico", 200), ("atendente", 200)])
def test_quem_pode_marcar_cliente_avisado(dono, db, cargo, esperado):
    oid = _os(dono)
    r = _cliente(cargo).patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    assert r.status_code == esperado, r.content


def test_sem_permissao_de_ordens_nao_marca(dono, db):
    oid = _os(dono)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION="Bearer " + make_jwt(
        {"tipo": "x", "nome": "x", "oficina_doc": OFICINA_A, "permissoes": ["ordens.ver", "estoque.ver"]}, 900))
    assert c.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json").status_code == 403


def test_sem_token_401_e_corpo_invalido_422(dono, db):
    oid = _os(dono)
    assert APIClient().patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json").status_code == 401
    assert dono.patch(f"/ordens/{oid}/cliente-avisado", {}, format="json").status_code == 422
    assert dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": "talvez"}, format="json").status_code == 422


def test_ordem_de_outra_oficina_e_404(dono, db):
    oid = _os(dono)
    outra = _cliente("dono", oficina=OFICINA_B)
    assert outra.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json").status_code == 404


def test_listagem_de_ordens_traz_cliente_avisado(dono, db):
    oid = _os(dono)
    dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    linha = next(o for o in dono.get("/ordens").json() if o["id"] == oid)
    assert linha["cliente_avisado"] is True


def test_sem_o_script_responde_503_com_instrucao(dono, db):
    oid = _os(dono)
    cur = db.cursor()
    cur.execute("alter table ordens drop column cliente_avisado_por_nome")
    try:
        r = dono.patch(f"/ordens/{oid}/cliente-avisado", {"avisado": True}, format="json")
    finally:
        cur.execute("alter table ordens add column if not exists cliente_avisado_por_nome text")
    assert r.status_code == 503 and "alertas.sql" in r.json()["detail"]


# ── GET /alertas: acesso e formato ───────────────────────────────────────────

def test_alertas_exige_login(fake):
    assert APIClient().get("/alertas").status_code == 401


def test_oficina_sem_nada_devolve_blocos_vazios(dono, db):
    corpo = _get(dono)
    assert corpo["hoje"] == "2026-10-12"
    assert corpo["orcamentosSemResposta"] == [] and corpo["aprovadasParadas"] == []
    assert corpo["reservasSemEstoque"] == [] and corpo["semPagamento"] == [] and corpo["indisponiveis"] == []
    assert set(corpo["limites"]) == {"orcamentoSemRespostaDias", "aprovadaParadaDias", "semPagamentoDias"}


def test_fuso_invalido_422(dono, db):
    assert dono.get("/alertas", {"tz": "Marte/Olimpo"}).status_code == 422


@pytest.mark.parametrize("cargo,blocos", [
    ("dono", {"orcamentosSemResposta", "aprovadasParadas", "reservasSemEstoque", "semPagamento"}),
    ("gerente", {"orcamentosSemResposta", "aprovadasParadas", "reservasSemEstoque", "semPagamento"}),
    ("mecanico", {"orcamentosSemResposta", "aprovadasParadas", "reservasSemEstoque"}),
    ("atendente", {"orcamentosSemResposta", "aprovadasParadas", "reservasSemEstoque"}),
])
def test_cada_cargo_so_recebe_os_blocos_que_pode_ver(db, fake, cargo, blocos):
    corpo = _get(_cliente(cargo))
    assert {k for k in corpo if k not in ("hoje", "limites", "indisponiveis")} == blocos


def test_bloco_sem_permissao_nao_vaza_dado_financeiro(dono, mecanico, db):
    oid = _executando_e_concluida(dono, db, [_peca("P", 1, 100)])
    _concluida_ha(db, oid, 3)
    assert len(_get(dono)["semPagamento"]) == 1
    assert "semPagamento" not in _get(mecanico)


# ── orçamento sem resposta ───────────────────────────────────────────────────

def test_orcamento_enviado_hoje_nao_alerta(dono, db):
    _enviado(dono, _os(dono))
    assert _get(dono)["orcamentosSemResposta"] == []


def test_orcamento_sem_resposta_ha_2_dias_alerta(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("P", 2, 100), _servico("S", 1, 50)])
    _enviado_ha(db, orc["id"], 1)
    assert _get(dono)["orcamentosSemResposta"] == []
    _enviado_ha(db, orc["id"], 2)
    [a] = _get(dono)["orcamentosSemResposta"]
    assert a["ordemId"] == oid and a["osNum"] == "OS-1" and a["cliente"] == "Maria" and a["placa"] == "ABC1D23"
    assert a["orcamentoId"] == orc["id"] and a["versao"] == 1 and a["total"] == 250
    assert a["dias"] == 2 and a["vencido"] is False


def test_orcamento_vencido_alerta_mesmo_enviado_hoje(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    db.cursor().execute("update orcamentos set validade_ate=%s where id=%s", ("2026-10-11", orc["id"]))
    [a] = _get(dono)["orcamentosSemResposta"]
    assert a["vencido"] is True and a["validadeAte"] == "2026-10-11"


def test_vencido_vem_antes_e_depois_o_mais_antigo(dono, db):
    ids = {}
    for nome in ("A", "B", "C"):
        oid = _os(dono)
        ids[nome] = (oid, _enviado(dono, oid)["id"])
    _enviado_ha(db, ids["A"][1], 3)
    _enviado_ha(db, ids["B"][1], 5)
    _enviado_ha(db, ids["C"][1], 2)
    db.cursor().execute("update orcamentos set validade_ate=%s where id=%s", ("2026-10-01", ids["C"][1]))
    ordem = [a["ordemId"] for a in _get(dono)["orcamentosSemResposta"]]
    assert ordem == [ids["C"][0], ids["B"][0], ids["A"][0]]


def test_orcamento_aprovado_recusado_ou_rascunho_nao_alerta(dono, db):
    aprovado = _enviado(dono, _os(dono))
    _aprovar(dono, aprovado)
    _enviado_ha(db, aprovado["id"], 10)
    recusado = _enviado(dono, _os(dono))
    assert dono.post(f"/orcamentos/{recusado['id']}/recusar", {}, format="json").status_code == 200
    _enviado_ha(db, recusado["id"], 10)
    dono.post(f"/ordens/{_os(dono)}/orcamentos", format="json")          # rascunho
    assert _get(dono)["orcamentosSemResposta"] == []


def test_orcamento_de_outra_oficina_nao_aparece(dono, db):
    outra = _cliente("dono", oficina=OFICINA_B)
    # a oficina B precisa existir como admin (FK) — o conftest cria as duas
    orc = _enviado(outra, _os(outra))
    _enviado_ha(db, orc["id"], 5)
    assert _get(dono)["orcamentosSemResposta"] == []
    assert len(_get(outra)["orcamentosSemResposta"]) == 1


# ── OS aprovada parada ───────────────────────────────────────────────────────

def test_aprovada_parada_a_partir_de_1_dia(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("P", 1, 100)])
    _aprovar(dono, orc)
    assert _get(dono)["aprovadasParadas"] == []
    _aprovado_ha(db, orc["id"], 1)
    [a] = _get(dono)["aprovadasParadas"]
    assert a["ordemId"] == oid and a["dias"] == 1 and a["total"] == 100 and a["osNum"] == "OS-1"


def test_aprovada_que_ja_comecou_nao_alerta(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    _aprovar(dono, orc)
    _aprovado_ha(db, orc["id"], 4)
    assert dono.patch(f"/ordens/{oid}/status", {"status": "em_execucao"}, format="json").status_code == 200
    assert _get(dono)["aprovadasParadas"] == []


def test_aprovadas_paradas_mais_antiga_primeiro(dono, db):
    a, b = _os(dono), _os(dono)
    oa, ob = _enviado(dono, a), _enviado(dono, b)
    _aprovar(dono, oa), _aprovar(dono, ob)
    _aprovado_ha(db, oa["id"], 2)
    _aprovado_ha(db, ob["id"], 6)
    assert [x["ordemId"] for x in _get(dono)["aprovadasParadas"]] == [b, a]


# ── reserva sem estoque ──────────────────────────────────────────────────────

def test_reserva_dentro_do_estoque_nao_alerta(dono, db):
    item = _item_estoque(db, "Pastilha", quantidade=5)
    _aprovar(dono, _enviado(dono, _os(dono), [_peca("Pastilha", 5, 100, estoqueItemId=item)]))
    assert _get(dono)["reservasSemEstoque"] == []


def test_reserva_maior_que_o_estoque_alerta_com_a_falta(dono, db):
    item = _item_estoque(db, "Pastilha", quantidade=3)
    oid = _os(dono)
    _aprovar(dono, _enviado(dono, oid, [_peca("Pastilha", 5, 100, estoqueItemId=item)]))
    [a] = _get(dono)["reservasSemEstoque"]
    assert a["itemId"] == item and a["nome"] == "Pastilha"
    assert (a["reservado"], a["emEstoque"], a["falta"]) == (5, 3, 2)
    assert a["ordens"] == [{"ordemId": oid, "osNum": "OS-1", "quantidade": 5}]


def test_duas_os_que_juntas_passam_do_estoque_alertam_um_item_so(dono, db):
    item = _item_estoque(db, "Filtro", quantidade=3)
    o1, o2 = _os(dono), _os(dono)
    _aprovar(dono, _enviado(dono, o1, [_peca("Filtro", 2, 40, estoqueItemId=item)]))
    assert _get(dono)["reservasSemEstoque"] == []                       # 2 de 3: ok
    _aprovar(dono, _enviado(dono, o2, [_peca("Filtro", 2, 40, estoqueItemId=item)]))
    [a] = _get(dono)["reservasSemEstoque"]
    assert (a["reservado"], a["emEstoque"], a["falta"]) == (4, 3, 1)
    assert {o["ordemId"] for o in a["ordens"]} == {o1, o2}


def test_reserva_some_do_alerta_quando_o_estoque_chega(dono, db):
    item = _item_estoque(db, "Pastilha", quantidade=1)
    _aprovar(dono, _enviado(dono, _os(dono), [_peca("Pastilha", 4, 100, estoqueItemId=item)]))
    assert len(_get(dono)["reservasSemEstoque"]) == 1
    db.cursor().execute("update estoque_itens set quantidade=10 where id=%s", (item,))
    assert _get(dono)["reservasSemEstoque"] == []


def test_reserva_de_outra_oficina_nao_aparece(dono, db):
    outra = _cliente("dono", oficina=OFICINA_B)
    item = _item_estoque(db, "X", quantidade=0, oficina=OFICINA_B)
    _aprovar(outra, _enviado(outra, _os(outra), [_peca("X", 2, 10, estoqueItemId=item)]))
    assert _get(dono)["reservasSemEstoque"] == []
    assert len(_get(outra)["reservasSemEstoque"]) == 1


# ── OS concluída sem pagamento ───────────────────────────────────────────────

def test_concluida_hoje_nao_alerta_ainda(dono, db):
    _executando_e_concluida(dono, db, [_peca("P", 1, 100)])
    assert _get(dono)["semPagamento"] == []


def test_concluida_ha_dias_com_lancamento_pendente_alerta(dono, db):
    oid = _executando_e_concluida(dono, db, [_peca("P", 1, 100), _servico("S", 1, 50)])
    _concluida_ha(db, oid, 3)
    [a] = _get(dono)["semPagamento"]
    assert a["ordemId"] == oid and a["valorPendente"] == 150 and a["dias"] == 3 and a["vencido"] is False


def test_lancamento_pago_tira_o_alerta_e_pago_parcial_soma_so_o_pendente(dono, db):
    oid = _executando_e_concluida(dono, db, [_peca("P", 1, 100), _servico("S", 1, 50)])
    _concluida_ha(db, oid, 3)
    db.cursor().execute("update financeiro_transacoes set status='pago' where ordem_servico_id=%s and categoria='pecas'", (oid,))
    [a] = _get(dono)["semPagamento"]
    assert a["valorPendente"] == 50
    db.cursor().execute("update financeiro_transacoes set status='pago' where ordem_servico_id=%s", (oid,))
    assert _get(dono)["semPagamento"] == []


def test_lancamento_cancelado_ou_de_saida_nao_conta(dono, db):
    oid = _executando_e_concluida(dono, db, [_peca("P", 1, 100)])
    _concluida_ha(db, oid, 3)
    db.cursor().execute("update financeiro_transacoes set status='cancelado' where ordem_servico_id=%s", (oid,))
    assert _get(dono)["semPagamento"] == []


def test_vencimento_passado_marca_vencido(dono, db):
    oid = _executando_e_concluida(dono, db, [_peca("P", 1, 100)])
    _concluida_ha(db, oid, 3)
    db.cursor().execute("update financeiro_transacoes set data_vencimento=%s where ordem_servico_id=%s", ("2026-10-10", oid))
    assert _get(dono)["semPagamento"][0]["vencido"] is True


def test_os_nao_concluida_com_lancamento_pendente_nao_alerta(dono, db):
    oid = _os(dono)
    _aprovar(dono, _enviado(dono, oid, [_peca("P", 1, 100)]))           # aprovada: lançamento pendente, serviço não concluído
    assert _get(dono)["semPagamento"] == []


def test_sem_concluida_em_usa_updated_at(dono, db):
    oid = _executando_e_concluida(dono, db, [_peca("P", 1, 100)])
    cur = db.cursor()
    cur.execute("update ordens set concluida_em=null, updated_at=%s where id=%s", (HOJE - timedelta(days=4), oid))
    assert _get(dono)["semPagamento"][0]["dias"] == 4


# ── script ausente ───────────────────────────────────────────────────────────

def test_tabela_ausente_vira_bloco_vazio_e_indisponivel(dono, fake, db):
    fake.falhar_em[("select", "orcamentos")] = "42P01"
    corpo = _get(dono)
    assert corpo["orcamentosSemResposta"] == [] and corpo["aprovadasParadas"] == []
    assert corpo["indisponiveis"] == ["orcamentos"]
    assert "reservasSemEstoque" in corpo and "semPagamento" in corpo        # os outros blocos seguem


def test_erro_de_permissao_do_banco_nao_e_engolido(dono, fake, db):
    fake.falhar_em[("select", "estoque_reservas")] = "42501"
    with pytest.raises(Exception):
        dono.get("/alertas")
