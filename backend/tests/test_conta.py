"""Minha conta: trocar o próprio nome e excluir a própria conta (dono e funcionário).

SQL real (Postgres descartável) + views. A conta do dono usada aqui é criada no próprio teste, com CNPJ
próprio: excluir a OFICINA_A/B do conftest quebraria os outros testes da sessão.
"""
import time
import uuid

import django
import pytest
from django.contrib.auth.hashers import make_password

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from orders import conta_views, views  # noqa: E402
from orders.auth_store import SupabaseAuthStore  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402

DOC = "33333333000191"
SENHA = "SenhaForte123"
PIN = "123456"
URL_NOME = "/conta"
URL_EXCLUIR = "/conta/excluir"


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    store = SupabaseAuthStore(f)
    monkeypatch.setattr(views, "supabase", f)
    monkeypatch.setattr(conta_views, "supabase", f)
    monkeypatch.setattr(views, "auth_store", store)
    monkeypatch.setattr(conta_views, "auth_store", store)
    # A limpeza do Storage roda em segundo plano em produção; aqui roda na hora para o teste conferir.
    monkeypatch.setattr(conta_views, "_em_segundo_plano", lambda fn, *a: fn(*a))
    cur = db.cursor()
    cur.execute("delete from public.admins where doc = %s", (DOC,))
    cur.execute("insert into public.admins (nome, doc, pwhash, email) values ('Dono Teste', %s, %s, 'dono@teste.com')",
                (DOC, make_password(SENHA)))
    yield f
    # Limpa tudo o que o teste deixou (inclusive o que ele semeou) com a própria função de exclusão.
    cur.execute("select public.conta_excluir_oficina(%s)", (DOC,)) if _conta(db, "admins", "doc", DOC) else None
    cur.execute("delete from public.auth_rate_limit")
    cur.execute("delete from public.auth_refresh_tokens")
    cur.execute("delete from public.funcionarios where oficina_doc = %s", (DOC,))
    f.close()


def _cliente(payload):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {make_jwt(payload, 900)}")
    return c


def _dono(doc=DOC):
    return _cliente({"tipo": "dono", "nome": "Dono Teste", "doc": doc, "oficina_doc": doc,
                     "cargo": "dono", "permissoes": permissoes_do_cargo("dono")})


def _funcionario(db, nome="Mecânico Zé", cargo="mecanico", ativo=True, email=None):
    fid = str(uuid.uuid4())
    db.cursor().execute(
        "insert into public.funcionarios (id, oficina_doc, nome, email, pin_hash, cargo, ativo) "
        "values (%s,%s,%s,%s,%s,%s,%s)",
        (fid, DOC, nome, email or f"{fid[:8]}@teste.com", make_password(PIN), cargo, ativo))
    token = {"tipo": "funcionario", "id": fid, "nome": nome, "email": "x@y.com", "oficina_doc": DOC,
             "cargo": cargo, "permissoes": permissoes_do_cargo(cargo)}
    return fid, _cliente(token)


def _um(db, sql, params=()):
    cur = db.cursor()
    cur.execute(sql, params)
    return cur.fetchone()


def _conta(db, tabela, coluna, valor):
    return _um(db, f"select count(*) from public.{tabela} where {coluna} = %s", (valor,))[0]


# ── Trocar o nome ─────────────────────────────────────────────────────────────

def test_dono_troca_o_proprio_nome_e_recebe_token_novo(fake, db):
    r = _dono().patch(URL_NOME, {"nome": "  Maria   da Silva "}, format="json")
    assert r.status_code == 200
    assert r.json()["nome"] == "Maria da Silva"                      # espaços limpos
    assert _um(db, "select nome from public.admins where doc=%s", (DOC,))[0] == "Maria da Silva"
    novo = views.decode_jwt(r.json()["accessToken"]) if hasattr(views, "decode_jwt") else None
    if novo is not None:
        assert novo["nome"] == "Maria da Silva" and novo["oficina_doc"] == DOC and novo["tipo"] == "dono"
    # o token novo é aceito pela API
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['accessToken']}")
    assert c.patch(URL_NOME, {"nome": "Maria S."}, format="json").status_code == 200


