"""Link público do orçamento (Fase 6, parte A): token, rotas da oficina, rotas públicas, abuso e vazamento."""
import json
import uuid
from datetime import timedelta

import django
import pytest

django.setup()

from django.test import override_settings  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from orders import alertas_views, estoque_views, orcamento_link_views as lv  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .test_orcamento import (  # noqa: E402,F401
    HOJE, _cliente, _enviado, _forca_os, _os, _peca, _servico, dono, fake, gerente, hoje,
)
from .test_orcamento_efeitos import _aprovar, _item_estoque, _lancamentos, _reservas  # noqa: E402


@pytest.fixture(autouse=True)
def _modulos_no_fake(fake, monkeypatch):
    for modulo in (lv, estoque_views, alertas_views):
        monkeypatch.setattr(modulo, "supabase", fake)
    lv._marcas.clear()
    relogio = {"t": 1_000_000.0}
    monkeypatch.setattr(lv, "_relogio", lambda: relogio["t"])
    return relogio


@pytest.fixture()
def relogio(_modulos_no_fake):
    return _modulos_no_fake


def _publico():
    return APIClient()


def _gerar(api, orc_id, **corpo):
    r = api.post(f"/orcamentos/{orc_id}/link", corpo, format="json")
    assert r.status_code in (200, 201), r.content
    return r.json()["link"]


def _enviado_com_link(api, itens=None):
    oid = _os(api)
    orc = _enviado(api, oid, itens)
    return oid, orc, _gerar(api, orc["id"])


def _url(token, fim=""):
    return f"/publico/orcamentos/{token}{fim}"


def _aprova(pub, token, ip=None, **extra):
    corpo = {"nome": "Maria Souza", "aceito": True, **extra}
    return pub.post(_url(token, "/aprovar"), corpo, format="json", **({"REMOTE_ADDR": ip} if ip else {}))


def _linha(db, sql, params=()):
    cur = db.cursor()
    cur.execute(sql, params)
    return cur.fetchone()


# ── token ────────────────────────────────────────────────────────────────────

def test_token_ida_e_volta():
    lid = uuid.uuid4()
    t = lv.token_do_link(lid)
    assert lv.id_do_token(t) == lid
    assert lv.token_do_link(lid) == t                       # determinístico: a oficina revê o mesmo link
    assert len(t) < 80 and all(c.isalnum() or c in "-_." for c in t)


@pytest.mark.parametrize("lixo", ["", ".", "a.b", "x" * 200, "AAAA.BBBB", None, 123, "../../etc/passwd"])
def test_token_lixo_e_invalido(lixo):
    assert lv.id_do_token(lixo) is None


def test_token_adulterado_ou_de_outro_servidor_e_invalido():
    lid = uuid.uuid4()
    parte_id, _, parte_mac = lv.token_do_link(lid).partition(".")
    assert lv.id_do_token(f"{parte_id}.{'A' * len(parte_mac)}") is None            # mac trocado
    assert lv.id_do_token(f"{lv._b64(uuid.uuid4().bytes)}.{parte_mac}") is None     # id trocado, mac antigo
    with override_settings(SECRET_KEY="outra-chave"):
        assert lv.id_do_token(lv.token_do_link(lid)) == lid                         # (settings.SECRET_KEY é lido ao vivo)
    t = lv.token_do_link(lid)
    with override_settings(SECRET_KEY="outra-chave"):
        assert lv.id_do_token(t) is None                                            # token feito com a chave antiga


def test_token_nao_fica_no_banco(dono, db):
    _, _, link = _enviado_com_link(dono)
    cur = db.cursor()
    cur.execute("select row_to_json(l)::text from orcamento_links l")
    texto = cur.fetchone()[0]
    assert link["token"] not in texto
    assert link["token"].split(".")[1] not in texto


# ── rotas da oficina ─────────────────────────────────────────────────────────

