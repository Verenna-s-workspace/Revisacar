"""Orçamento da OS (Fase 1): versões, itens, envio, aprovação, recusa e o que cada cargo enxerga."""
import json
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import django
import psycopg2
import pytest

django.setup()

from orders import ordem_status as st  # noqa: E402
from orders import orcamento_views, relatorios_views, views, visao_geral_views  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _corpo_ordem  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
HOJE = datetime(2026, 10, 12, 10, 0, tzinfo=SP)          # segunda, 12/10/2026


@pytest.fixture()
def hoje(monkeypatch):
    """Relógio controlável: hoje["agora"] = datetime(...) muda o "hoje" dos testes."""
    estado = {"agora": HOJE}
    monkeypatch.setattr(visao_geral_views, "_agora", lambda tz: estado["agora"].astimezone(tz))
    return estado


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch, hoje):
    f = FakeSupabase(pg_dsn)
    for modulo in (orcamento_views, relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def dono(fake):
    return _cliente("dono")


@pytest.fixture()
def gerente(fake):
    return _cliente("gerente")


def _os(api, status="em_orcamento"):
    r = api.post("/ordens", {**_corpo_ordem(), "status": status}, format="json")
    assert r.status_code == 201, r.content
    return r.json()["id"]


def _forca_os(db, oid, status):
    db.cursor().execute("update ordens set status=%s where id=%s", (status, oid))


def _status_os(db, oid):
    cur = db.cursor()
    cur.execute("select status from ordens where id=%s", (oid,))
    return cur.fetchone()[0]


def _peca(descricao="Pastilha de freio", qtd=1, preco=100, **kw):
    return {"tipo": "peca", "descricao": descricao, "quantidade": qtd, "precoUnitario": preco, **kw}


def _servico(descricao="Mão de obra", qtd=1, preco=80, **kw):
    return {"tipo": "servico", "descricao": descricao, "quantidade": qtd, "precoUnitario": preco, **kw}


def _rascunho(api, oid, itens=None):
    r = api.post(f"/ordens/{oid}/orcamentos", format="json")
    assert r.status_code == 201, r.content
    orc = r.json()
    if itens is not None:
        r = api.patch(f"/orcamentos/{orc['id']}", {"itens": itens}, format="json")
        assert r.status_code == 200, r.content
        orc = r.json()
    return orc


def _enviado(api, oid, itens=None):
    orc = _rascunho(api, oid, itens or [_peca(), _servico()])
    r = api.post(f"/orcamentos/{orc['id']}/enviar", format="json")
    assert r.status_code == 200, r.content
    return r.json()


# ── nova versão ──────────────────────────────────────────────────────────────

def test_cria_rascunho_versao_1_vazio(dono, db):
    oid = _os(dono)
    r = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    assert r.status_code == 201, r.content
    corpo = r.json()
    assert corpo["versao"] == 1 and corpo["status"] == "rascunho" and corpo["ordemId"] == oid
    assert corpo["itens"] == [] and corpo["total"] == 0 and corpo["validadeDias"] == 7
    assert corpo["osStatus"] == "em_orcamento" and "validadeAte" not in corpo
    assert _status_os(db, oid) == "em_orcamento"


def test_so_existe_um_rascunho_por_os(dono):
    oid = _os(dono)
    primeiro = _rascunho(dono, oid)
    r = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    assert r.status_code == 409
    assert r.json()["codigo"] == "rascunho_existente" and r.json()["orcamentoId"] == primeiro["id"]


@pytest.mark.parametrize("os_status,esperado", [
    ("rascunho", 409), ("aguardando", 409), ("finalizada", 409),
    ("em_orcamento", 201), ("pendente_aprovacao", 201), ("aprovada", 201), ("em_execucao", 201), ("recusada", 201),
])
def test_quais_status_de_os_aceitam_orcamento_novo(dono, db, os_status, esperado):
    oid = _os(dono)
    _forca_os(db, oid, os_status)
    r = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    assert r.status_code == esperado, r.content
    if esperado == 409:
        assert r.json()["codigo"] == "os_status" and r.json()["osStatus"] == os_status


def test_os_inexistente_ou_de_outra_oficina_e_404(dono, db):
    assert dono.post(f"/ordens/{uuid.uuid4()}/orcamentos", format="json").status_code == 404
    oid_b = _os(_cliente("dono", OFICINA_B))
    assert dono.post(f"/ordens/{oid_b}/orcamentos", format="json").status_code == 404
    assert dono.get(f"/ordens/{oid_b}/orcamentos").status_code == 404


def test_lista_da_os_traz_versoes_da_mais_nova_com_itens(dono):
    oid = _os(dono)
    v1 = _enviado(dono, oid)
    v2 = _rascunho(dono, oid)
    corpo = dono.get(f"/ordens/{oid}/orcamentos").json()
    assert [o["versao"] for o in corpo] == [2, 1]
    assert [o["id"] for o in corpo] == [v2["id"], v1["id"]]
    assert len(corpo[1]["itens"]) == 2 and len(corpo[0]["itens"]) == 2     # v2 copiou os itens da v1


# ── editar o rascunho ────────────────────────────────────────────────────────

def test_patch_substitui_itens_e_calcula_total(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid)
    r = dono.patch(f"/orcamentos/{orc['id']}", {
        "validadeDias": 5, "observacoes": "  Cliente pediu peça original  ",
        "itens": [
            _peca("Pastilha", 2, 150.5, marca="Cobreq", motivo="Desgaste", estoqueItemId=str(uuid.uuid4())),
            _servico("Mão de obra", 1, 80, servicoId=str(uuid.uuid4())),
        ],
    }, format="json")
    assert r.status_code == 200, r.content
    corpo = r.json()
    assert corpo["total"] == 381 and corpo["validadeDias"] == 5
    assert corpo["observacoes"] == "Cliente pediu peça original"
    assert [i["subtotal"] for i in corpo["itens"]] == [301, 80]
    assert corpo["itens"][0]["marca"] == "Cobreq" and corpo["itens"][0]["motivo"] == "Desgaste"
    assert "estoqueItemId" in corpo["itens"][0] and "servicoId" in corpo["itens"][1]

    # A lista nova SUBSTITUI a antiga inteira.
    r = dono.patch(f"/orcamentos/{orc['id']}", {"itens": [_servico("Alinhamento", 1, 120)]}, format="json")
    assert [i["descricao"] for i in r.json()["itens"]] == ["Alinhamento"] and r.json()["total"] == 120


def test_patch_sem_itens_nao_mexe_nos_itens(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca(preco=100, custoUnitario=60)])
    r = dono.patch(f"/orcamentos/{orc['id']}", {"observacoes": "x"}, format="json")
    assert r.json()["itens"][0]["custoUnitario"] == 60 and r.json()["total"] == 100