def test_trocar_nome_do_dono_nao_mexe_no_nome_da_oficina(fake, db):
    db.cursor().execute("update public.admins set config_oficina = %s::jsonb where doc = %s",
                        ('{"nome": "Auto Center Brasil"}', DOC))
    _dono().patch(URL_NOME, {"nome": "Maria"}, format="json")
    assert _um(db, "select config_oficina->>'nome' from public.admins where doc=%s", (DOC,))[0] == "Auto Center Brasil"


def test_funcionario_troca_o_proprio_nome_sem_afetar_os_outros(fake, db):
    fid, api = _funcionario(db, nome="Zé")
    outro, _ = _funcionario(db, nome="Chico")
    r = api.patch(URL_NOME, {"nome": "José Souza"}, format="json")
    assert r.status_code == 200 and r.json()["nome"] == "José Souza"
    assert _um(db, "select nome from public.funcionarios where id=%s", (fid,))[0] == "José Souza"
    assert _um(db, "select nome from public.funcionarios where id=%s", (outro,))[0] == "Chico"
    assert _um(db, "select nome from public.admins where doc=%s", (DOC,))[0] == "Dono Teste"


def test_funcionario_desativado_nao_edita_nome(fake, db):
    fid, api = _funcionario(db, nome="Zé", ativo=False)
    assert api.patch(URL_NOME, {"nome": "Novo Nome"}, format="json").status_code == 404
    assert _um(db, "select nome from public.funcionarios where id=%s", (fid,))[0] == "Zé"


def test_funcionario_removido_nao_edita_nome(fake, db):
    fid, api = _funcionario(db)
    db.cursor().execute("delete from public.funcionarios where id=%s", (fid,))
    assert api.patch(URL_NOME, {"nome": "Novo Nome"}, format="json").status_code == 404


@pytest.mark.parametrize("nome", ["", " ", "A", "   B  ", "!!", "Ana\x00Maria", "Ana\x1bMaria", "x" * 81])
def test_nome_invalido_e_recusado_e_nada_muda(fake, db, nome):
    r = _dono().patch(URL_NOME, {"nome": nome}, format="json")
    assert r.status_code == 422
    assert _um(db, "select nome from public.admins where doc=%s", (DOC,))[0] == "Dono Teste"


def test_nome_ausente_ou_corpo_invalido(fake):
    assert _dono().patch(URL_NOME, {}, format="json").status_code == 422
    assert _dono().patch(URL_NOME, ["x"], format="json").status_code == 400


def test_nome_no_limite_passa(fake):
    assert _dono().patch(URL_NOME, {"nome": "a" * 80}, format="json").status_code == 200


def test_quebra_de_linha_no_nome_vira_espaco(fake):
    r = _dono().patch(URL_NOME, {"nome": "Ana\nMaria\tSilva"}, format="json")
    assert r.status_code == 200 and r.json()["nome"] == "Ana Maria Silva"


def test_trocar_nome_exige_login(fake):
    assert APIClient().patch(URL_NOME, {"nome": "Maria"}, format="json").status_code == 401


def test_nao_da_para_renomear_outra_conta_pelo_corpo(fake, db):
    """O alvo vem do token: doc/id no corpo são ignorados."""
    r = _dono().patch(URL_NOME, {"nome": "Maria", "doc": OFICINA_A, "id": "qualquer"}, format="json")
    assert r.status_code == 200
    assert _um(db, "select nome from public.admins where doc=%s", (OFICINA_A,))[0] == "Oficina A"


# ── Excluir: confirmação e senha ──────────────────────────────────────────────

def test_excluir_exige_a_palavra_de_confirmacao(fake, db):
    for corpo in ({"senha": SENHA}, {"senha": SENHA, "confirmacao": "talvez"}):
        assert _dono().post(URL_EXCLUIR, corpo, format="json").status_code == 422
    assert _conta(db, "admins", "doc", DOC) == 1


def test_confirmacao_aceita_minuscula(fake, db):
    r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": " excluir "}, format="json")
    assert r.status_code == 200 and _conta(db, "admins", "doc", DOC) == 0


