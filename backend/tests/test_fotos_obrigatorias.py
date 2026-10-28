"""Fotos obrigatórias da entrada: 5 itens fixos, pular com motivo, auditoria e a regra de avanço."""
import json

import django
import psycopg2
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from postgrest.exceptions import APIError
from rest_framework.test import APIClient

django.setup()

from orders import fotos_obrigatorias as fo  # noqa: E402
from orders import relatorios_views, views, visao_geral_views  # noqa: E402
from orders.rbac import permissoes_do_cargo  # noqa: E402
from orders.views import make_jwt  # noqa: E402

from .conftest import OFICINA_A, OFICINA_B  # noqa: E402
from .fake_supabase import FakeSupabase  # noqa: E402
from .test_relatorios import _cliente, _corpo_ordem  # noqa: E402

SLOTS = ["hodometro", "frente", "traseira", "lateral_direita", "lateral_esquerda"]
JPEG = b"\xff\xd8\xff\xe0" + b"fake-jpeg-" * 20
PNG = b"\x89PNG\r\n\x1a\n" + b"fake-png-" * 20


@pytest.fixture()
def fake(pg_dsn, db, monkeypatch):
    f = FakeSupabase(pg_dsn)
    for modulo in (fo, relatorios_views, views, visao_geral_views):
        monkeypatch.setattr(modulo, "supabase", f)
    yield f
    f.close()


@pytest.fixture()
def api(fake):
    return _cliente("dono")


def _cria(api, status="rascunho", **kw):
    r = api.post("/ordens", {**_corpo_ordem(**kw), "status": status}, format="json")
    assert r.status_code == 201, r.content
    return r.json()["id"]


def _foto(api, oid, slot="hodometro", conteudo=JPEG, nome="foto.jpg"):
    arquivo = SimpleUploadedFile(nome, conteudo, content_type="image/jpeg")
    return api.put(f"/ordens/{oid}/fotos-obrigatorias/{slot}", {"file": arquivo}, format="multipart")


def _pular(api, oid, slot="hodometro", motivo="carro trancado"):
    return api.post(f"/ordens/{oid}/fotos-obrigatorias/{slot}/pular", {"motivo": motivo}, format="json")


def _linhas_db(db, oid):
    cur = db.cursor()
    cur.execute("select slot, situacao, path, motivo, por_nome, por_tipo, refeitas from ordem_fotos "
                "where ordem_id=%s order by slot", (oid,))
    return {r[0]: r[1:] for r in cur.fetchall()}


def _resolve_todas(api, oid):
    for slot in SLOTS:
        assert _pular(api, oid, slot).status_code == 200


def _status(db, oid):
    cur = db.cursor()
    cur.execute("select status from ordens where id=%s", (oid,))
    return cur.fetchone()[0]


def _put_ordem(api, oid, status="em_orcamento", **kw):
    return api.put(f"/ordens/{oid}", {**_corpo_ordem(**kw), "status": status}, format="json")


def _cliente_com(permissoes, oficina=OFICINA_A, tipo="funcionario", nome="Zé"):
    c = APIClient()
    token = make_jwt({"tipo": tipo, "nome": nome, "id": "func-1", "oficina_doc": oficina,
                      "permissoes": permissoes}, 900)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


# ── estado inicial ───────────────────────────────────────────────────────────

def test_os_nova_tem_os_5_itens_pendentes_na_ordem_certa(api):
    oid = _cria(api)
    r = api.get(f"/ordens/{oid}/fotos-obrigatorias")
    assert r.status_code == 200, r.content
    corpo = r.json()
    assert [i["slot"] for i in corpo["itens"]] == SLOTS
    assert [i["situacao"] for i in corpo["itens"]] == ["pendente"] * 5
    assert corpo["total"] == 5 and corpo["resolvidas"] == 0 and corpo["completo"] is False
    assert corpo["faltam"] == SLOTS
    assert corpo["itens"][0]["rotulo"] == "Hodômetro" and "aceso" in corpo["itens"][0]["dica"]
    assert "dica" not in corpo["itens"][1]