def test_subtotal_arredonda_igual_ao_banco(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca(qtd=1.5, preco=10.01)])     # 15,015 → 15,02
    assert orc["itens"][0]["subtotal"] == 15.02 and orc["total"] == 15.02


@pytest.mark.parametrize("item", [
    {"tipo": "outro", "descricao": "x", "quantidade": 1, "precoUnitario": 1},
    {"tipo": "peca", "descricao": "   ", "quantidade": 1, "precoUnitario": 1},
    {"tipo": "peca", "descricao": "x", "quantidade": 0, "precoUnitario": 1},
    {"tipo": "peca", "descricao": "x", "quantidade": 1, "precoUnitario": -1},
    {"tipo": "peca", "descricao": "x", "quantidade": 1, "precoUnitario": 1, "custoUnitario": -5},
    {"tipo": "peca", "descricao": "x", "quantidade": "NaN", "precoUnitario": 1},
    {"tipo": "peca", "descricao": "x", "quantidade": 1, "precoUnitario": "Infinity"},
    {"tipo": "peca", "descricao": "x" * 301, "quantidade": 1, "precoUnitario": 1},
    {"tipo": "servico", "descricao": "x", "quantidade": 1, "precoUnitario": 1, "estoqueItemId": str(uuid.uuid4())},
    {"tipo": "peca", "descricao": "x", "quantidade": 1, "precoUnitario": 1, "servicoId": str(uuid.uuid4())},
    {"tipo": "peca", "descricao": "x", "quantidade": 1, "precoUnitario": 1, "estoqueItemId": "nao-e-uuid"},
    {"descricao": "x", "quantidade": 1, "precoUnitario": 1},
])
def test_item_invalido_e_422_e_nao_altera_nada(dono, item):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca(preco=50)])
    r = dono.patch(f"/orcamentos/{orc['id']}", {"itens": [item]}, format="json")
    assert r.status_code == 422, r.content
    assert dono.get(f"/orcamentos/{orc['id']}").json()["total"] == 50