def test_dono_senha_errada_nao_exclui_e_nao_derruba_a_sessao(fake, db):
    r = _dono().post(URL_EXCLUIR, {"senha": "errada", "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 403                    # 403, não 401: o app não deve achar que a sessão caiu
    assert "incorreta" in r.json()["detail"].lower()
    assert _conta(db, "admins", "doc", DOC) == 1


def test_dono_sem_senha_e_422(fake, db):
    assert _dono().post(URL_EXCLUIR, {"confirmacao": "EXCLUIR"}, format="json").status_code == 422
    assert _dono().post(URL_EXCLUIR, {"senha": 123, "confirmacao": "EXCLUIR"}, format="json").status_code == 422
    assert _conta(db, "admins", "doc", DOC) == 1


def test_dono_bloqueia_apos_5_senhas_erradas_mesmo_com_a_certa(fake, db):
    api = _dono()
    for _ in range(5):
        assert api.post(URL_EXCLUIR, {"senha": "errada", "confirmacao": "EXCLUIR"}, format="json").status_code == 403
    r = api.post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 429
    assert _conta(db, "admins", "doc", DOC) == 1


def test_senha_certa_zera_o_contador(fake, db):
    api = _dono()
    for _ in range(3):
        api.post(URL_EXCLUIR, {"senha": "errada", "confirmacao": "EXCLUIR"}, format="json")
    # A exclusão acontece, e o contador da conta é limpo antes dela.
    assert api.post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json").status_code == 200
    assert _conta(db, "auth_rate_limit", "bucket", f"conta:{DOC}") == 0


def test_excluir_exige_login(fake):
    assert APIClient().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json").status_code == 401


# ── Excluir a conta do dono: a oficina inteira some, o resto fica ──────────────

def _popular_oficina(db):
    """Dados da oficina DOC em todas as áreas + vizinhos que NÃO podem ser tocados."""
    cur = db.cursor()
    cur.execute("insert into public.ordens (id, created_at, updated_at, status, payload, oficina_doc) "
                "values ('os-x1','2026-10-01','2026-10-01','rascunho','{}',%s),"
                "       ('os-x2','2026-10-01','2026-10-01','aprovada','{}',%s)", (DOC, DOC))
    cur.execute("insert into public.ordens (id, created_at, updated_at, status, payload, oficina_doc) "
                "values ('os-a1','2026-10-01','2026-10-01','rascunho','{}',%s)", (OFICINA_A,))
    cur.execute("insert into public.ordem_fotos (oficina_doc, ordem_id, slot, situacao, path) "
                "values (%s,'os-x1','frente','foto','os-x1/frente.jpg')", (DOC,))
    cur.execute("insert into public.orcamentos (id, oficina_doc, ordem_id, versao, status, total) "
                "values (%s,%s,'os-x2',1,'enviado',100)", (ORC := str(uuid.uuid4()), DOC))
    cur.execute("insert into public.orcamento_itens (orcamento_id, oficina_doc, tipo, descricao, quantidade, preco_unitario) "
                "values (%s,%s,'servico','Revisão',1,100)", (ORC, DOC))
    cur.execute("insert into public.orcamento_links (oficina_doc, orcamento_id, expira_em) "
                "values (%s,%s, now() + interval '1 day')", (DOC, ORC))
    cur.execute("insert into public.estoque_itens (id, oficina_doc, nome, categoria, quantidade) "
                "values (%s,%s,'Filtro','Filtros',10)", (ITEM := str(uuid.uuid4()), DOC))
    cur.execute("insert into public.estoque_movimentos (oficina_doc, item_id, tipo, quantidade) "
                "values (%s,%s,'entrada',10)", (DOC, ITEM))
    cur.execute("insert into public.estoque_reservas (oficina_doc, item_id, ordem_id, orcamento_id, quantidade) "
                "values (%s,%s,'os-x2',%s,2)", (DOC, ITEM, ORC))
    cur.execute("insert into public.estoque_kits (id, oficina_doc, nome) values (%s,%s,'Kit')", (KIT := str(uuid.uuid4()), DOC))
    cur.execute("insert into public.estoque_kit_itens (kit_id, item_id, oficina_doc, quantidade) values (%s,%s,%s,1)",
                (KIT, ITEM, DOC))
    cur.execute("insert into public.servicos (oficina_doc, nome, categoria, preco) values (%s,'Troca','Motor',50)", (DOC,))
    cur.execute("insert into public.financeiro_transacoes (id, oficina_doc, tipo, categoria, valor, data_competencia) "
                "values (%s,%s,'entrada','servico',100,'2026-10-01')", (TR := str(uuid.uuid4()), DOC))
    cur.execute("insert into public.financeiro_reservas (oficina_doc, tipo, valor, transacao_id, percentual, escopo) "
                "values (%s,'deposito',20,%s,20,'ambos')", (DOC, TR))
    cur.execute("insert into public.alertas_dispensados (oficina_doc, usuario_chave, alerta_id) values (%s,'u','a')", (DOC,))
    cur.execute("insert into public.oficina_convites (oficina_doc, expira_em) values (%s, now() + interval '1 day')", (DOC,))
    cur.execute("insert into public.availability_slots (date, time_slot, oficina_doc) values ('2026-12-01','09:00',%s)", (DOC,))

    # Carteira: cliente de balcão (apaga), cliente do app vinculado (fica), veículos de cada um.
    cur.execute("insert into public.customers (id, name, origem, oficina_origem_doc) values (%s,'Balcão','oficina',%s)",
                (BALCAO := str(uuid.uuid4()), DOC))
    cur.execute("insert into public.customers (id, name, email, origem, pwhash) values (%s,'App','app@x.com','app','h')",
                (APP := str(uuid.uuid4()),))
    # (o vínculo do cliente de balcão nasce sozinho por gatilho da 0003)
    cur.execute("insert into public.oficina_clientes (oficina_doc, customer_id, origem, confirmado_em) "
                "values (%s,%s,'cliente',now())", (DOC, APP))
    cur.execute("insert into public.customer_vehicles (id, customer_id, brand, model, year, plate, oficina_origem_doc) "
                "values (%s,%s,'VW','Gol',2015,'BAL0001',%s)", (V_BALCAO := str(uuid.uuid4()), BALCAO, DOC))
    cur.execute("insert into public.customer_vehicles (id, customer_id, brand, model, year, plate, oficina_origem_doc) "
                "values (%s,%s,'Fiat','Uno',2012,'APP0001',%s)", (V_APP := str(uuid.uuid4()), APP, DOC))
    cur.execute("insert into public.appointments (customer_id, vehicle_id, service_type, date, time_slot, oficina_doc, ordem_id) "
                "values (%s,%s,'Revisão','2026-12-01','09:00',%s,'os-x2')", (APP, V_APP, DOC))

    # Vizinha (OFICINA_A) com dado em tabela compartilhada, que não pode ser tocada.
    cur.execute("insert into public.servicos (oficina_doc, nome, categoria, preco) values (%s,'Alinhar','Pneus',70)", (OFICINA_A,))
    return {"app": APP, "balcao": BALCAO, "v_app": V_APP, "v_balcao": V_BALCAO}


TABELAS_COM_OFICINA = ("ordens", "ordem_fotos", "orcamentos", "orcamento_itens", "orcamento_links", "estoque_itens",
                       "estoque_movimentos", "estoque_reservas", "estoque_kits", "estoque_kit_itens", "servicos",
                       "financeiro_transacoes", "financeiro_reservas", "alertas_dispensados", "oficina_convites",
                       "oficina_clientes", "appointments", "funcionarios")


def test_dono_exclui_a_oficina_inteira(fake, db):
    ids = _popular_oficina(db)
    fid, _ = _funcionario(db)
    cur = db.cursor()
    # sessões do dono e do funcionário + contador de tentativas
    cur.execute("insert into public.auth_refresh_tokens (token_hash, tipo, doc, expires_at) values ('h1','dono',%s,%s)",
                (DOC, time.time() + 999))
    cur.execute("insert into public.auth_refresh_tokens (token_hash, tipo, funcionario_id, expires_at) values ('h2','funcionario',%s,%s)",
                (fid, time.time() + 999))
    cur.execute("insert into public.auth_reset_tokens (token_hash, doc, expires_at) values ('r1',%s,%s)", (DOC, time.time() + 999))
    cur.execute("insert into public.auth_rate_limit (bucket, kind, created_at) values (%s,'pin',%s)", (fid, time.time()))
    # arquivos no Storage: da oficina e de outra
    fake.storage.arquivos.update({"os-x1/frente.jpg": b"1", "os-x1/hodometro.jpg": b"2", "os-x2/orcamento.pdf": b"3",
                                  "os-a1/frente.jpg": b"4"})

    r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 200, r.content

    assert _conta(db, "admins", "doc", DOC) == 0
    for tabela in TABELAS_COM_OFICINA:
        assert _conta(db, tabela, "oficina_doc", DOC) == 0, tabela
    assert _conta(db, "customers", "id", ids["balcao"]) == 0           # cadastro de balcão some
    assert _conta(db, "customer_vehicles", "id", ids["v_balcao"]) == 0
    assert _conta(db, "auth_refresh_tokens", "doc", DOC) == 0
    assert _conta(db, "auth_refresh_tokens", "funcionario_id", fid) == 0
    assert _conta(db, "auth_reset_tokens", "doc", DOC) == 0
    assert _conta(db, "auth_rate_limit", "bucket", fid) == 0

    # Conta do app do cliente e o veículo dela continuam; só some a marca da oficina.
    assert _conta(db, "customers", "id", ids["app"]) == 1
    assert _um(db, "select oficina_origem_doc from public.customer_vehicles where id=%s", (ids["v_app"],))[0] is None

    # Outra oficina intacta.
    assert _conta(db, "admins", "doc", OFICINA_A) == 1
    assert _conta(db, "ordens", "oficina_doc", OFICINA_A) == 1
    assert _conta(db, "servicos", "oficina_doc", OFICINA_A) == 1

    # Storage: só o que era da oficina saiu.
    assert set(fake.storage.arquivos) == {"os-a1/frente.jpg"}


def test_resposta_do_dono_nao_vaza_dados_internos(fake):
    r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.json() == {"message": "Conta excluída."}


def test_depois_de_excluir_o_token_antigo_nao_acha_a_conta(fake, db):
    api = _dono()
    assert api.post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json").status_code == 200
    # Token ainda vale por minutos, mas a conta não existe mais: nenhuma operação pode "ressuscitar" nada.
    assert api.post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json").status_code == 404
    assert api.patch(URL_NOME, {"nome": "Fantasma"}, format="json").status_code == 404
    assert _conta(db, "admins", "doc", DOC) == 0


def test_migracao_ausente_da_mensagem_clara_e_nao_apaga(fake, db):
    fake.falhar_em[("rpc", "conta_excluir_oficina")] = "42883"
    r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 503 and "0010" in r.json()["detail"]
    assert _conta(db, "admins", "doc", DOC) == 1


def test_falha_do_banco_nao_apaga_e_nao_expoe_erro_tecnico(fake, db):
    fake.falhar_em[("rpc", "conta_excluir_oficina")] = "23503"          # FK inesperada
    r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 503
    assert "nada foi apagado" in r.json()["detail"].lower()
    for termo in ("23503", "foreign", "constraint", "supabase", "postgrest"):
        assert termo not in r.json()["detail"].lower()
    assert _conta(db, "admins", "doc", DOC) == 1


def test_funcao_sql_e_atomica_uma_fk_inesperada_desfaz_tudo(fake, db):
    """Uma tabela nova (que a função não conhece) referenciando a oficina barra a exclusão e NADA é apagado."""
    _popular_oficina(db)
    cur = db.cursor()
    cur.execute("create table public.zz_tabela_futura (doc text references public.admins(doc))")
    cur.execute("insert into public.zz_tabela_futura values (%s)", (DOC,))
    try:
        r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
        assert r.status_code == 503
        assert _conta(db, "admins", "doc", DOC) == 1
        assert _conta(db, "ordens", "oficina_doc", DOC) == 2            # nada pela metade
        assert _conta(db, "servicos", "oficina_doc", DOC) == 1
    finally:
        cur.execute("drop table public.zz_tabela_futura")


def test_storage_nao_e_limpo_quando_a_exclusao_falha(fake, db):
    _popular_oficina(db)
    fake.storage.arquivos["os-x1/frente.jpg"] = b"1"
    fake.falhar_em[("rpc", "conta_excluir_oficina")] = "23503"
    _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert "os-x1/frente.jpg" in fake.storage.arquivos


def test_falha_do_storage_nao_desfaz_a_exclusao(fake, db, monkeypatch):
    _popular_oficina(db)
    fake.storage.arquivos["os-x1/frente.jpg"] = b"1"

    def quebrado(_):
        raise RuntimeError("storage fora do ar")
    monkeypatch.setattr(fake.storage, "remove", quebrado)
    r = _dono().post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 200 and _conta(db, "admins", "doc", DOC) == 0


def test_funcao_sql_nao_e_executavel_por_anon(pg_dsn):
    """A função é destrutiva: só o backend (service_role) pode chamá-la, nunca PUBLIC."""
    import psycopg2
    conn = psycopg2.connect(pg_dsn)
    cur = conn.cursor()
    cur.execute("select has_function_privilege('public', 'public.conta_excluir_oficina(text)', 'execute')")
    assert cur.fetchone()[0] is False
    conn.close()


def test_funcao_sql_valida_parametros(fake, db):
    from postgrest.exceptions import APIError
    for valor, codigo in ((" ", "22023"), ("00000000000000", "P0002")):
        with pytest.raises(APIError) as e:
            fake.rpc("conta_excluir_oficina", {"p_oficina_doc": valor}).execute()
        assert e.value.code == codigo


# ── Excluir a conta do funcionário ────────────────────────────────────────────

def test_funcionario_exclui_so_a_propria_conta(fake, db):
    fid, api = _funcionario(db, nome="Zé")
    outro, _ = _funcionario(db, nome="Chico")
    db.cursor().execute("insert into public.auth_refresh_tokens (token_hash, tipo, funcionario_id, expires_at) "
                        "values ('hf','funcionario',%s,%s)", (fid, time.time() + 999))
    db.cursor().execute("insert into public.auth_refresh_tokens (token_hash, tipo, funcionario_id, expires_at) "
                        "values ('ho','funcionario',%s,%s)", (outro, time.time() + 999))
    r = api.post(URL_EXCLUIR, {"pin": PIN, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 200
    assert _conta(db, "funcionarios", "id", fid) == 0
    assert _conta(db, "funcionarios", "id", outro) == 1
    assert _conta(db, "admins", "doc", DOC) == 1                      # a oficina não é afetada
    assert _conta(db, "auth_refresh_tokens", "funcionario_id", fid) == 0
    assert _conta(db, "auth_refresh_tokens", "funcionario_id", outro) == 1


def test_funcionario_mantem_agendamentos_sem_mecanico(fake, db):
    fid, api = _funcionario(db)
    cur = db.cursor()
    cur.execute("insert into public.appointments (service_type, date, time_slot, oficina_doc, mecanico_id) "
                "values ('Revisão','2026-12-01','09:00',%s,%s) returning id", (DOC, fid))
    ag = cur.fetchone()[0]
    r = api.post(URL_EXCLUIR, {"pin": PIN, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 200, r.content
    assert _um(db, "select mecanico_id from public.appointments where id=%s", (ag,))[0] is None


def test_funcionario_pin_errado_nao_exclui(fake, db):
    fid, api = _funcionario(db)
    r = api.post(URL_EXCLUIR, {"pin": "000000", "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 403 and "pin" in r.json()["detail"].lower()
    assert _conta(db, "funcionarios", "id", fid) == 1


@pytest.mark.parametrize("pin", ["", "12345", "1234567", "abcdef", None])
def test_funcionario_pin_mal_formado_e_422(fake, db, pin):
    fid, api = _funcionario(db)
    assert api.post(URL_EXCLUIR, {"pin": pin, "confirmacao": "EXCLUIR"}, format="json").status_code == 422
    assert _conta(db, "funcionarios", "id", fid) == 1


def test_funcionario_bloqueia_apos_5_pins_errados(fake, db):
    fid, api = _funcionario(db)
    for _ in range(5):
        assert api.post(URL_EXCLUIR, {"pin": "000000", "confirmacao": "EXCLUIR"}, format="json").status_code == 403
    assert api.post(URL_EXCLUIR, {"pin": PIN, "confirmacao": "EXCLUIR"}, format="json").status_code == 429
    assert _conta(db, "funcionarios", "id", fid) == 1


def test_funcionario_nao_manda_senha_de_dono(fake, db):
    """Funcionário com a senha do dono no corpo não exclui a oficina nem a si mesmo (precisa do PIN)."""
    fid, api = _funcionario(db)
    r = api.post(URL_EXCLUIR, {"senha": SENHA, "confirmacao": "EXCLUIR"}, format="json")
    assert r.status_code == 422
    assert _conta(db, "admins", "doc", DOC) == 1 and _conta(db, "funcionarios", "id", fid) == 1


def test_gerente_tambem_exclui_so_a_propria_conta(fake, db):
    fid, api = _funcionario(db, cargo="gerente", nome="Gê")
    assert api.post(URL_EXCLUIR, {"pin": PIN, "confirmacao": "EXCLUIR"}, format="json").status_code == 200
    assert _conta(db, "admins", "doc", DOC) == 1