def test_lista_do_backend_tem_5_itens_fixos():
    assert fo.SLOT_IDS == tuple(SLOTS)


# ── tirar / refazer ──────────────────────────────────────────────────────────

def test_tirar_foto_guarda_no_storage_registra_quem_e_conta_no_progresso(api, fake, db):
    oid = _cria(api)
    r = _foto(api, oid, "frente")
    assert r.status_code == 200, r.content
    corpo = r.json()
    item = corpo["item"]
    assert item["slot"] == "frente" and item["situacao"] == "foto"
    assert item["path"].startswith(f"{oid}/obrig-frente-") and item["path"].endswith(".jpg")
    assert item["porNome"] == "dono" and item["porTipo"] == "dono" and item["em"]
    assert "refeitas" not in item and "motivo" not in item
    assert corpo["resolvidas"] == 1 and corpo["faltam"] == [s for s in SLOTS if s != "frente"]
    assert fake.storage.arquivos[item["path"]] == JPEG
    assert _linhas_db(db, oid)["frente"][:2] == ("foto", item["path"])
    assert api.get(f"/ordens/{oid}/fotos-obrigatorias").json()["resolvidas"] == 1


def test_funcionario_fica_registrado_como_funcionario(fake, db):
    api = _cliente("mecanico")
    oid = _cria(api)
    assert _foto(api, oid).status_code == 200
    assert _linhas_db(db, oid)["hodometro"][3:5] == ("mecanico", "funcionario")


def test_refazer_troca_a_foto_apaga_a_antiga_e_conta_a_refeita(api, fake, db):
    oid = _cria(api)
    antiga = _foto(api, oid, conteudo=JPEG).json()["item"]["path"]
    nova = _foto(api, oid, conteudo=PNG, nome="x.png").json()["item"]
    assert nova["path"] != antiga and nova["path"].endswith(".png") and nova["refeitas"] == 1
    assert antiga not in fake.storage.arquivos and fake.storage.arquivos[nova["path"]] == PNG
    assert len(_linhas_db(db, oid)) == 1


def test_arquivos_da_entrada_ficam_na_pasta_da_os_para_sumir_junto_com_ela(api, fake, db):
    oid = _cria(api)
    for slot in SLOTS:
        _foto(api, oid, slot)
    assert api.delete(f"/ordens/{oid}").status_code == 200
    assert fake.storage.arquivos == {}
    assert _linhas_db(db, oid) == {}


# ── pular com motivo ─────────────────────────────────────────────────────────

def test_pular_resolve_o_item_e_guarda_motivo_quem_e_quando(api, db):
    oid = _cria(api)
    r = _pular(api, oid, "traseira", "  Carro   trancado \n pelo cliente ")
    assert r.status_code == 200, r.content
    item = r.json()["item"]
    assert item["situacao"] == "pulada" and item["motivo"] == "Carro trancado pelo cliente"
    assert "path" not in item and item["porNome"] == "dono" and item["em"]
    assert r.json()["resolvidas"] == 1
    assert _linhas_db(db, oid)["traseira"][:4] == ("pulada", None, "Carro trancado pelo cliente", "dono")


@pytest.mark.parametrize("corpo", [{}, {"motivo": ""}, {"motivo": "  "}, {"motivo": "ab"}, {"motivo": "x" * 121}, {"motivo": 5}])
def test_motivo_invalido_422_e_nada_muda(api, db, corpo):
    oid = _cria(api)
    r = api.post(f"/ordens/{oid}/fotos-obrigatorias/frente/pular", corpo, format="json")
    assert r.status_code == 422 and "motivo" in r.json()
    assert _linhas_db(db, oid) == {}


