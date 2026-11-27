"""Previsão de entrega (`os_header.previsao_entrega` / `previsao_hora`).

Cobre o ciclo completo que já falhou antes (o backend descartava campos da OS ao salvar, porque o payload
gravado é `serializer.data` e só carrega campos declarados): front envia → serializer aceita → grava →
devolve → front lê. E as regras: opcional, data real e não anterior à entrada, hora exige data.
"""
import json

import django
import pytest

django.setup()

from orders import relatorios_views, views, visao_geral_views  # noqa: E402

from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _corpo_ordem  # noqa: E402


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


def _le(api, oid):
    r = api.get(f"/ordens/{oid}")
    assert r.status_code == 200, r.content
    return _payload(r)


def _corpo(data="2099-01-02", hora="17:00"):
    c = {**_corpo_ordem(), "status": "rascunho"}
    c["os_header"] = {"os_num": "OS-1", "os_date": "2026-11-24", "previsao_entrega": data, "previsao_hora": hora}
    return c


def test_previsao_de_entrega_e_gravada_e_devolvida(api):
    r = api.post("/ordens", _corpo(), format="json")
    assert r.status_code == 201, r.content
    h = _le(api, r.json()["id"])["os_header"]
    assert (h["previsao_entrega"], h["previsao_hora"]) == ("2099-01-02", "17:00")


def test_previsao_sobrevive_a_um_novo_salvamento(api):
    oid = api.post("/ordens", _corpo(), format="json").json()["id"]
    assert api.put(f"/ordens/{oid}", _corpo(data="2099-01-05", hora=""), format="json").status_code == 200
    h = _le(api, oid)["os_header"]
    assert (h["previsao_entrega"], h["previsao_hora"]) == ("2099-01-05", "")


def test_previsao_vazia_e_opcional(api):
    r = api.post("/ordens", {**_corpo_ordem(), "status": "rascunho"}, format="json")
    assert r.status_code == 201, r.content
    assert not _le(api, r.json()["id"])["os_header"].get("previsao_entrega")


@pytest.mark.parametrize("data,hora", [
    ("2026-11-23", ""),        # anterior à entrada (2026-11-24)
    ("2099-02-31", ""),        # data que não existe
    ("amanhã", ""),
    ("2099-01-02", "25:99"),   # hora inválida
    ("", "17:00"),             # hora sem data
])
def test_previsao_invalida_e_rejeitada(api, data, hora):
    assert api.post("/ordens", _corpo(data=data, hora=hora), format="json").status_code == 422