def test_limites_do_corpo(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid)
    url = f"/orcamentos/{orc['id']}"
    assert dono.patch(url, {"validadeDias": 0}, format="json").status_code == 422
    assert dono.patch(url, {"validadeDias": 91}, format="json").status_code == 422
    assert dono.patch(url, {"observacoes": "x" * 2001}, format="json").status_code == 422
    assert dono.patch(url, {"itens": [_peca(descricao=f"p{i}") for i in range(101)]}, format="json").status_code == 422
    assert dono.patch(url, {"itens": [_peca(descricao=f"p{i}") for i in range(100)]}, format="json").status_code == 200
    assert dono.patch(url, [1, 2], format="json").status_code == 422


# ── custo e margem ───────────────────────────────────────────────────────────

def test_dono_ve_custo_e_margem(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca(qtd=2, preco=100, custoUnitario=60), _servico(preco=80)])
    assert orc["total"] == 280
    assert orc["itens"][0]["custoUnitario"] == 60 and "custoUnitario" not in orc["itens"][1]
    assert orc["custoTotal"] == 120 and orc["margem"] == 160 and orc["margemPercentual"] == 57.1


def test_gerente_nunca_recebe_custo_nem_margem(dono, gerente):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca(preco=100, custoUnitario=60)])
    for corpo in (
        gerente.get(f"/orcamentos/{orc['id']}").json(),
        gerente.get(f"/ordens/{oid}/orcamentos").json()[0],
    ):
        assert "custoTotal" not in corpo and "margem" not in corpo and "margemPercentual" not in corpo
        assert "custoUnitario" not in json.dumps(corpo)
        assert corpo["total"] == 100 and corpo["itens"][0]["precoUnitario"] == 100


def test_gerente_editando_nao_apaga_o_custo_gravado(dono, gerente):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca("Pastilha", preco=100, custoUnitario=60)])
    item_id = orc["itens"][0]["id"]

    r = gerente.patch(f"/orcamentos/{orc['id']}", {"itens": [
        {"id": item_id, **_peca("Pastilha", 2, 110)},          # sem custoUnitario: preserva
        _servico(preco=90),                                      # item novo: sem custo
    ]}, format="json")
    assert r.status_code == 200 and r.json()["total"] == 310
    visto_pelo_dono = dono.get(f"/orcamentos/{orc['id']}").json()
    assert visto_pelo_dono["itens"][0]["custoUnitario"] == 60
    assert "custoUnitario" not in visto_pelo_dono["itens"][1]
    assert visto_pelo_dono["custoTotal"] == 120

    # `null` explícito limpa; `id` desconhecido não herda custo de ninguém.
    r = dono.patch(f"/orcamentos/{orc['id']}", {"itens": [
        {"id": item_id, **_peca("Pastilha", 1, 110, custoUnitario=None)},
        {"id": str(uuid.uuid4()), **_peca("Disco", 1, 200)},
    ]}, format="json")
    assert "custoUnitario" not in r.json()["itens"][0] and "custoUnitario" not in r.json()["itens"][1]


def test_nova_versao_copia_o_custo(dono):
    oid = _os(dono)
    _enviado(dono, oid, [_peca(preco=100, custoUnitario=60)])
    v2 = dono.post(f"/ordens/{oid}/orcamentos", format="json").json()
    assert v2["itens"][0]["custoUnitario"] == 60 and v2["total"] == 100


# ── permissões ───────────────────────────────────────────────────────────────

def test_atendente_so_le_e_mecanico_edita(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca()])
    atendente, mecanico = _cliente("atendente"), _cliente("mecanico")
    assert atendente.get(f"/orcamentos/{orc['id']}").status_code == 200
    assert atendente.get(f"/ordens/{oid}/orcamentos").status_code == 200
    assert atendente.post(f"/ordens/{oid}/orcamentos", format="json").status_code == 403
    assert atendente.patch(f"/orcamentos/{orc['id']}", {"observacoes": "x"}, format="json").status_code == 403
    for acao in ("enviar", "aprovar", "recusar"):
        assert atendente.post(f"/orcamentos/{orc['id']}/{acao}", format="json").status_code == 403
    assert mecanico.patch(f"/orcamentos/{orc['id']}", {"observacoes": "x"}, format="json").status_code == 200


