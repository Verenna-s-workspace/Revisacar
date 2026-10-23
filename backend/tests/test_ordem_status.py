"""Status da OS: vocabulário, transições e o que o salvamento do checklist pode (ou não) mudar."""
import json
from datetime import date, timedelta

import django
import psycopg2
import pytest

django.setup()

from orders import ordem_status as st  # noqa: E402
from orders import relatorios_views, views, visao_geral_views  # noqa: E402

from .conftest import BACKEND_DIR, OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _corpo_ordem, _ordem  # noqa: E402


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente()


def _status(db, oid):
    cur = db.cursor()
    cur.execute("select status, payload from ordens where id=%s", (oid,))
    return cur.fetchone()


def _cria(api, status="rascunho", **kw):
    r = api.post("/ordens", {**_corpo_ordem(**kw), "status": status}, format="json")
    assert r.status_code == 201, r.content
    return r.json()["id"]


def _forca(db, oid, status):
    db.cursor().execute("update ordens set status=%s where id=%s", (status, oid))


# ── vocabulário e transições ─────────────────────────────────────────────────

def test_toda_transicao_aponta_para_status_conhecido():
    assert set(st.TRANSICOES) == set(st.TODOS)
    for origem, destinos in st.TRANSICOES.items():
        assert destinos <= set(st.TODOS) and origem not in destinos


def test_concluida_e_terminal_e_nada_pula_o_orcamento():
    assert st.TRANSICOES[st.FINALIZADA] == set()
    for pre in (st.RASCUNHO, st.EM_ORCAMENTO):
        assert st.FINALIZADA not in st.TRANSICOES[pre] and st.EM_EXECUCAO not in st.TRANSICOES[pre]


# ── salvar o checklist (POST/PUT /ordens) ────────────────────────────────────

@pytest.mark.parametrize("enviado,esperado", [
    ("rascunho", "rascunho"),
    ("em_orcamento", "em_orcamento"),
    ("finalizada", "rascunho"),        # app desatualizado: não conclui sozinho
    ("aprovada", "rascunho"),
    ("qualquer-coisa", "rascunho"),
])
def test_ordem_nova_so_nasce_em_fase_de_checklist(api, db, enviado, esperado):
    oid = _cria(api, enviado)
    status, payload = _status(db, oid)
    assert status == esperado and json.loads(payload)["status"] == esperado


def test_sem_status_no_corpo_nasce_rascunho(api, db):
    corpo = _corpo_ordem()
    corpo.pop("status")
    oid = api.post("/ordens", corpo, format="json").json()["id"]
    assert _status(db, oid)[0] == "rascunho"


def _resolve_fotos_obrigatorias(db, oid):
    """Dá por resolvidos os 5 itens de foto da entrada (pulados), direto no banco."""
    cur = db.cursor()
    for slot in ("hodometro", "frente", "traseira", "lateral_direita", "lateral_esquerda"):
        cur.execute(
            "insert into ordem_fotos (oficina_doc, ordem_id, slot, situacao, motivo, por_nome, por_tipo) "
            "values (%s, %s, %s, 'pulada', 'carro trancado', 'dono', 'dono')",
            (OFICINA_A, oid, slot),
        )


def test_checklist_completo_sobe_para_em_orcamento_e_volta_se_ficar_incompleto(api, db):
    oid = _cria(api, "rascunho")
    _resolve_fotos_obrigatorias(db, oid)      # sem as 5 fotos a OS ficaria em rascunho (test_fotos_obrigatorias)
    put = lambda s: api.put(f"/ordens/{oid}", {**_corpo_ordem(), "status": s}, format="json")
    assert put("em_orcamento").status_code == 200 and _status(db, oid)[0] == "em_orcamento"
    assert put("rascunho").status_code == 200 and _status(db, oid)[0] == "rascunho"


