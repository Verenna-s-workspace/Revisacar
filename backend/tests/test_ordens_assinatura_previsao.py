"""Assinatura do cliente na Entrada (`payload.assinaturas.entrada`) e previsão de entrega (`os_header`).

Cobre o ciclo completo que já falhou antes (o backend descartava campos da OS ao salvar):
front envia → serializer aceita → grava → devolve → front lê. E as regras:
quando/por carimbados no servidor, imagem reencodada e nunca em branco, adiada sem imagem,
salvar sem o campo não apaga a assinatura, e uma oficina não enxerga a OS da outra.
"""
import base64
import io
import json

import django
import pytest

django.setup()

from orders import assinaturas_os, relatorios_views, views, visao_geral_views  # noqa: E402

from .conftest import OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _corpo_ordem  # noqa: E402

AGORA = "2026-11-24T10:00:00-03:00"


def _png(tracos=True, largura=300, altura=100) -> str:
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
    if tracos:
        ImageDraw.Draw(img).line([(10, 80), (80, 20), (150, 70), (280, 30)], fill=(17, 17, 17, 255), width=4)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _entrada(status="assinada", imagem=None, quem="Maria"):
    e = {"status": status, "quem": quem}
    if status == "assinada":
        e["imagem"] = imagem if imagem is not None else _png()
    return {"entrada": e}


def _corpo(**extra):
    return {**_corpo_ordem(), "status": "rascunho", **extra}


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente("dono")


def _payload(resp):
    p = resp.json()["payload"]
    return json.loads(p) if isinstance(p, str) else p


def _cria(api, **extra):
    r = api.post("/ordens", _corpo(**extra), format="json")
    assert r.status_code == 201, r.content
    return r.json()["id"], _payload(r)


def _le(api, oid):
    r = api.get(f"/ordens/{oid}")
    assert r.status_code == 200, r.content
    return _payload(r)


# ── lógica pura (sem banco) ───────────────────────────────────────────────────

def test_aplicar_carimba_quando_e_por_no_servidor():
    r = assinaturas_os.aplicar(_entrada(), None, por_nome="Carlos", agora=AGORA)
    e = r["entrada"]
    assert (e["status"], e["quem"], e["quando"], e["por"]) == ("assinada", "Maria", AGORA, "Carlos")


def test_aplicar_nao_reassina_quando_nada_mudou():
    img = _png()
    primeira = assinaturas_os.aplicar(_entrada(imagem=img), None, por_nome="Carlos", agora=AGORA)
    de_novo = assinaturas_os.aplicar(_entrada(imagem=img), primeira, por_nome="Outro", agora="2026-11-25T00:00:00-03:00")
    assert de_novo["entrada"]["quando"] == AGORA and de_novo["entrada"]["por"] == "Carlos"


def test_aplicar_adiada_nao_guarda_imagem_e_assinar_depois_carimba_de_novo():
    adiada = assinaturas_os.aplicar(_entrada("adiada"), None, por_nome="Carlos", agora=AGORA)
    assert adiada["entrada"]["status"] == "adiada" and adiada["entrada"]["imagem"] == ""
    depois = assinaturas_os.aplicar(_entrada(), adiada, por_nome="Ana", agora="2026-11-25T09:00:00-03:00")
    assert depois["entrada"]["status"] == "assinada"
    assert depois["entrada"]["por"] == "Ana" and depois["entrada"]["quando"].startswith("2026-11-25")


def test_aplicar_sem_o_campo_preserva_o_gravado_e_outras_fases():
    gravado = {"entrada": {"status": "assinada", "imagem": "x", "quem": "M", "quando": AGORA, "por": "C"},
               "aprovacao": {"status": "assinada"}}
    assert assinaturas_os.aplicar(None, gravado, por_nome="C", agora=AGORA) == gravado
    # trocar só a entrada não derruba as chaves das outras fases
    novo = assinaturas_os.aplicar(_entrada("adiada"), gravado, por_nome="C", agora=AGORA)
    assert novo["aprovacao"] == {"status": "assinada"} and novo["entrada"]["status"] == "adiada"


def test_aplicar_sem_nada_antes_nem_agora_devolve_none():
    assert assinaturas_os.aplicar(None, None, por_nome="C", agora=AGORA) is None


def test_estado_entrada_de_linha_antiga_e_pendente():
    assert assinaturas_os.estado_entrada(None) == "pendente"
    assert assinaturas_os.estado_entrada({}) == "pendente"
    assert assinaturas_os.estado_entrada({"entrada": {"status": "lixo"}}) == "pendente"
    assert assinaturas_os.estado_entrada({"entrada": {"status": "adiada"}}) == "adiada"


# ── ciclo completo pela API: assinatura ───────────────────────────────────────

def test_assinatura_assinada_volta_no_get_com_carimbo_do_servidor(api):
    oid, _ = _cria(api, assinaturas=_entrada())
    e = _le(api, oid)["assinaturas"]["entrada"]
    assert e["status"] == "assinada" and e["quem"] == "Maria"
    assert e["imagem"].startswith("data:image/png;base64,")
    assert e["por"] == "dono" and e["quando"]