def test_sem_token_e_401():
    from rest_framework.test import APIClient
    assert APIClient().get(f"/ordens/x/orcamentos").status_code == 401
    assert APIClient().post(f"/orcamentos/{uuid.uuid4()}/enviar").status_code == 401


# ── enviar ───────────────────────────────────────────────────────────────────

def test_enviar_sem_itens_e_422(dono, db):
    oid = _os(dono)
    orc = _rascunho(dono, oid)
    r = dono.post(f"/orcamentos/{orc['id']}/enviar", format="json")
    assert r.status_code == 422 and r.json()["codigo"] == "sem_itens" and r.json()["itens"]
    assert _status_os(db, oid) == "em_orcamento"


def test_enviar_define_validade_e_move_a_os(dono, db):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca(), _servico()])
    dono.patch(f"/orcamentos/{orc['id']}", {"validadeDias": 5}, format="json")
    r = dono.post(f"/orcamentos/{orc['id']}/enviar", format="json")
    assert r.status_code == 200, r.content
    corpo = r.json()
    assert corpo["status"] == "enviado" and corpo["validadeAte"] == "2026-10-17" and corpo["vencido"] is False
    assert "enviadoEm" in corpo and corpo["osStatus"] == "pendente_aprovacao"
    assert _status_os(db, oid) == "pendente_aprovacao"


def test_validade_usa_o_dia_do_fuso_do_usuario(dono, hoje):
    hoje["agora"] = datetime(2026, 10, 13, 1, 30, tzinfo=ZoneInfo("UTC"))      # ainda dia 12 em São Paulo
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca()])
    assert dono.post(f"/orcamentos/{orc['id']}/enviar", format="json").json()["validadeAte"] == "2026-10-19"
    oid2 = _os(dono)
    orc2 = _rascunho(dono, oid2, [_peca()])
    r = dono.post(f"/orcamentos/{orc2['id']}/enviar?tz=Asia/Tokyo", format="json")
    assert r.json()["validadeAte"] == "2026-10-20"


def test_fuso_invalido_e_422(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca()])
    assert dono.post(f"/orcamentos/{orc['id']}/enviar?tz=Marte/Olympus", format="json").status_code == 422
    assert dono.get(f"/ordens/{oid}/orcamentos?tz=Marte/Olympus").status_code == 422
    assert dono.get(f"/orcamentos/{orc['id']}").status_code == 200       # leitura de uma versão tolera