def test_pular_um_item_que_tinha_foto_remove_a_foto(api, fake, db):
    oid = _cria(api)
    caminho = _foto(api, oid).json()["item"]["path"]
    r = _pular(api, oid, motivo="sem energia")
    assert r.status_code == 200 and r.json()["item"]["refeitas"] == 1
    assert caminho not in fake.storage.arquivos
    assert _linhas_db(db, oid)["hodometro"][:3] == ("pulada", None, "sem energia")


def test_tirar_foto_depois_de_pular_limpa_o_motivo(api, db):
    oid = _cria(api)
    _pular(api, oid)
    assert _foto(api, oid).status_code == 200
    situacao, path, motivo = _linhas_db(db, oid)["hodometro"][:3]
    assert situacao == "foto" and path and motivo is None


# ── arquivo e entrada inválidos ──────────────────────────────────────────────

def test_arquivo_que_nao_e_imagem_415(api, fake, db):
    oid = _cria(api)
    r = _foto(api, oid, conteudo=b"MZ\x90\x00 programa.exe", nome="foto.jpg")
    assert r.status_code == 415 and fake.storage.arquivos == {} and _linhas_db(db, oid) == {}


def test_foto_grande_demais_413(api, fake, monkeypatch):
    monkeypatch.setattr(fo, "MAX_FOTO_SIZE_BYTES", 100)
    oid = _cria(api)
    assert _foto(api, oid, conteudo=JPEG + b"0" * 200).status_code == 413
    assert fake.storage.arquivos == {}


def test_sem_arquivo_400(api):
    oid = _cria(api)
    r = api.put(f"/ordens/{oid}/fotos-obrigatorias/frente", {}, format="multipart")
    assert r.status_code == 400


def test_item_desconhecido_404(api):
    oid = _cria(api)
    assert _foto(api, oid, "teto").status_code == 404
    assert _pular(api, oid, "teto").status_code == 404


@pytest.mark.parametrize("conteudo,ext", [
    (JPEG, "jpg"), (PNG, "png"),
    (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "webp"),
    (b"\x00\x00\x00\x1cftypheic" + b"\x00" * 8, "heic"),
    (b"\x00\x00\x00\x18ftypmif1" + b"\x00" * 8, "heic"),
    (b"GIF89a....", None), (b"MZ....", None), (b"", None),
])
def test_extensao_pelo_conteudo(conteudo, ext):
    assert fo.extensao_da_imagem(conteudo) == ext


# ── permissões e isolamento ──────────────────────────────────────────────────

def test_sem_login_401(fake):
    assert APIClient().get("/ordens/x/fotos-obrigatorias").status_code == 401
    assert APIClient().post("/ordens/x/fotos-obrigatorias/frente/pular", {}, format="json").status_code == 401


@pytest.mark.parametrize("cargo", ["dono", "gerente", "mecanico", "atendente"])
def test_quem_cria_ou_edita_ordens_pode_fotografar(fake, cargo):
    oid = _cria(_cliente("dono"))
    api = _cliente(cargo)
    assert _foto(api, oid).status_code == 200
    assert _pular(api, oid, "frente").status_code == 200
    assert api.get(f"/ordens/{oid}/fotos-obrigatorias").status_code == 200


def test_so_leitura_nao_escreve_e_sem_ver_nao_le(fake):
    oid = _cria(_cliente("dono"))
    leitor = _cliente_com(["ordens.ver"])
    assert leitor.get(f"/ordens/{oid}/fotos-obrigatorias").status_code == 200
    assert _foto(leitor, oid).status_code == 403
    assert _pular(leitor, oid).status_code == 403
    assert _cliente_com([]).get(f"/ordens/{oid}/fotos-obrigatorias").status_code == 403