@pytest.mark.parametrize("fase", ["pendente_aprovacao", "aprovada", "em_execucao", "aguardando", "finalizada", "recusada"])
def test_salvar_checklist_nao_mexe_em_fase_posterior(api, db, fase):
    oid = _cria(api)
    _forca(db, oid, fase)
    for enviado in ("rascunho", "em_orcamento", "finalizada"):
        r = api.put(f"/ordens/{oid}", {**_corpo_ordem(num="OS-editada"), "status": enviado}, format="json")
        assert r.status_code == 200
        status, payload = _status(db, oid)
        assert status == fase and json.loads(payload)["status"] == fase
    cur = db.cursor()
    cur.execute("select os_num from ordens where id=%s", (oid,))
    assert cur.fetchone() == ("OS-editada",)           # o resto do checklist foi salvo normalmente


def test_linha_antiga_com_status_fora_do_padrao_e_normalizada_ao_salvar(api, db):
    oid = _cria(api)
    db.cursor().execute("alter table ordens drop constraint ordens_status_check")
    try:
        _forca(db, oid, "concluido")
        assert api.put(f"/ordens/{oid}", {**_corpo_ordem(), "status": "em_orcamento"}, format="json").status_code == 200
        assert _status(db, oid)[0] == "em_orcamento"
    finally:
        db.cursor().execute("alter table ordens add constraint ordens_status_check check (status in "
                            "('rascunho','em_orcamento','pendente_aprovacao','aprovada','em_execucao',"
                            "'aguardando','finalizada','recusada')) not valid")


def test_put_de_ordem_inexistente_ou_de_outra_oficina_404(api, db):
    assert api.put("/ordens/nao-existe", _corpo_ordem(), format="json").status_code == 404
    oid = _ordem(db, "2026-10-05T12:00:00-03:00", oficina=OFICINA_B)
    assert api.put(f"/ordens/{oid}", _corpo_ordem(), format="json").status_code == 404


# ── PATCH /ordens/<id>/status ────────────────────────────────────────────────

def _muda(api, oid, novo):
    return api.patch(f"/ordens/{oid}/status", {"status": novo}, format="json")


def test_fluxo_completo_ate_concluir(api, db):
    oid = _cria(api, "em_orcamento")
    for novo in ("pendente_aprovacao", "aprovada", "em_execucao", "aguardando", "em_execucao", "finalizada"):
        r = _muda(api, oid, novo)
        assert r.status_code == 200, (novo, r.content)
        assert r.json()["status"] == novo and _status(db, oid)[0] == novo


def test_recusa_e_reabertura(api, db):
    oid = _cria(api, "em_orcamento")
    assert _muda(api, oid, "pendente_aprovacao").status_code == 200
    assert _muda(api, oid, "recusada").status_code == 200
    assert _muda(api, oid, "em_orcamento").status_code == 200       # refazer o orçamento


def test_desbloquear_antigo_continua_funcionando(api, db):
    oid = _cria(api)
    _forca(db, oid, "aguardando")
    assert _muda(api, oid, "rascunho").status_code == 200


@pytest.mark.parametrize("de,para", [
    ("rascunho", "finalizada"),
    ("em_orcamento", "finalizada"),
    ("em_orcamento", "em_execucao"),
    ("aprovada", "finalizada"),
    ("finalizada", "em_execucao"),
    ("finalizada", "rascunho"),
    ("recusada", "aprovada"),
])
def test_transicao_proibida_409_e_nao_altera(api, db, de, para):
    oid = _cria(api)
    _forca(db, oid, de)
    r = _muda(api, oid, para)
    assert r.status_code == 409 and de in r.json()["detail"]
    assert _status(db, oid)[0] == de


def test_status_igual_ao_atual_e_inofensivo(api, db):
    oid = _cria(api)
    _forca(db, oid, "finalizada")
    assert _muda(api, oid, "finalizada").status_code == 200