def test_navegador_nao_escolhe_quando_nem_por(api):
    corpo = _entrada()
    corpo["entrada"].update({"quando": "1999-01-01T00:00:00Z", "por": "Fulano Falso"})
    oid, _ = _cria(api, assinaturas=corpo)
    e = _le(api, oid)["assinaturas"]["entrada"]
    assert e["por"] == "dono" and not e["quando"].startswith("1999")


def test_salvar_sem_o_campo_nao_apaga_a_assinatura(api):
    oid, _ = _cria(api, assinaturas=_entrada())
    antes = _le(api, oid)["assinaturas"]["entrada"]
    r = api.put(f"/ordens/{oid}", _corpo(), format="json")      # outra tela salvando a OS sem o estado
    assert r.status_code == 200, r.content
    assert _le(api, oid)["assinaturas"]["entrada"] == antes


def test_adiada_fica_como_pendencia_e_pode_ser_concluida_ao_reabrir(api):
    oid, _ = _cria(api, assinaturas=_entrada("adiada"))
    e = _le(api, oid)["assinaturas"]["entrada"]
    assert e["status"] == "adiada" and e["imagem"] == ""
    r = api.put(f"/ordens/{oid}", _corpo(assinaturas=_entrada()), format="json")
    assert r.status_code == 200, r.content
    assert _le(api, oid)["assinaturas"]["entrada"]["status"] == "assinada"


def test_resalvar_igual_nao_muda_o_carimbo(api):
    img = _png()
    oid, _ = _cria(api, assinaturas=_entrada(imagem=img))
    antes = _le(api, oid)["assinaturas"]["entrada"]
    assert api.put(f"/ordens/{oid}", _corpo(assinaturas=_entrada(imagem=img)), format="json").status_code == 200
    assert _le(api, oid)["assinaturas"]["entrada"]["quando"] == antes["quando"]


def test_assinada_exige_imagem_valida_e_com_traco(api):
    for imagem in ("", "data:image/jpeg;base64,AAAA", "nao-e-imagem", _png(tracos=False)):
        corpo = _corpo(assinaturas={"entrada": {"status": "assinada", "imagem": imagem, "quem": "Maria"}})
        assert api.post("/ordens", corpo, format="json").status_code == 422, imagem[:30]


def test_status_invalido_e_rejeitado(api):
    corpo = _corpo(assinaturas={"entrada": {"status": "talvez"}})
    assert api.post("/ordens", corpo, format="json").status_code == 422


def test_ordem_antiga_sem_assinaturas_continua_abrindo(api):
    oid, payload = _cria(api)
    assert "assinaturas" not in payload
    assert assinaturas_os.estado_entrada(_le(api, oid).get("assinaturas")) == "pendente"


def test_outra_oficina_nao_enxerga_nem_altera_a_assinatura(api):
    oid, _ = _cria(api, assinaturas=_entrada())
    b = _cliente("dono", OFICINA_B)
    assert b.get(f"/ordens/{oid}").status_code == 404
    assert b.put(f"/ordens/{oid}", _corpo(assinaturas=_entrada("adiada")), format="json").status_code == 404
    assert _le(api, oid)["assinaturas"]["entrada"]["status"] == "assinada"


# ── ciclo completo pela API: previsão de entrega ──────────────────────────────

def _com_previsao(data="2099-01-02", hora="17:00", **header):
    c = _corpo()
    c["os_header"] = {"os_num": "OS-1", "os_date": "2026-11-24", "previsao_entrega": data, "previsao_hora": hora, **header}
    return c


def test_previsao_de_entrega_e_gravada_e_devolvida(api):
    r = api.post("/ordens", _com_previsao(), format="json")
    assert r.status_code == 201, r.content
    h = _le(api, r.json()["id"])["os_header"]
    assert (h["previsao_entrega"], h["previsao_hora"]) == ("2099-01-02", "17:00")


def test_previsao_sobrevive_a_um_novo_salvamento(api):
    oid = api.post("/ordens", _com_previsao(), format="json").json()["id"]
    assert api.put(f"/ordens/{oid}", _com_previsao(data="2099-01-05", hora=""), format="json").status_code == 200
    h = _le(api, oid)["os_header"]
    assert (h["previsao_entrega"], h["previsao_hora"]) == ("2099-01-05", "")


def test_previsao_vazia_e_opcional(api):
    oid, payload = _cria(api)
    assert payload["os_header"].get("previsao_entrega", "") == ""
    assert _le(api, oid)["os_header"].get("previsao_entrega", "") == ""


@pytest.mark.parametrize("data,hora", [
    ("2026-11-23", ""),        # anterior à entrada (2026-11-24)
    ("2099-02-31", ""),        # data que não existe
    ("amanhã", ""),
    ("2099-01-02", "25:99"),   # hora inválida
    ("", "17:00"),             # hora sem data
])
def test_previsao_invalida_e_rejeitada(api, data, hora):
    assert api.post("/ordens", _com_previsao(data=data, hora=hora), format="json").status_code == 422
