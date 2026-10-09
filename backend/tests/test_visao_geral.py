"""Testes da Visão Geral (GET /visao-geral, PUT /visao-geral/meta) — Postgres real."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import django
import pytest

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import relatorios_views, views, visao_geral_views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _entrada, _ordem  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
HOJE = date(2026, 10, 9)   # sexta-feira


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    monkeypatch.setattr(visao_geral_views, "_agora", lambda tz: datetime(2026, 10, 9, 15, 0, tzinfo=SP).astimezone(tz))
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


def _get(api, **params):
    return api.get("/visao-geral", params)


# ── períodos ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("hoje,mes,anterior", [
    (date(2026, 10, 9), (date(2026, 10, 1), date(2026, 10, 9)), (date(2026, 9, 1), date(2026, 9, 9))),
    (date(2026, 3, 31), (date(2026, 3, 1), date(2026, 3, 31)), (date(2026, 2, 1), date(2026, 2, 28))),   # fev tem 28
    (date(2026, 1, 1), (date(2026, 1, 1), date(2026, 1, 1)), (date(2025, 12, 1), date(2025, 12, 1))),   # vira o ano
    (date(2028, 3, 30), (date(2028, 3, 1), date(2028, 3, 30)), (date(2028, 2, 1), date(2028, 2, 29))),   # bissexto
])
def test_periodos_comparam_o_mesmo_trecho_do_mes_anterior(hoje, mes, anterior):
    assert visao_geral_views._periodos(hoje) == (mes, anterior)


# ── acesso e permissões ───────────────────────────────────────────────────────

def test_sem_token_401(fake):
    assert APIClient().get("/visao-geral").status_code == 401


@pytest.mark.parametrize("cargo", ["dono", "gerente", "mecanico", "atendente"])
def test_todos_os_cargos_acessam(fake, cargo):
    assert _get(_cliente(cargo)).status_code == 200


def _com_dados(db):
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor"])
    _entrada(db, 1000, "2026-10-05")
    _entrada(db, 300, "2026-10-06", tipo="saida")


@pytest.mark.parametrize("cargo", ["mecanico", "atendente"])
def test_quem_nao_ve_dinheiro_nao_recebe_nenhum_bloco_de_dinheiro(fake, db, cargo):
    _com_dados(db)
    corpo = _get(_cliente(cargo)).json()
    assert "faturamento" not in corpo and "meta" not in corpo and "financeiro" not in corpo
    assert all(set(d) == {"dia", "ordens"} for d in corpo["serie"])
    assert all("valorEstimado" not in s for s in corpo["servicos"])
    assert corpo["ordens"]["atual"] == 1                      # o resto continua
    assert corpo["servicos"][0]["nome"] == "Motor"
    assert "1000" not in str(corpo) and "300" not in str(corpo)


def test_gerente_ve_dinheiro_mas_nao_o_lucro(fake, db):
    _com_dados(db)
    corpo = _get(_cliente("gerente")).json()
    assert corpo["faturamento"]["atual"] == 1000
    assert corpo["financeiro"] == {"receitas": 1000.0, "despesas": 300.0, "temLancamentos": True}


def test_dono_ve_o_lucro(fake, db):
    _com_dados(db)
    f = _get(_cliente("dono")).json()["financeiro"]
    assert f["lucro"] == 700.0 and "lucroAnterior" not in f   # sem lançamentos no mês anterior


def test_tz_invalido_422(api):
    assert _get(api, tz="Marte/Olympus").status_code == 422


# ── ordens, série e serviços ──────────────────────────────────────────────────

def test_oficina_vazia(api):
    corpo = _get(api).json()
    assert corpo["hoje"] == "2026-10-09"
    assert corpo["periodo"] == {"de": "2026-10-01", "ate": "2026-10-09", "deAnterior": "2026-09-01",
                                "ateAnterior": "2026-09-09", "tz": "America/Sao_Paulo"}
    assert corpo["ordens"] == {"atual": 0, "anterior": None}
    assert corpo["servicos"] == []
    assert corpo["faturamento"] == {"atual": 0, "anterior": None, "origem": "estimado"}
    assert corpo["financeiro"] == {"receitas": 0, "despesas": 0, "temLancamentos": False, "lucro": 0}
    assert corpo["meta"] == {"valor": None, "editavel": True}


def test_ordens_do_mes_contam_todas_e_comparam_o_mesmo_trecho(api, db):
    _ordem(db, "2026-10-02T10:00:00-03:00", status="rascunho")
    _ordem(db, "2026-10-03T10:00:00-03:00")
    _ordem(db, "2026-09-05T10:00:00-03:00")          # dentro de 1–9/set
    _ordem(db, "2026-09-20T10:00:00-03:00")          # depois do dia 9: NÃO entra na comparação
    corpo = _get(api).json()
    assert corpo["ordens"] == {"atual": 2, "anterior": 1}


def test_serie_e_densa_de_31_dias_terminando_hoje(api, db):
    _ordem(db, "2026-10-09T08:00:00-03:00", servicos=["Motor"])
    _ordem(db, "2026-10-09T09:00:00-03:00", status="rascunho")
    _ordem(db, "2026-09-09T08:00:00-03:00", servicos=["Freios"])      # primeiro dia da série (31 dias: 09/09–09/10)
    _ordem(db, "2026-09-08T23:00:00-03:00")                           # um dia antes: fora da série
    serie = _get(api).json()["serie"]
    assert len(serie) == 31
    assert serie[0]["dia"] == "2026-09-09" and serie[-1]["dia"] == "2026-10-09"
    assert serie[-1] == {"dia": "2026-10-09", "ordens": 2, "faturamento": 800.0}
    assert serie[0] == {"dia": "2026-09-09", "ordens": 1, "faturamento": 320.0}
    assert serie[5] == {"dia": "2026-09-14", "ordens": 0, "faturamento": 0.0}


def test_servicos_so_finalizadas_e_so_dos_ultimos_30_dias_com_dia_da_semana(api, db):
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor", "Freios"])       # segunda
    _ordem(db, "2026-10-07T10:00:00-03:00", servicos=["Freios"])                # quarta
    _ordem(db, "2026-10-04T10:00:00-03:00", servicos=["Freios"])                # domingo
    _ordem(db, "2026-10-06T10:00:00-03:00", status="rascunho", servicos=["Pneus"])   # não finalizada
    _ordem(db, "2026-09-09T10:00:00-03:00", servicos=["Pneus"])                 # 31 dias atrás: fora dos 30 dos serviços
    _ordem(db, "2026-10-08T10:00:00-03:00", servicos=["Algo novo"])
    corpo = _get(api).json()
    por_nome = {s["nome"]: s for s in corpo["servicos"]}
    assert set(por_nome) == {"Motor", "Freios", "Algo novo"}
    assert por_nome["Freios"]["quantidade"] == 3
    assert por_nome["Freios"]["semana"] == [1, 0, 1, 0, 0, 0, 1]     # seg, qua, dom
    assert por_nome["Freios"]["valorEstimado"] == 960.0              # 3 × 320
    assert por_nome["Motor"]["valorEstimado"] == 800.0
    assert por_nome["Algo novo"]["valorEstimado"] == 200.0           # fora da tabela
    assert [s["nome"] for s in corpo["servicos"]] == ["Freios", "Motor", "Algo novo"]   # por valor


def test_servicos_limitados_a_10(api, db):
    for i in range(12):
        _ordem(db, "2026-10-05T10:00:00-03:00", servicos=[f"Serv {i:02d}"])
    assert len(_get(api).json()["servicos"]) == 10


def test_payload_em_string_json_e_lido(api, db):
    # O bug original: payload é text no banco e chegava como string.
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor"])
    assert _get(api).json()["servicos"][0]["nome"] == "Motor"


def test_dia_depende_do_fuso(fake, api, db):
    _ordem(db, "2026-10-10T01:30:00+00:00")        # 09/10 22:30 em São Paulo; 10/10 em UTC
    sp = _get(api).json()
    assert sp["serie"][-1]["ordens"] == 1
    utc = _get(api, tz="UTC").json()
    assert utc["hoje"] == "2026-10-09" and utc["serie"][-1]["ordens"] == 0   # amanhã de UTC: fora da janela


def test_isolamento_entre_oficinas(fake, db):
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor"], oficina=OFICINA_A)
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor"], oficina=OFICINA_B)
    _entrada(db, 500, "2026-10-05", oficina=OFICINA_B)
    a = _get(_cliente(oficina=OFICINA_A)).json()
    assert a["ordens"]["atual"] == 1 and a["faturamento"]["origem"] == "estimado"
    assert a["financeiro"]["temLancamentos"] is False


# ── faturamento ───────────────────────────────────────────────────────────────

def test_faturamento_estimado_e_comparativo(api, db):
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor"])          # 800
    _ordem(db, "2026-10-06T10:00:00-03:00", status="rascunho")           # não fatura
    _ordem(db, "2026-09-05T10:00:00-03:00", servicos=["Freios"])         # anterior: 320
    f = _get(api).json()["faturamento"]
    assert f == {"atual": 800.0, "anterior": 320.0, "origem": "estimado"}


def test_faturamento_vem_do_financeiro_quando_ha_entradas(api, db):
    _ordem(db, "2026-10-05T10:00:00-03:00", servicos=["Motor"])
    _ordem(db, "2026-09-05T10:00:00-03:00", servicos=["Freios"])
    _entrada(db, 1000, "2026-10-05")
    _entrada(db, 250.5, "2026-10-08", status="pendente")
    _entrada(db, 999, "2026-10-08", status="cancelado")
    _entrada(db, 400, "2026-09-03")
    _entrada(db, 700, "2026-09-20")                 # depois do dia 9: fora da comparação
    corpo = _get(api).json()
    assert corpo["faturamento"] == {"atual": 1250.5, "anterior": 400.0, "origem": "financeiro"}
    assert corpo["serie"][-2]["faturamento"] == 250.5       # 08/10
    # estimativa por serviço continua só como estimativa na lista de serviços
    assert corpo["servicos"][0]["valorEstimado"] == 800.0


def test_anterior_nulo_quando_nao_ha_os_no_periodo_anterior(api, db):
    _ordem(db, "2026-10-05T10:00:00-03:00")
    _entrada(db, 100, "2026-09-03")                 # há entrada, mas nenhuma OS: nada a comparar
    corpo = _get(api).json()
    assert corpo["ordens"]["anterior"] is None and corpo["faturamento"]["anterior"] is None


# ── resumo financeiro ─────────────────────────────────────────────────────────

def test_resumo_financeiro_com_variacao_do_lucro(api, db):
    _entrada(db, 2000, "2026-10-02")
    _entrada(db, 500, "2026-10-03", status="cancelado")                  # cancelada: fora
    _entrada(db, 300, "2026-10-04", status="pendente")                   # pendente conta (competência)
    _entrada(db, 5000, "2026-10-04", oficina=OFICINA_B)                  # outra oficina
    _entrada(db, 800, "2026-10-05", tipo="saida")
    _entrada(db, 1000, "2026-09-02")                                     # anterior
    _entrada(db, 400, "2026-09-04", tipo="saida")
    _entrada(db, 9999, "2026-09-25")                                     # depois do dia 9: fora
    f = _get(api).json()["financeiro"]
    assert f == {"receitas": 2300.0, "despesas": 800.0, "temLancamentos": True,
                 "lucro": 1500.0, "lucroAnterior": 600.0, "lucroVariacaoPercentual": 150.0}


def test_variacao_negativa_e_lucro_anterior_negativo(api, db):
    _entrada(db, 100, "2026-10-02")
    _entrada(db, 1000, "2026-09-02", tipo="saida")      # anterior: -1000
    f = _get(api).json()["financeiro"]
    assert f["lucro"] == 100.0 and f["lucroAnterior"] == -1000.0
    assert f["lucroVariacaoPercentual"] == 110.0         # (100 − (−1000)) / |−1000|


def test_variacao_omitida_quando_lucro_anterior_zero(api, db):
    _entrada(db, 100, "2026-10-02")
    _entrada(db, 500, "2026-09-02")
    _entrada(db, 500, "2026-09-03", tipo="saida")        # anterior: 0
    f = _get(api).json()["financeiro"]
    assert f["lucroAnterior"] == 0.0 and "lucroVariacaoPercentual" not in f


# ── meta mensal ───────────────────────────────────────────────────────────────

def test_definir_e_remover_meta(api, db):
    assert api.put("/visao-geral/meta", {"valor": 20000}, format="json").json() == {"valor": 20000.0}
    assert _get(api).json()["meta"] == {"valor": 20000.0, "editavel": True}
    assert api.put("/visao-geral/meta", {"valor": 1234.567}, format="json").json() == {"valor": 1234.57}
    assert api.put("/visao-geral/meta", {"valor": None}, format="json").status_code == 200
    assert _get(api).json()["meta"]["valor"] is None


def test_meta_e_por_oficina(fake):
    _cliente(oficina=OFICINA_A).put("/visao-geral/meta", {"valor": 111}, format="json")
    assert _get(_cliente(oficina=OFICINA_B)).json()["meta"]["valor"] is None


@pytest.mark.parametrize("corpo", [{"valor": -1}, {"valor": "abc"}, {"valor": 1e12}, {}, {"valor": "NaN"}, {"valor": "Infinity"}])
def test_meta_invalida_422(api, corpo):
    import json
    r = api.put("/visao-geral/meta", data=json.dumps(corpo), content_type="application/json")
    assert r.status_code == 422, r.content


def test_meta_nan_cru_no_json_e_recusado_pelo_parser(api):
    r = api.put("/visao-geral/meta", data='{"valor": NaN}', content_type="application/json")
    assert r.status_code == 400


@pytest.mark.parametrize("cargo,esperado", [("dono", 200), ("gerente", 200), ("mecanico", 403), ("atendente", 403)])
def test_meta_permissao(fake, cargo, esperado):
    assert _cliente(cargo).put("/visao-geral/meta", {"valor": 10}, format="json").status_code == esperado


def test_meta_nao_editavel_para_quem_nao_tem_configuracoes_editar(fake):
    c = APIClient()
    token = make_jwt({"tipo": "funcionario", "nome": "X", "oficina_doc": OFICINA_A,
                      "permissoes": ["relatorios.ver", "financeiro.ver"]}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert _get(c).json()["meta"]["editavel"] is False


def test_sem_a_coluna_da_meta_a_tela_continua(api, fake):
    fake.falhar_em[("select", "admins")] = "42703"
    corpo = _get(api)
    assert corpo.status_code == 200 and corpo.json()["meta"] == {"valor": None, "editavel": False}
    fake.falhar_em.clear()
    fake.falhar_em[("update", "admins")] = "42703"
    r = api.put("/visao-geral/meta", {"valor": 10}, format="json")
    assert r.status_code == 503 and "visao_geral.sql" in r.json()["detail"]


# ── erros do banco ────────────────────────────────────────────────────────────

def test_coluna_oficina_ausente_em_ordens_vira_503(api, fake):
    fake.falhar_em[("select", "ordens")] = "42703"
    r = _get(api)
    assert r.status_code == 503 and "ordens_oficina.sql" in r.json()["detail"]


def test_permissao_negada_no_banco(api, fake):
    fake.falhar_em[("select", "ordens")] = "42501"
    r = _get(api)
    assert r.status_code == 500 and "supabase.env" in r.json()["detail"]
