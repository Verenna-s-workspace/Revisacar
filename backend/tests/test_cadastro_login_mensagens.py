"""Cadastro e login do dono: as respostas de erro precisam falar com quem usa o sistema.

E-mail ou CNPJ já cadastrado, CNPJ inválido e senha errada devolvem frases claras em
português — nunca o erro cru do banco (chave duplicada, nome de constraint) nem "Doc",
termo interno. Sem banco: o Supabase é um duplo em memória e os tokens são simulados.
"""
import django
import pytest

django.setup()

from postgrest.exceptions import APIError  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from orders import views  # noqa: E402

# CNPJs com dígitos verificadores corretos (e um com o último dígito trocado).
CNPJ_OK = "11222333000181"
CNPJ_INVALIDO = "11222333000182"
EMAIL = "ana@oficina.com"

# Palavras que só interessam a quem programa — nenhuma pode chegar ao usuário.
TERMOS_TECNICOS = ("duplicate", "constraint", "violates", "postgrest", "supabase", "23505", "admins_")


class _AdminsFake:
    """Só o que admin_signup usa: supabase.table("admins").insert(...).execute()."""

    def __init__(self):
        self.inseridos = []
        self.falha = None  # APIError a lançar no próximo insert

    def table(self, nome):
        assert nome == "admins"
        return self

    def insert(self, linha):
        self._linha = linha
        return self

    def execute(self):
        if self.falha:
            raise self.falha
        self.inseridos.append(self._linha)


@pytest.fixture()
def env(monkeypatch):
    contas = {}  # doc -> conta, para as buscas por CNPJ e por e-mail
    admins = _AdminsFake()

    monkeypatch.setattr(views, "supabase", admins)
    monkeypatch.setattr(views, "_get_admin_by_doc", lambda d: contas.get(d))
    monkeypatch.setattr(views, "_get_admin_by_email",
                        lambda e: next((c for c in contas.values() if c["email"] == e.lower()), None))
    monkeypatch.setattr(views, "_issue_tokens", lambda admin: {"accessToken": "a", "refreshToken": "r"})

    class Env:
        pass

    e = Env()
    e.api, e.admins, e.contas = APIClient(), admins, contas
    return e


def _cadastro(**extra):
    corpo = {"nome": "Ana", "doc": CNPJ_OK, "email": EMAIL, "senha": "segredo123"}
    corpo.update(extra)
    return corpo


def _sem_termos_tecnicos(texto: str):
    for termo in TERMOS_TECNICOS:
        assert termo not in texto.lower(), f"mensagem técnica vazou: {texto!r}"


# ── Cadastro ──────────────────────────────────────────────────────────────────

def test_cadastro_novo_cria_a_conta_com_email_em_minusculas(env):
    r = env.api.post("/admin/signup", _cadastro(email="Ana@Oficina.COM"), format="json")
    assert r.status_code == 201
    assert env.admins.inseridos[0]["email"] == EMAIL


def test_email_ja_cadastrado_responde_409_com_mensagem_clara(env):
    env.contas["99999999000191"] = {"doc": "99999999000191", "email": EMAIL}
    r = env.api.post("/admin/signup", _cadastro(), format="json")
    assert r.status_code == 409
    assert "e-mail" in r.data["detail"].lower()
    assert "já está cadastrado" in r.data["detail"]
    assert env.admins.inseridos == []  # nada foi gravado


def test_cnpj_ja_cadastrado_responde_409_com_mensagem_clara(env):
    env.contas[CNPJ_OK] = {"doc": CNPJ_OK, "email": "outro@oficina.com"}
    r = env.api.post("/admin/signup", _cadastro(), format="json")
    assert r.status_code == 409
    assert "CNPJ" in r.data["detail"]
    assert "já está cadastrado" in r.data["detail"]
    assert env.admins.inseridos == []


def test_cnpj_invalido_no_cadastro_diz_que_o_cnpj_e_invalido(env):
    r = env.api.post("/admin/signup", _cadastro(doc=CNPJ_INVALIDO), format="json")
    assert r.status_code == 422
    assert r.data["doc"] == ["CNPJ inválido"]


def test_corrida_entre_dois_cadastros_do_mesmo_email_nao_vira_500(env):
    """A checagem passou para as duas pessoas e o banco barrou a segunda: mesma resposta clara."""
    env.admins.falha = APIError({
        "message": 'duplicate key value violates unique constraint "admins_email_key"',
        "code": "23505",
    })
    r = env.api.post("/admin/signup", _cadastro(), format="json")
    assert r.status_code == 409
    assert "e-mail" in r.data["detail"].lower()
    _sem_termos_tecnicos(r.data["detail"])


def test_corrida_entre_dois_cadastros_do_mesmo_cnpj_nao_vira_500(env):
    env.admins.falha = APIError({
        "message": 'duplicate key value violates unique constraint "admins_doc_key"',
        "code": "23505",
    })
    r = env.api.post("/admin/signup", _cadastro(), format="json")
    assert r.status_code == 409
    assert "CNPJ" in r.data["detail"]
    _sem_termos_tecnicos(r.data["detail"])


def test_falha_inesperada_do_banco_no_cadastro_nao_vaza_detalhe_tecnico(env):
    env.admins.falha = APIError({"message": 'relation "admins" does not exist', "code": "42P01"})
    r = env.api.post("/admin/signup", _cadastro(), format="json")
    assert r.status_code == 503
    assert "Tente de novo" in r.data["detail"]
    _sem_termos_tecnicos(r.data["detail"])
    assert "relation" not in r.data["detail"]


# ── Login ─────────────────────────────────────────────────────────────────────

def test_login_com_senha_errada_fala_cnpj_e_nao_doc(env):
    r = env.api.post("/admin/login", {"doc": CNPJ_OK, "senha": "qualquer"}, format="json")
    assert r.status_code == 401
    assert r.data["detail"] == "CNPJ ou senha incorretos"
    assert "doc" not in r.data["detail"].lower()


def test_login_com_cnpj_invalido_diz_que_o_cnpj_e_invalido(env):
    r = env.api.post("/admin/login", {"doc": CNPJ_INVALIDO, "senha": "qualquer"}, format="json")
    assert r.status_code == 422
    assert r.data["doc"] == ["CNPJ inválido"]