@pytest.mark.parametrize("corpo,codigo", [
    ({"status": "concluido"}, 422),
    ({"status": "FINALIZADA"}, 422),
    ({"status": ""}, 400),
    ({}, 400),
])
def test_status_invalido(api, db, corpo, codigo):
    oid = _cria(api)
    r = api.patch(f"/ordens/{oid}/status", corpo, format="json")
    assert r.status_code == codigo
    if codigo == 422:
        assert "em_orcamento" in r.json()["validos"]


def test_status_tambem_aceita_query_string(api, db):
    oid = _cria(api)
    assert api.patch(f"/ordens/{oid}/status?status=em_orcamento").status_code == 200


def test_status_de_outra_oficina_e_404(api, db):
    oid = _ordem(db, "2026-10-05T12:00:00-03:00", oficina=OFICINA_B)
    assert _muda(api, oid, "em_orcamento").status_code == 404
    assert _status(db, oid)[0] == "finalizada"


def test_so_quem_edita_ordens_muda_o_status(fake, db):
    oid = _cria(_cliente("dono"))
    assert _cliente("atendente").patch(f"/ordens/{oid}/status", {"status": "em_orcamento"}, format="json").status_code == 403
    assert _cliente("mecanico").patch(f"/ordens/{oid}/status", {"status": "em_orcamento"}, format="json").status_code == 200


def test_mudanca_simultanea_nao_sobrescreve(api, fake, db, monkeypatch):
    """Se alguém muda o status entre a leitura e a gravação, a segunda mudança perde (409)."""
    oid = _cria(api, "em_orcamento")
    original = views._get_ordem_or_404

    def lendo_e_alguem_muda(ordem_id, oficina_doc):
        resultado = original(ordem_id, oficina_doc)
        _forca(db, oid, "aprovada")
        return resultado

    monkeypatch.setattr(views, "_get_ordem_or_404", lendo_e_alguem_muda)
    r = _muda(api, oid, "pendente_aprovacao")
    assert r.status_code == 409 and "outra pessoa" in r.json()["detail"]
    assert _status(db, oid)[0] == "aprovada"


# ── Relatórios / Visão Geral: só "finalizada" conta como serviço concluído ───

def test_checklist_completo_nao_entra_no_faturamento_estimado(api, db):
    _cria(api, "em_orcamento")
    hoje = date.today()
    corpo = api.get("/relatorios", {"de": (hoje - timedelta(days=2)).isoformat(),
                                    "ate": (hoje + timedelta(days=2)).isoformat(), "tz": "UTC"}).json()
    assert corpo["totais"]["atual"]["ordens"] == 1
    assert corpo["totais"]["atual"]["finalizadas"] == 0 and corpo["totais"]["atual"]["faturamento"] == 0


# ── SQL: ordens_status.sql ───────────────────────────────────────────────────

def _sql():
    return (BACKEND_DIR / "sql" / "ordens_status.sql").read_text(encoding="utf-8")


def test_sql_trava_status_invalido(db):
    with pytest.raises(psycopg2.errors.CheckViolation):
        _ordem(db, "2026-10-05T12:00:00-03:00", status="concluido")


def test_sql_aceita_todo_o_vocabulario(db):
    for s in st.TODOS:
        _ordem(db, "2026-10-05T12:00:00-03:00", status=s)


def test_sql_preenche_status_nulo_sem_mexer_nos_outros(pg_dsn, db):
    conn = psycopg2.connect(pg_dsn)
    try:
        cur = conn.cursor()
        cur.execute("alter table ordens alter column status drop not null")
        cur.execute("insert into ordens (id, created_at, updated_at, payload, status) values ('a','x','x','{}',null)")
        cur.execute("insert into ordens (id, created_at, updated_at, payload, status) values ('b','x','x','{}','finalizada')")
        cur.execute(_sql())
        cur.execute(_sql())
        cur.execute("select id, status from ordens order by id")
        assert cur.fetchall() == [("a", "rascunho"), ("b", "finalizada")]
    finally:
        conn.rollback()
        conn.close()