def test_outra_oficina_nao_enxerga_nem_mexe_e_nada_vaza(fake, db):
    oid = _cria(_cliente("dono"))
    intruso = _cliente("dono", OFICINA_B)
    assert intruso.get(f"/ordens/{oid}/fotos-obrigatorias").status_code == 404
    assert _foto(intruso, oid).status_code == 404
    assert _pular(intruso, oid).status_code == 404
    assert _linhas_db(db, oid) == {} and fake.storage.arquivos == {}


def test_banco_nao_aceita_foto_de_ordem_de_outra_oficina(api, db):
    oid = _cria(api)
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        db.cursor().execute(
            "insert into ordem_fotos (oficina_doc, ordem_id, slot, situacao, motivo) "
            "values (%s, %s, 'frente', 'pulada', 'chuva forte')", (OFICINA_B, oid))


# ── fase da OS ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("fase", ["pendente_aprovacao", "aprovada", "em_execucao", "aguardando", "finalizada", "recusada"])
def test_depois_do_orcamento_o_registro_nao_muda(api, db, fase):
    oid = _cria(api)
    _foto(api, oid)
    db.cursor().execute("update ordens set status=%s where id=%s", (fase, oid))
    for r in (_foto(api, oid, "frente"), _pular(api, oid, "frente"), _pular(api, oid, "hodometro")):
        assert r.status_code == 409 and r.json()["codigo"] == "os_status" and r.json()["osStatus"] == fase
    assert set(_linhas_db(db, oid)) == {"hodometro"}
    assert api.get(f"/ordens/{oid}/fotos-obrigatorias").status_code == 200       # ler continua valendo


def test_os_em_orcamento_ainda_aceita_ajuste(api):
    oid = _cria(api, "em_orcamento")
    assert _foto(api, oid).status_code == 200


# ── falhas de infraestrutura ─────────────────────────────────────────────────

def test_storage_fora_do_ar_502_e_nada_gravado(api, fake, db):
    oid = _cria(api)
    fake.storage.falhar_upload = True
    r = _foto(api, oid)
    assert r.status_code == 502 and "Tente de novo" in r.json()["detail"]
    assert _linhas_db(db, oid) == {}


def test_storage_instavel_uma_vez_tenta_de_novo_e_guarda(api, fake, db, monkeypatch):
    monkeypatch.setattr("orders.fotos_obrigatorias.ESPERA_ENTRE_TENTATIVAS_S", 0)
    oid = _cria(api)
    fake.storage.falhas_restantes = 1
    r = _foto(api, oid)
    assert r.status_code == 200
    assert len(fake.storage.arquivos) == 1
    assert fake.storage.falhas_restantes == 0


def test_banco_recusou_nao_deixa_arquivo_orfao(api, fake, db):
    oid = _cria(api)
    fake.falhar_em[("upsert", "ordem_fotos")] = "23514"
    with pytest.raises(APIError):
        _foto(api, oid)
    assert fake.storage.arquivos == {} and _linhas_db(db, oid) == {}


def test_refazer_com_banco_fora_mantem_a_foto_antiga(api, fake, db):
    oid = _cria(api)
    antiga = _foto(api, oid).json()["item"]["path"]
    fake.falhar_em[("upsert", "ordem_fotos")] = "23514"
    with pytest.raises(APIError):
        _foto(api, oid, conteudo=PNG)
    assert list(fake.storage.arquivos) == [antiga] and _linhas_db(db, oid)["hodometro"][1] == antiga


def test_script_nao_rodado_503_com_instrucao(api, fake):
    oid = _cria(api)
    fake.falhar_em[("select", "ordem_fotos")] = "42P01"
    for r in (api.get(f"/ordens/{oid}/fotos-obrigatorias"), _foto(api, oid), _pular(api, oid)):
        assert r.status_code == 503 and "ordens_fotos.sql" in r.json()["detail"]


# ── regra de avanço (PUT /ordens/<id>) ───────────────────────────────────────