def test_gerar_link_201_e_depois_200_com_o_mesmo(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    r = dono.post(f"/orcamentos/{orc['id']}/link", format="json")
    assert r.status_code == 201, r.content
    link = r.json()["link"]
    assert link["ativo"] is True and link["acessos"] == 0 and link["token"]
    r2 = dono.post(f"/orcamentos/{orc['id']}/link", format="json")
    assert r2.status_code == 200 and r2.json()["link"]["token"] == link["token"]
    assert dono.get(f"/orcamentos/{orc['id']}/link").json()["link"]["token"] == link["token"]
    assert _linha(db, "select count(*) from orcamento_links")[0] == 1


def test_get_sem_link_devolve_null(dono, db):
    orc = _enviado(dono, _os(dono))
    r = dono.get(f"/orcamentos/{orc['id']}/link")
    assert r.status_code == 200 and r.json() == {"link": None}


def test_renovar_troca_o_link_e_o_antigo_para_de_funcionar(dono, db):
    _, orc, antigo = _enviado_com_link(dono)
    novo = _gerar(dono, orc["id"], renovar=True)
    assert novo["token"] != antigo["token"]
    pub = _publico()
    assert pub.get(_url(antigo["token"])).status_code == 410
    assert pub.get(_url(novo["token"])).status_code == 200
    assert _linha(db, "select count(*) from orcamento_links where revogado_em is null")[0] == 1


def test_revogar_derruba_o_link_e_e_idempotente(dono, db):
    _, orc, link = _enviado_com_link(dono)
    assert dono.delete(f"/orcamentos/{orc['id']}/link").status_code == 204
    r = _publico().get(_url(link["token"]))
    assert r.status_code == 410 and r.json()["codigo"] == "link_revogado"
    assert dono.delete(f"/orcamentos/{orc['id']}/link").status_code == 204
    assert dono.get(f"/orcamentos/{orc['id']}/link").json() == {"link": None}


def test_link_vencido_pelo_prazo_e_recriado(dono, db):
    _, orc, velho = _enviado_com_link(dono)
    db.cursor().execute("update orcamento_links set expira_em = '2026-10-01'")
    r = _publico().get(_url(velho["token"]))
    assert r.status_code == 410 and r.json()["codigo"] == "link_expirado"
    r2 = dono.post(f"/orcamentos/{orc['id']}/link", format="json")
    assert r2.status_code == 201 and r2.json()["link"]["token"] != velho["token"]


def test_so_orcamento_enviado_tem_link(dono, db):
    oid = _os(dono)
    rasc = dono.post(f"/ordens/{oid}/orcamentos", format="json").json()
    r = dono.post(f"/orcamentos/{rasc['id']}/link", format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "status_invalido"


def test_orcamento_ja_respondido_nao_gera_link(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    _aprovar(dono, orc)
    r = dono.post(f"/orcamentos/{orc['id']}/link", format="json")
    assert r.status_code == 409 and r.json()["status"] == "aprovado"


def test_permissoes_do_link_na_oficina(dono, db):
    _, orc, link = _enviado_com_link(dono)
    atendente = _cliente("atendente")                 # tem ordens.ver, não tem ordens.editar
    assert atendente.get(f"/orcamentos/{orc['id']}/link").status_code == 200
    assert atendente.post(f"/orcamentos/{orc['id']}/link", format="json").status_code == 403
    assert atendente.delete(f"/orcamentos/{orc['id']}/link").status_code == 403
    assert _publico().get(f"/orcamentos/{orc['id']}/link").status_code == 401
    assert _publico().post(f"/orcamentos/{orc['id']}/link", format="json").status_code == 401
    assert _publico().get(_url(link["token"])).status_code == 200      # nada disso derrubou o link


def test_link_de_outra_oficina_e_404(dono, db):
    _, orc, _ = _enviado_com_link(dono)
    outra = _cliente("dono", OFICINA_B)
    for metodo in ("get", "post", "delete"):
        assert getattr(outra, metodo)(f"/orcamentos/{orc['id']}/link").status_code == 404
    assert dono.get("/orcamentos/nao-e-uuid/link").status_code == 404
    assert dono.get(f"/orcamentos/{uuid.uuid4()}/link").status_code == 404


def test_renovar_precisa_ser_booleano(dono, db):
    orc = _enviado(dono, _os(dono))
    assert dono.post(f"/orcamentos/{orc['id']}/link", {"renovar": "talvez"}, format="json").status_code == 422


# ── página pública: o que o cliente vê ───────────────────────────────────────

def _chaves(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from _chaves(v)
    elif isinstance(o, list):
        for v in o:
            yield from _chaves(v)


def test_publico_mostra_o_orcamento(dono, db):
    _, orc, link = _enviado_com_link(dono, [_peca("Pastilha", 2, 100, marca="Cobreq"), _servico("Troca", 1, 80)])
    r = _publico().get(_url(link["token"]))
    assert r.status_code == 200, r.content
    c = r.json()
    assert c["oficina"]["nome"] and c["ordem"]["osNum"] == "OS-1"
    assert c["ordem"]["clienteNome"] == "Maria" and c["ordem"]["veiculo"]["placa"] == "ABC1D23"
    o = c["orcamento"]
    assert o["status"] == "enviado" and o["total"] == 280 and o["versao"] == 1 and o["vencido"] is False
    assert [i["descricao"] for i in o["itens"]] == ["Pastilha", "Troca"]
    assert o["itens"][0]["quantidade"] == 2 and o["itens"][0]["precoUnitario"] == 100 and o["itens"][0]["subtotal"] == 200
    assert c["podeDecidir"] is True and c["bloqueio"] is None and c["pdfDisponivel"] is True


def test_publico_nao_vaza_custo_margem_nem_dados_internos(dono, db):
    item_id = _item_estoque(db)
    oid = _os(dono)
    db.cursor().execute(
        "update ordens set payload = %s where id = %s",
        (json.dumps({"os_header": {"os_num": "OS-1"}, "cliente": {"nome": "Maria", "tel": "11988887777", "doc": "123.456.789-09"},
                     "veiculo": {"placa": "ABC1D23", "modelo": "Onix"}, "status": "em_orcamento"}), oid),
    )
    orc = _enviado(dono, oid, [_peca("Pastilha", 1, 100, custoUnitario=61, estoqueItemId=item_id), _servico("Troca", 1, 80)])
    link = _gerar(dono, orc["id"])
    r = _publico().get(_url(link["token"]))
    assert r.status_code == 200
    texto = r.content.decode()
    for proibido in ("custoUnitario", "custoTotal", "margem", "estoqueItemId", "servicoId", "ordemId", "oficina_doc",
                     OFICINA_A, "11988887777", "123.456.789-09", "criadoPorNome", item_id, orc["id"], str(link["id"]), "61"):
        assert proibido not in texto, proibido
    assert {"id", "tel", "doc"}.isdisjoint(_chaves(r.json()))


def test_publico_tem_cabecalhos_de_privacidade(dono, db):
    _, _, link = _enviado_com_link(dono)
    for r in (_publico().get(_url(link["token"])), _publico().get(_url("lixo"))):
        assert r["Cache-Control"] == "no-store"
        assert "noindex" in r["X-Robots-Tag"]
        assert r["Referrer-Policy"] == "no-referrer"


def test_acessos_sao_contados_e_a_oficina_ve(dono, db):
    _, orc, link = _enviado_com_link(dono)
    pub = _publico()
    pub.get(_url(link["token"]))
    pub.get(_url(link["token"]))
    atual = dono.get(f"/orcamentos/{orc['id']}/link").json()["link"]
    assert atual["acessos"] == 2 and atual["primeiroAcessoEm"] and atual["ultimoAcessoEm"]


def test_falha_ao_contar_acesso_nao_derruba_a_pagina(dono, fake, db):
    _, _, link = _enviado_com_link(dono)
    fake.falhar_em[("rpc", "orcamento_link_acessou")] = "XX000"
    assert _publico().get(_url(link["token"])).status_code == 200


def test_token_falso_e_link_inexistente_respondem_igual(dono, db):
    _, _, link = _enviado_com_link(dono)
    inexistente = lv.token_do_link(uuid.uuid4())              # autêntico, mas sem linha no banco
    pub = _publico()
    a, b = pub.get(_url("lixo.lixo")), pub.get(_url(inexistente))
    assert a.status_code == b.status_code == 404 and a.json() == b.json()


def test_token_falso_nem_chega_no_banco(dono, fake, db):
    fake.chamadas.clear()
    for t in ("lixo", "a.b", "x" * 100, lv.token_do_link(uuid.uuid4())[:-3] + "AAA"):
        _publico().get(_url(t))
        _publico().post(_url(t, "/aprovar"), {"nome": "Maria", "aceito": True}, format="json")
    assert fake.chamadas == []


@pytest.mark.parametrize("estado,esperado", [("aprovado", "aprovado"), ("recusado", "recusado")])
def test_orcamento_respondido_mostra_o_estado_final(dono, db, estado, esperado):
    oid, orc, link = _enviado_com_link(dono)
    if estado == "aprovado":
        _aprovar(dono, orc)
    else:
        dono.post(f"/orcamentos/{orc['id']}/recusar", {"motivo": "caro"}, format="json")
    c = _publico().get(_url(link["token"])).json()
    assert c["podeDecidir"] is False and c["bloqueio"] == esperado and c["orcamento"]["status"] == esperado


def test_orcamento_vencido_nao_pode_decidir(dono, db):
    _, _, link = _enviado_com_link(dono)
    db.cursor().execute("update orcamentos set validade_ate = '2026-10-01'")
    c = _publico().get(_url(link["token"])).json()
    assert c["orcamento"]["vencido"] is True and c["podeDecidir"] is False and c["bloqueio"] == "vencido"


def test_versao_substituida_mostra_o_aviso(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    nova = dono.post(f"/ordens/{oid}/orcamentos", format="json").json()
    dono.patch(f"/orcamentos/{nova['id']}", {"itens": [_peca("Outra", 1, 50)]}, format="json")
    assert dono.post(f"/orcamentos/{nova['id']}/enviar", format="json").status_code == 200
    c = _publico().get(_url(link["token"])).json()
    assert c["bloqueio"] == "substituido" and c["podeDecidir"] is False
    assert _aprova(_publico(), link["token"]).status_code == 409


def test_pdf_publico(dono, db):
    _, _, link = _enviado_com_link(dono)
    r = _publico().get(_url(link["token"], "/pdf"))
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf" and r.content.startswith(b"%PDF")
    assert r["Cache-Control"] == "no-store"
    assert _publico().get(_url("lixo", "/pdf")).status_code == 404


def test_pdf_de_link_revogado_e_410(dono, db):
    _, orc, link = _enviado_com_link(dono)
    dono.delete(f"/orcamentos/{orc['id']}/link")
    assert _publico().get(_url(link["token"], "/pdf")).status_code == 410


# ── aprovar pelo link ────────────────────────────────────────────────────────

def test_cliente_aprova_pelo_link_com_os_mesmos_efeitos_da_oficina(dono, fake, db):
    item_id = _item_estoque(db, quantidade=10)
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("Pastilha", 2, 100, estoqueItemId=item_id), _servico("Troca", 1, 80)])
    link = _gerar(dono, orc["id"])
    r = _aprova(_publico(), link["token"], observacao="pode fazer")
    assert r.status_code == 200, r.content
    c = r.json()
    assert c["orcamento"]["status"] == "aprovado" and c["podeDecidir"] is False
    assert c["orcamento"]["aprovadoPorNome"] == "Maria Souza"

    api = dono.get(f"/orcamentos/{orc['id']}").json()
    assert api["status"] == "aprovado" and api["aprovacaoCanal"] == "link" and api["aprovadoPorNome"] == "Maria Souza"
    assert api["aprovacaoObs"] == "pode fazer"
    assert _linha(db, "select status from ordens where id=%s", (oid,))[0] == "aprovada"
    assert [(l["categoria"], float(l["valor"]), l["status"]) for l in _lancamentos(db, oid)] == [("pecas", 200.0, "pendente"), ("servicos", 80.0, "pendente")]
    assert _reservas(db, oid) == {item_id: 2.0}
    assert fake.storage.arquivos[f"{oid}/orcamento-v1.pdf"].startswith(b"%PDF")        # PDF refeito com a aprovação

    cur_link = dono.get(f"/orcamentos/{orc['id']}/link").json()["link"]
    assert cur_link["decisao"] == "aprovado" and cur_link["decisaoNome"] == "Maria Souza" and cur_link["decididoEm"]


def test_ip_da_decisao_fica_registrado(dono, db):
    _, _, link = _enviado_com_link(dono)
    _publico().post(_url(link["token"], "/aprovar"), {"nome": "Maria", "aceito": True}, format="json",
                    HTTP_X_FORWARDED_FOR="9.9.9.9, 203.0.113.7")
    assert _linha(db, "select decisao_ip from orcamento_links")[0] == "203.0.113.7"    # o que o proxy anotou


@pytest.mark.parametrize("corpo", [
    {}, {"aceito": True}, {"nome": "Maria"}, {"nome": "Maria", "aceito": False}, {"nome": "M", "aceito": True},
    {"nome": " ", "aceito": True}, {"nome": "x" * 121, "aceito": True}, {"nome": "Ma\x00ria", "aceito": True},
    {"nome": "Maria", "aceito": "sim"}, {"nome": "Maria", "aceito": True, "observacao": "x" * 501},
])
def test_aprovar_exige_nome_e_aceite(dono, db, corpo):
    oid, orc, link = _enviado_com_link(dono)
    r = _publico().post(_url(link["token"], "/aprovar"), corpo, format="json")
    assert r.status_code == 422, r.content
    assert dono.get(f"/orcamentos/{orc['id']}").json()["status"] == "enviado"
    assert _lancamentos(db, oid) == []


def test_aprovar_duas_vezes_nao_duplica(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    assert _aprova(_publico(), link["token"]).status_code == 200
    r = _aprova(_publico(), link["token"])
    assert r.status_code == 409 and r.json()["codigo"] == "status_invalido" and r.json()["status"] == "aprovado"
    assert len(_lancamentos(db, oid)) == 2


def test_aprovar_orcamento_vencido_409(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    db.cursor().execute("update orcamentos set validade_ate = '2026-10-01'")
    r = _aprova(_publico(), link["token"])
    assert r.status_code == 409 and r.json()["codigo"] == "vencido"
    assert _linha(db, "select status from orcamentos")[0] == "enviado" and _lancamentos(db, oid) == []


def test_aprovar_com_link_revogado_ou_expirado_410(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    dono.delete(f"/orcamentos/{orc['id']}/link")
    assert _aprova(_publico(), link["token"]).status_code == 410
    novo = _gerar(dono, orc["id"])
    db.cursor().execute("update orcamento_links set expira_em = '2026-10-01' where revogado_em is null")
    r = _aprova(_publico(), novo["token"])
    assert r.status_code == 410 and r.json()["codigo"] == "link_expirado"
    assert _linha(db, "select status from orcamentos")[0] == "enviado"


def test_o_banco_tambem_barra_link_revogado_mesmo_sem_o_filtro_do_python(dono, db):
    """Defesa em profundidade: a função SQL confere o link na mesma transação."""
    oid, orc, link = _enviado_com_link(dono)
    db.cursor().execute("update orcamento_links set revogado_em = now()")
    lid = lv.id_do_token(link["token"])
    cur = db.cursor()
    cur.execute("select orcamento_link_decidir(%s,'aprovar','[\"pendente_aprovacao\"]'::jsonb,'aprovada','2026-10-12','M','','1.1.1.1','x')::text", (str(lid),))
    assert json.loads(cur.fetchone()[0])["codigo"] == "link_revogado"
    assert _linha(db, "select status from orcamentos")[0] == "enviado"


def test_os_em_estado_que_nao_aceita_aprovacao_nao_vaza_o_status(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    _forca_os(db, oid, "finalizada")
    r = _aprova(_publico(), link["token"])
    assert r.status_code == 409 and r.json()["codigo"] == "os_status"
    assert "finalizada" not in r.content.decode()
    assert _linha(db, "select status from orcamentos")[0] == "enviado"


# ── recusar pelo link ────────────────────────────────────────────────────────

def test_cliente_recusa_pelo_link(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    r = _publico().post(_url(link["token"], "/recusar"), {"motivo": "Achei caro"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["orcamento"]["status"] == "recusado"
    api = dono.get(f"/orcamentos/{orc['id']}").json()
    assert api["status"] == "recusado" and api["motivoRecusa"] == "Achei caro"
    assert _linha(db, "select status from ordens where id=%s", (oid,))[0] == "recusada"
    link_oficina = dono.get(f"/orcamentos/{orc['id']}/link").json()["link"]
    assert link_oficina["decisao"] == "recusado"


def test_recusar_sem_motivo_vale(dono, db):
    _, _, link = _enviado_com_link(dono)
    assert _publico().post(_url(link["token"], "/recusar"), {}, format="json").status_code == 200


def test_link_nao_recusa_orcamento_ja_aprovado(dono, db):
    """A função SQL de recusar aceita 'aprovado' (a oficina pode voltar atrás); o cliente, pelo link, não."""
    oid, orc, link = _enviado_com_link(dono)
    assert _aprova(_publico(), link["token"]).status_code == 200
    r = _publico().post(_url(link["token"], "/recusar"), {"motivo": "mudei de ideia"}, format="json")
    assert r.status_code == 409 and r.json()["status"] == "aprovado"
    assert _linha(db, "select status from orcamentos")[0] == "aprovado"
    assert _linha(db, "select status from ordens where id=%s", (oid,))[0] == "aprovada"


def test_link_nao_recusa_se_a_oficina_ja_aprovou(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    _aprovar(dono, orc)
    assert _publico().post(_url(link["token"], "/recusar"), {}, format="json").status_code == 409


def test_recusar_valida_o_motivo(dono, db):
    _, _, link = _enviado_com_link(dono)
    assert _publico().post(_url(link["token"], "/recusar"), {"motivo": "x" * 501}, format="json").status_code == 422


# ── abuso ────────────────────────────────────────────────────────────────────

def test_token_invalido_em_excesso_vira_429_por_ip(dono, relogio, db):
    _, _, link = _enviado_com_link(dono)
    pub = _publico()
    codigos = [pub.get(_url(f"x{i}.y"), REMOTE_ADDR="7.7.7.7").status_code for i in range(22)]
    assert codigos[:20] == [404] * 20 and codigos[20:] == [429, 429]
    r = pub.get(_url(link["token"]), REMOTE_ADDR="7.7.7.7")          # esse IP ficou travado até pra link bom? só pro "inválido":
    assert r.status_code == 200                                      # ...não: o limite é só das tentativas inválidas
    assert pub.get(_url("x.y"), REMOTE_ADDR="8.8.8.8").status_code == 404       # outro IP segue normal
    relogio["t"] += 601
    assert pub.get(_url("x.y"), REMOTE_ADDR="7.7.7.7").status_code == 404       # a janela passou


def test_429_tem_retry_after_e_cabecalhos(dono, db):
    pub = _publico()
    for i in range(21):
        r = pub.get(_url(f"x{i}.y"), REMOTE_ADDR="7.7.7.7")
    assert r.status_code == 429 and r["Retry-After"] and r["Cache-Control"] == "no-store"


def test_decisoes_em_excesso_por_ip(dono, relogio, db):
    _, _, link = _enviado_com_link(dono)
    pub = _publico()
    assert _aprova(pub, link["token"], ip="5.5.5.5").status_code == 200
    codigos = [_aprova(pub, link["token"], ip="5.5.5.5").status_code for _ in range(10)]
    assert codigos[:9] == [409] * 9 and codigos[9] == 429
    relogio["t"] += 601
    assert _aprova(pub, link["token"], ip="5.5.5.5").status_code == 409


def test_decisoes_em_excesso_por_link_mesmo_trocando_de_ip(dono, db):
    _, _, link = _enviado_com_link(dono)
    pub = _publico()
    codigos = [_aprova(pub, link["token"], ip=f"10.0.0.{i}").status_code for i in range(22)]
    assert 429 in codigos and codigos.index(429) == 20


def test_forjar_x_forwarded_for_nao_burla_o_limite(dono, db):
    pub = _publico()
    codigos = [pub.get(_url(f"x{i}.y"), HTTP_X_FORWARDED_FOR=f"1.2.3.{i}, 203.0.113.9").status_code for i in range(22)]
    assert codigos[20:] == [429, 429]                       # conta pelo último item, que é o do proxy


def test_limite_geral_por_ip(dono, relogio, db):
    _, _, link = _enviado_com_link(dono)
    pub = _publico()
    codigos = [pub.get(_url(link["token"]), REMOTE_ADDR="6.6.6.6").status_code for _ in range(121)]
    assert codigos[:120] == [200] * 120 and codigos[120] == 429
    relogio["t"] += 61
    assert pub.get(_url(link["token"]), REMOTE_ADDR="6.6.6.6").status_code == 200


def test_corpo_ruim_nao_vira_500(dono, db):
    _, _, link = _enviado_com_link(dono)
    pub = _publico()
    assert pub.post(_url(link["token"], "/aprovar"), "texto solto", content_type="text/plain").status_code in (415, 422)
    assert pub.post(_url(link["token"], "/aprovar"), [1, 2], format="json").status_code == 422
    assert pub.post(_url(link["token"], "/recusar"), "[", content_type="application/json").status_code in (400, 422)


# ── script não rodado / erro do banco ────────────────────────────────────────

def test_tabela_ausente_oficina_503_com_instrucao_e_publico_generico(dono, fake, db):
    _, orc, link = _enviado_com_link(dono)
    fake.falhar_em[("select", "orcamento_links")] = "42P01"
    r = dono.get(f"/orcamentos/{orc['id']}/link")
    assert r.status_code == 503 and "orcamento_link.sql" in r.json()["detail"]
    p = _publico().get(_url(link["token"]))
    assert p.status_code == 503 and "sql" not in p.content.decode().lower() and "supabase" not in p.content.decode().lower()


def test_funcao_ausente_ao_gerar_503(dono, fake, db):
    orc = _enviado(dono, _os(dono))
    fake.falhar_em[("rpc", "orcamento_link_criar")] = "42883"
    r = dono.post(f"/orcamentos/{orc['id']}/link", format="json")
    assert r.status_code == 503 and "orcamento_link.sql" in r.json()["detail"]


def test_erro_inesperado_do_banco_no_publico_e_500_generico(dono, fake, db):
    _, _, link = _enviado_com_link(dono)
    fake.falhar_em[("select", "orcamento_links")] = "XX000"
    r = _publico().get(_url(link["token"]))
    assert r.status_code == 500 and r.json()["codigo"] == "erro"


def test_canal_link_e_aceito_so_pelo_banco_a_oficina_nao_pode_usar(dono, db):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    r = dono.post(f"/orcamentos/{orc['id']}/aprovar", {"canal": "link"}, format="json")
    assert r.status_code == 422                                  # o "Aprovar" da oficina continua sem o canal 'link'


# ── alertas: link aberto e resposta do cliente ───────────────────────────────

def _alertas(api):
    r = api.get("/alertas")
    assert r.status_code == 200, r.content
    return r.json()


def _enviado_ha(db, dias):
    db.cursor().execute("update orcamentos set enviado_em = %s", (HOJE - timedelta(days=dias),))


def test_orcamento_sem_resposta_diz_se_o_link_foi_aberto(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    _enviado_ha(db, 3)
    item = _alertas(dono)["orcamentosSemResposta"][0]
    assert item["linkEnviado"] is True and item["linkAcessos"] == 0 and "linkAbertoEm" not in item
    _publico().get(_url(link["token"]))
    item = _alertas(dono)["orcamentosSemResposta"][0]
    assert item["linkAcessos"] == 1 and item["linkAbertoEm"]


def test_orcamento_sem_link_nao_tem_os_campos_do_link(dono, db):
    oid = _os(dono)
    _enviado(dono, oid)
    _enviado_ha(db, 3)
    item = _alertas(dono)["orcamentosSemResposta"][0]
    assert "linkEnviado" not in item


def test_link_revogado_nao_conta_como_enviado(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    dono.delete(f"/orcamentos/{orc['id']}/link")
    _enviado_ha(db, 3)
    assert "linkEnviado" not in _alertas(dono)["orcamentosSemResposta"][0]


def test_resposta_do_cliente_vira_alerta_e_some_quando_a_os_segue(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    assert _alertas(dono)["respostasDoCliente"] == []
    _aprova(_publico(), link["token"])
    r = _alertas(dono)["respostasDoCliente"]
    assert len(r) == 1 and r[0]["decisao"] == "aprovado" and r[0]["decisaoNome"] == "Maria Souza"
    assert r[0]["ordemId"] == oid and r[0]["osNum"] == "OS-1" and r[0]["total"] == 180
    _forca_os(db, oid, "em_execucao")                                   # o trabalho começou: não é mais novidade
    assert _alertas(dono)["respostasDoCliente"] == []


def test_recusa_do_cliente_vira_alerta_com_motivo(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    _publico().post(_url(link["token"], "/recusar"), {"motivo": "Achei caro"}, format="json")
    r = _alertas(dono)["respostasDoCliente"]
    assert len(r) == 1 and r[0]["decisao"] == "recusado" and r[0]["motivo"] == "Achei caro"


def test_resposta_antiga_nao_alerta(dono, hoje, db):
    oid, orc, link = _enviado_com_link(dono)
    _aprova(_publico(), link["token"])
    db.cursor().execute("update orcamento_links set decidido_em = %s", (HOJE - timedelta(days=4),))
    assert _alertas(dono)["respostasDoCliente"] == []


def test_aprovacao_feita_pela_oficina_nao_gera_aviso_de_resposta_do_cliente(dono, db):
    oid, orc, link = _enviado_com_link(dono)
    _aprovar(dono, orc)
    assert _alertas(dono)["respostasDoCliente"] == []


def test_alertas_sem_o_script_do_link_avisa_e_nao_quebra(dono, fake, db):
    _enviado_com_link(dono)
    fake.falhar_em[("select", "orcamento_links")] = "42P01"
    corpo = _alertas(dono)
    assert corpo["respostasDoCliente"] == [] and "orcamento_link" in corpo["indisponiveis"]
    assert "orcamentosSemResposta" in corpo