def test_enviado_nao_se_edita_nem_se_reenvia(dono):
    oid = _os(dono)
    enviado = _enviado(dono, oid)
    r = dono.patch(f"/orcamentos/{enviado['id']}", {"observacoes": "x"}, format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "status_invalido" and r.json()["status"] == "enviado"
    assert dono.post(f"/orcamentos/{enviado['id']}/enviar", format="json").status_code == 409


def test_enviar_com_a_os_fora_de_fase_nao_muda_nada(dono, db):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca()])
    _forca_os(db, oid, "aguardando")
    r = dono.post(f"/orcamentos/{orc['id']}/enviar", format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "os_status"
    assert dono.get(f"/orcamentos/{orc['id']}").json()["status"] == "rascunho"
    assert _status_os(db, oid) == "aguardando"


def test_enviar_nova_versao_substitui_a_anterior(dono, db):
    oid = _os(dono)
    v1 = _enviado(dono, oid)
    v2 = _rascunho(dono, oid, [_peca("Disco", 1, 300)])
    assert v2["versao"] == 2 and _status_os(db, oid) == "pendente_aprovacao"      # criar rascunho não mexe na OS
    assert dono.get(f"/orcamentos/{v1['id']}").json()["status"] == "enviado"      # v1 vale até a v2 ser enviada
    assert dono.post(f"/orcamentos/{v2['id']}/enviar", format="json").status_code == 200
    estados = {o["versao"]: o["status"] for o in dono.get(f"/ordens/{oid}/orcamentos").json()}
    assert estados == {1: "substituido", 2: "enviado"}
    assert _status_os(db, oid) == "pendente_aprovacao"


# ── aprovar ──────────────────────────────────────────────────────────────────

def test_aprovar_registra_quem_como_e_move_a_os(dono, db):
    oid = _os(dono)
    enviado = _enviado(dono, oid)
    r = _cliente("mecanico").post(f"/orcamentos/{enviado['id']}/aprovar",
                                  {"canal": "whatsapp", "observacao": "  Aprovou às 14h  "}, format="json")
    assert r.status_code == 200, r.content
    corpo = r.json()
    assert corpo["status"] == "aprovado" and corpo["aprovacaoCanal"] == "whatsapp"
    assert corpo["aprovacaoObs"] == "Aprovou às 14h" and corpo["aprovadoPorNome"] == "mecanico"
    assert "aprovadoEm" in corpo and corpo["osStatus"] == "aprovada"
    assert _status_os(db, oid) == "aprovada"
    assert "vencido" not in corpo        # só enviado tem "vencido"


def test_aprovar_sem_corpo_assume_whatsapp(dono):
    enviado = _enviado(dono, _os(dono))
    r = dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json")
    assert r.status_code == 200 and r.json()["aprovacaoCanal"] == "whatsapp"


def test_aprovar_valida_canal_e_observacao(dono):
    enviado = _enviado(dono, _os(dono))
    url = f"/orcamentos/{enviado['id']}/aprovar"
    assert dono.post(url, {"canal": "pombo-correio"}, format="json").status_code == 422
    assert dono.post(url, {"observacao": "x" * 501}, format="json").status_code == 422
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["status"] == "enviado"


def test_so_aprova_o_que_foi_enviado(dono):
    oid = _os(dono)
    rascunho = _rascunho(dono, oid, [_peca()])
    r = dono.post(f"/orcamentos/{rascunho['id']}/aprovar", format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "status_invalido"
    enviado = dono.post(f"/orcamentos/{rascunho['id']}/enviar", format="json").json()
    assert dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json").status_code == 200
    assert dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json").status_code == 409      # já aprovado


def test_orcamento_vencido_nao_aprova(dono, hoje, db):
    enviado = _enviado(dono, _os(dono))                                 # validade: 19/10
    hoje["agora"] = datetime(2026, 10, 19, 23, 0, tzinfo=SP)
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["vencido"] is False     # no último dia ainda vale
    hoje["agora"] = datetime(2026, 10, 20, 0, 5, tzinfo=SP)
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["vencido"] is True
    r = dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "vencido" and r.json()["validadeAte"] == "2026-10-19"
    assert _status_os(db, enviado["ordemId"]) == "pendente_aprovacao"
    # Dá pra recusar o vencido, ou refazer: nova versão copia os itens e vale de novo.
    v2 = dono.post(f"/ordens/{enviado['ordemId']}/orcamentos", format="json").json()
    assert dono.post(f"/orcamentos/{v2['id']}/enviar", format="json").json()["validadeAte"] == "2026-10-27"
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["status"] == "substituido"


def test_aprovar_com_a_os_fora_de_fase_nao_muda_nada(dono, db):
    enviado = _enviado(dono, _os(dono))
    _forca_os(db, enviado["ordemId"], "aguardando")
    r = dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "os_status"
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["status"] == "enviado"


# ── recusar e refazer ────────────────────────────────────────────────────────

def test_recusar_guarda_motivo_e_marca_a_os(dono, db):
    oid = _os(dono)
    enviado = _enviado(dono, oid)
    r = dono.post(f"/orcamentos/{enviado['id']}/recusar", {"motivo": "  Achou caro  "}, format="json")
    assert r.status_code == 200, r.content
    corpo = r.json()
    assert corpo["status"] == "recusado" and corpo["motivoRecusa"] == "Achou caro" and "recusadoEm" in corpo
    assert corpo["osStatus"] == "recusada" and _status_os(db, oid) == "recusada"


def test_recusar_sem_motivo_funciona(dono):
    enviado = _enviado(dono, _os(dono))
    r = dono.post(f"/orcamentos/{enviado['id']}/recusar", format="json")
    assert r.status_code == 200 and "motivoRecusa" not in r.json()
    assert dono.post(f"/orcamentos/{enviado['id']}/recusar", {"motivo": "x" * 501}, format="json").status_code == 422


def test_recusar_rascunho_ou_repetir_e_409(dono):
    oid = _os(dono)
    rascunho = _rascunho(dono, oid, [_peca()])
    assert dono.post(f"/orcamentos/{rascunho['id']}/recusar", format="json").status_code == 409
    enviado = dono.post(f"/orcamentos/{rascunho['id']}/enviar", format="json").json()
    assert dono.post(f"/orcamentos/{enviado['id']}/recusar", format="json").status_code == 200
    assert dono.post(f"/orcamentos/{enviado['id']}/recusar", format="json").status_code == 409


def test_refazer_depois_da_recusa_reabre_a_os(dono, db):
    oid = _os(dono)
    v1 = _enviado(dono, oid, [_peca(preco=100, custoUnitario=40)])
    dono.post(f"/orcamentos/{v1['id']}/recusar", {"motivo": "caro"}, format="json")
    assert _status_os(db, oid) == "recusada"

    v2 = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    assert v2.status_code == 201 and v2.json()["osStatus"] == "em_orcamento"
    assert _status_os(db, oid) == "em_orcamento"
    assert v2.json()["versao"] == 2 and v2.json()["total"] == 100         # partiu dos itens da v1
    dono.patch(f"/orcamentos/{v2.json()['id']}", {"itens": [_peca(preco=80)]}, format="json")
    assert dono.post(f"/orcamentos/{v2.json()['id']}/enviar", format="json").status_code == 200
    estados = {o["versao"]: o["status"] for o in dono.get(f"/ordens/{oid}/orcamentos").json()}
    assert estados == {1: "recusado", 2: "enviado"}                         # recusada fica como histórico
    assert _status_os(db, oid) == "pendente_aprovacao"


def test_recusar_orcamento_aprovado_antes_de_executar(dono, db):
    oid = _os(dono)
    enviado = _enviado(dono, oid)
    dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json")
    assert dono.post(f"/orcamentos/{enviado['id']}/recusar", {"motivo": "desistiu"}, format="json").status_code == 200
    assert _status_os(db, oid) == "recusada"


def test_nao_recusa_depois_que_a_execucao_comecou(dono, db):
    oid = _os(dono)
    enviado = _enviado(dono, oid)
    dono.post(f"/orcamentos/{enviado['id']}/aprovar", format="json")
    _forca_os(db, oid, "em_execucao")
    r = dono.post(f"/orcamentos/{enviado['id']}/recusar", format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "os_status"
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["status"] == "aprovado"
    assert _status_os(db, oid) == "em_execucao"


# ── editar um orçamento já aprovado ──────────────────────────────────────────

def test_editar_aprovado_vira_nova_versao_que_volta_pra_aprovacao(dono, db):
    oid = _os(dono)
    v1 = _enviado(dono, oid)
    dono.post(f"/orcamentos/{v1['id']}/aprovar", format="json")
    assert _status_os(db, oid) == "aprovada"

    v2 = dono.post(f"/ordens/{oid}/orcamentos", format="json").json()
    assert v2["osStatus"] == "aprovada"                                       # só rascunho: a aprovação segue valendo
    assert dono.get(f"/orcamentos/{v1['id']}").json()["status"] == "aprovado"
    dono.patch(f"/orcamentos/{v2['id']}", {"itens": [_peca(preco=150), _servico(preco=80)]}, format="json")
    r = dono.post(f"/orcamentos/{v2['id']}/enviar", format="json")
    assert r.status_code == 200 and r.json()["osStatus"] == "pendente_aprovacao"
    estados = {o["versao"]: o["status"] for o in dono.get(f"/ordens/{oid}/orcamentos").json()}
    assert estados == {1: "substituido", 2: "enviado"}
    assert _status_os(db, oid) == "pendente_aprovacao"


def test_revisao_durante_a_execucao_volta_pra_aprovacao(dono, db):
    oid = _os(dono)
    v1 = _enviado(dono, oid)
    dono.post(f"/orcamentos/{v1['id']}/aprovar", format="json")
    _forca_os(db, oid, "em_execucao")
    v2 = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    assert v2.status_code == 201
    assert dono.post(f"/orcamentos/{v2.json()['id']}/enviar", format="json").json()["osStatus"] == "pendente_aprovacao"


# ── isolamento entre oficinas ────────────────────────────────────────────────

def test_outra_oficina_nao_enxerga_nem_mexe(dono):
    oid = _os(dono)
    enviado = _enviado(dono, oid)
    rascunho_id = _rascunho(dono, oid)["id"]
    outra = _cliente("dono", OFICINA_B)
    assert outra.get(f"/orcamentos/{enviado['id']}").status_code == 404
    assert outra.patch(f"/orcamentos/{rascunho_id}", {"observacoes": "x"}, format="json").status_code == 404
    for acao in ("enviar", "aprovar", "recusar"):
        assert outra.post(f"/orcamentos/{enviado['id']}/{acao}", format="json").status_code == 404
    assert dono.get(f"/orcamentos/{enviado['id']}").json()["status"] == "enviado"


def test_id_malformado_e_404(dono):
    assert dono.get("/orcamentos/nao-e-uuid").status_code == 404
    assert dono.patch("/orcamentos/nao-e-uuid", {}, format="json").status_code == 404
    for acao in ("enviar", "aprovar", "recusar"):
        assert dono.post(f"/orcamentos/nao-e-uuid/{acao}", format="json").status_code == 404


# ── garantias do banco ───────────────────────────────────────────────────────

def test_banco_recusa_dois_ativos_ou_dois_rascunhos_na_mesma_os(dono, db):
    oid = _os(dono)
    _enviado(dono, oid)
    cur = db.cursor()
    with pytest.raises(psycopg2.errors.UniqueViolation):
        cur.execute("insert into orcamentos (oficina_doc, ordem_id, versao, status) values (%s, %s, 99, 'aprovado')",
                    (OFICINA_A, oid))
    _rascunho(dono, oid)
    with pytest.raises(psycopg2.errors.UniqueViolation):
        cur.execute("insert into orcamentos (oficina_doc, ordem_id, versao, status) values (%s, %s, 98, 'rascunho')",
                    (OFICINA_A, oid))


def test_orcamento_nao_aponta_pra_os_de_outra_oficina(dono, db):
    oid = _os(dono)
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        db.cursor().execute("insert into orcamentos (oficina_doc, ordem_id, versao) values (%s, %s, 1)", (OFICINA_B, oid))


def test_apagar_a_os_leva_orcamentos_e_itens(dono, db):
    oid = _os(dono)
    _enviado(dono, oid)
    cur = db.cursor()
    cur.execute("delete from ordens where id=%s", (oid,))
    cur.execute("select (select count(*) from orcamentos), (select count(*) from orcamento_itens)")
    assert cur.fetchone() == (0, 0)


def test_itens_ficam_na_ordem_enviada(dono):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_servico("Z"), _peca("A"), _peca("M")])
    assert [i["descricao"] for i in orc["itens"]] == ["Z", "A", "M"]


# ── banco sem o script ───────────────────────────────────────────────────────

@pytest.mark.parametrize("operacao,nome", [("rpc", "orcamento_criar_versao"), ("select", "orcamentos")])
def test_script_nao_rodado_vira_503_com_instrucao(dono, fake, operacao, nome):
    oid = _os(dono)
    fake.falhar_em[(operacao, nome)] = "42P01" if operacao == "select" else "PGRST202"
    r = dono.post(f"/ordens/{oid}/orcamentos", format="json") if operacao == "rpc" else dono.get(f"/ordens/{oid}/orcamentos")
    assert r.status_code == 503 and "orcamentos.sql" in r.json()["detail"]


def test_chave_sem_permissao_e_500_apontando_a_config(dono, fake):
    oid = _os(dono)
    fake.falhar_em[("select", "orcamentos")] = "42501"
    r = dono.get(f"/ordens/{oid}/orcamentos")
    assert r.status_code == 500 and "supabase.env" in r.json()["detail"]


# ── helpers de status ────────────────────────────────────────────────────────

def test_origens_para_so_lista_quem_pode_chegar_la():
    assert set(st.origens_para(st.PENDENTE_APROVACAO)) == {
        st.PENDENTE_APROVACAO, st.EM_ORCAMENTO, st.APROVADA, st.EM_EXECUCAO}
    assert set(st.origens_para(st.APROVADA)) == {st.APROVADA, st.EM_ORCAMENTO, st.PENDENTE_APROVACAO}
    assert st.FINALIZADA not in st.origens_para(st.RECUSADA) and st.EM_EXECUCAO not in st.origens_para(st.RECUSADA)
    assert set(st.ACEITAM_NOVO_ORCAMENTO) <= set(st.TODOS)