def test_rascunho_sem_as_5_fotos_fica_em_rascunho_mas_salva_tudo(api, db):
    oid = _cria(api)
    r = _put_ordem(api, oid, num="OS-9")
    assert r.status_code == 200, r.content
    assert r.json()["status"] == "rascunho" and r.json()["fotos_obrigatorias_pendentes"] == SLOTS
    assert _status(db, oid) == "rascunho"
    cur = db.cursor()
    cur.execute("select os_num, payload from ordens where id=%s", (oid,))
    os_num, payload = cur.fetchone()
    assert os_num == "OS-9" and json.loads(payload)["status"] == "rascunho"      # o resto foi salvo


def test_faltando_um_so_o_que_falta_e_informado(api):
    oid = _cria(api)
    for slot in SLOTS[:4]:
        _pular(api, oid, slot)
    r = _put_ordem(api, oid)
    assert r.json()["status"] == "rascunho" and r.json()["fotos_obrigatorias_pendentes"] == ["lateral_esquerda"]


def test_com_as_5_resolvidas_sobe_para_em_orcamento(api, db):
    oid = _cria(api)
    for slot in SLOTS[:3]:
        assert _foto(api, oid, slot).status_code == 200
    for slot in SLOTS[3:]:
        assert _pular(api, oid, slot).status_code == 200      # foto OU motivo: os dois contam
    r = _put_ordem(api, oid)
    assert r.status_code == 200 and "fotos_obrigatorias_pendentes" not in r.json()
    assert _status(db, oid) == "em_orcamento"


def test_salvar_como_rascunho_nao_e_barrado_nem_avisa(api, db):
    oid = _cria(api)
    r = _put_ordem(api, oid, status="rascunho")
    assert r.status_code == 200 and "fotos_obrigatorias_pendentes" not in r.json()


def test_os_que_ja_passou_da_entrada_nao_e_cobrada(api, db):
    oid = _cria(api, "em_orcamento")                        # nasceu antes da regra, sem nenhuma foto
    r = _put_ordem(api, oid, num="OS-2")
    assert r.status_code == 200 and "fotos_obrigatorias_pendentes" not in r.json()
    assert _status(db, oid) == "em_orcamento"


def test_sem_o_script_a_regra_nao_trava_o_salvamento(api, fake, db):
    oid = _cria(api)
    fake.falhar_em[("select", "ordem_fotos")] = "42P01"
    r = _put_ordem(api, oid)
    assert r.status_code == 200 and _status(db, oid) == "em_orcamento"


# ── tabela ───────────────────────────────────────────────────────────────────

def test_banco_so_aceita_linha_coerente(api, db):
    oid = _cria(api)
    cur = db.cursor()
    ruins = [
        "('frente', 'foto', null, null)",                       # foto sem caminho
        "('frente', 'foto', 'a/b.jpg', 'chuva')",               # foto com motivo
        "('frente', 'pulada', 'a/b.jpg', 'chuva forte')",       # pulada com caminho
        "('frente', 'pulada', null, null)",                     # pulada sem motivo
        "('frente', 'pulada', null, 'ab')",                     # motivo curto demais
        "('teto', 'pulada', null, 'chuva forte')",              # item que não existe
    ]
    for valores in ruins:
        with pytest.raises(psycopg2.errors.CheckViolation):
            cur.execute(f"insert into ordem_fotos (oficina_doc, ordem_id, slot, situacao, path, motivo) "
                        f"select %s, %s, v.* from (values {valores}) as v(s, a, b, c)", (OFICINA_A, oid))
    assert _linhas_db(db, oid) == {}


def test_um_registro_por_os_e_item(api, db):
    oid = _cria(api)
    sql = ("insert into ordem_fotos (oficina_doc, ordem_id, slot, situacao, motivo) "
           "values (%s, %s, 'frente', 'pulada', 'chuva forte')")
    db.cursor().execute(sql, (OFICINA_A, oid))
    with pytest.raises(psycopg2.errors.UniqueViolation):
        db.cursor().execute(sql, (OFICINA_A, oid))
