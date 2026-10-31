"""
Carteira de clientes da oficina — peças compartilhadas por /clientes, /veiculos e /agendamentos.

Modelo (backend/sql/migrations/0003_integracao_cliente_oficina.sql):
  customers         a pessoa. origem "app" = conta criada no app do cliente; origem "oficina" =
                    cadastro de balcão, privado da oficina que o criou.
  oficina_clientes  a carteira: "este cliente faz parte desta oficina". Só vínculo ATIVO conta.

Regras que valem em todas as rotas (e por isso moram aqui):
  - Toda consulta é filtrada por `oficina_doc` do token. Cliente, veículo e agendamento de outra
    oficina são "não encontrados" (404), nunca "proibidos" — não revela que existem.
  - Dados pessoais de cliente com conta no app (origem "app") só podem ser alterados por ele.
  - Nada é apagado de verdade: excluir um cliente revoga o vínculo (o histórico — OS, orçamentos,
    financeiro — continua apontando para ele).
"""
import logging
import re
from datetime import date

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.response import Response

from .estoque_views import _listar_todos
from .serializers import MAX_FOTO_DATA_URL_CHARS
from .views import supabase, _now

logger = logging.getLogger(__name__)

VINCULOS = "oficina_clientes"
CLIENTES = "customers"
LOTE_IN = 100  # tamanho máximo de um `in (...)` para a URL do PostgREST não estourar

# Objeto do banco que não existe = migrations ainda não rodadas.
OBJETO_INEXISTENTE = {"42P01", "42883", "PGRST205", "PGRST202", "42703", "PGRST204"}


# ── Erros do banco ────────────────────────────────────────────────────────────

def tratar_erros_carteira(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except ErroCarteira as e:
            return Response(e.corpo, status=e.status)
        except APIError as e:
            codigo = getattr(e, "code", None)
            if codigo in OBJETO_INEXISTENTE:
                logger.error("Carteira: objeto do banco não encontrado (%s): %s", codigo, getattr(e, "message", e))
                return Response(
                    {"detail": "O banco ainda não tem as tabelas ou colunas desta tela. Rode as migrations "
                               "pendentes de backend/sql/migrations (em ordem, até a 0007) no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo == "23505":
                return Response({"detail": "Já existe um registro com esses dados."}, status=http_status.HTTP_409_CONFLICT)
            if codigo == "23503":
                return Response({"detail": "Este registro está ligado a outros e não pode ser alterado assim."},
                                status=http_status.HTTP_409_CONFLICT)
            if codigo in ("23514", "23502", "22P02", "22007", "22008"):
                logger.warning("Carteira: dado recusado pelo banco (%s): %s", codigo, getattr(e, "message", e))
                return Response({"detail": "Algum dado enviado não é válido."},
                                status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
            if codigo == "42501":
                logger.error("Carteira: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role.")
                return Response({"detail": "O backend não tem permissão para acessar o banco."},
                                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
            logger.exception("Carteira: erro do banco (%s)", codigo)
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


class ErroCarteira(Exception):
    """Erro de regra de negócio que vira resposta HTTP direta."""

    def __init__(self, corpo, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY):
        super().__init__(str(corpo))
        self.corpo, self.status = corpo, status


def erro_campo(campo, msg, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY):
    return ErroCarteira({campo: [msg]}, status)


# ── Validação ─────────────────────────────────────────────────────────────────

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PLACA_RE = re.compile(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")  # antiga (ABC1234) e Mercosul (ABC1D23)


def so_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def _cpf_valido(d: str) -> bool:
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        soma = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if int(d[n]) != (soma * 10 % 11) % 10:
            return False
    return True


def _cnpj_valido(d: str) -> bool:
    if len(d) != 14 or d == d[0] * 14:
        return False
    for n, pesos in ((12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]), (13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])):
        resto = sum(int(d[i]) * pesos[i] for i in range(n)) % 11
        if int(d[n]) != (0 if resto < 2 else 11 - resto):
            return False
    return True


def documento_valido(digitos: str) -> bool:
    return _cpf_valido(digitos) if len(digitos) == 11 else _cnpj_valido(digitos)


def normalizar_placa(valor) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(valor or "")).upper()


def texto(dados: dict, chave: str, maximo: int, erros: dict, obrigatorio=False, parcial=False):
    """Lê um texto opcional. Devolve (presente, valor): `presente` False = campo não veio."""
    if chave not in dados:
        if obrigatorio and not parcial:
            erros[chave] = ["Obrigatório."]
        return False, None
    bruto = dados[chave]
    if bruto is None:
        valor = ""
    elif isinstance(bruto, str):
        valor = bruto.strip()
    else:
        erros[chave] = ["Texto inválido."]
        return False, None
    if len(valor) > maximo:
        erros[chave] = [f"Máximo de {maximo} caracteres."]
        return False, None
    if obrigatorio and not valor:
        erros[chave] = ["Obrigatório."]
        return False, None
    return True, valor


FOTO_DATA_URL_RE = re.compile(r"^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$")


def foto_valida(valor) -> bool:
    """Data URL de imagem (o que o frontend envia, já comprimida) ou URL https."""
    return (isinstance(valor, str) and 0 < len(valor) <= MAX_FOTO_DATA_URL_CHARS
            and (valor.startswith("https://") or bool(FOTO_DATA_URL_RE.match(valor))))


def ler_foto(valor, campo: str, erros: dict):
    """Valida UMA foto. Vazio/None = sem foto (limpa). Devolve (ok, valor|None); em erro anota `erros`."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return True, None
    if not isinstance(valor, str):
        erros[campo] = ["Foto inválida."]
        return False, None
    valor = valor.strip()
    if len(valor) > MAX_FOTO_DATA_URL_CHARS:
        erros[campo] = ["Foto grande demais. Escolha uma imagem menor."]
        return False, None
    if not foto_valida(valor):
        erros[campo] = ["Formato de foto inválido."]
        return False, None
    return True, valor


def ler_cliente(dados, parcial=False):
    """Valida o corpo de POST/PATCH de cliente. Devolve ({colunas de customers}, observacoes|None).
    Opcionais vazios viram None (limpam o campo)."""
    if not isinstance(dados, dict):
        raise ErroCarteira({"detail": "Corpo inválido."}, http_status.HTTP_400_BAD_REQUEST)
    erros, cols, obs = {}, {}, None

    ok, v = texto(dados, "nome", 150, erros, obrigatorio=True, parcial=parcial)
    if ok:
        cols["name"] = v

    if "cpfCnpj" in dados:
        digitos = so_digitos(dados["cpfCnpj"])
        if digitos and not documento_valido(digitos):
            erros["cpfCnpj"] = ["CPF/CNPJ inválido."]
        else:
            cols["cpf"] = digitos or None

    ok, v = texto(dados, "telefone", 20, erros)
    if ok:
        cols["phone"] = v or None

    ok, v = texto(dados, "email", 254, erros)
    if ok:
        v = v.lower()
        if v and not EMAIL_RE.match(v):
            erros["email"] = ["E-mail inválido."]
        else:
            cols["email"] = v or None

    ok, v = texto(dados, "endereco", 300, erros)
    if ok:
        cols["address"] = v or None

    ok, v = texto(dados, "observacoes", 1000, erros)
    if ok:
        obs = v

    # Foto do cliente: `null`/"" limpa; chave ausente = não mexe (mesma convenção do estoque).
    if "fotoPrincipal" in dados:
        ok, v = ler_foto(dados["fotoPrincipal"], "fotoPrincipal", erros)
        if ok:
            cols["avatar_url"] = v

    if erros:
        raise ErroCarteira(erros)
    return cols, obs


# ── Consultas ─────────────────────────────────────────────────────────────────

def buscar_por_ids(tabela: str, ids, coluna="id", extra=None):
    """select * from tabela where coluna in (ids), em lotes. `extra(q)` pode acrescentar filtros."""
    ids = [str(i) for i in dict.fromkeys(ids) if i]
    linhas = []
    for i in range(0, len(ids), LOTE_IN):
        lote = ids[i:i + LOTE_IN]
        q = supabase.table(tabela).select("*").in_(coluna, lote)
        if extra:
            q = extra(q)
        linhas.extend(q.execute().data or [])
    return linhas


def carteira_da_oficina(oficina_doc: str):
    """[(customer, vinculo)] dos clientes ATIVOS da oficina, mais novos primeiro."""
    vinculos = _listar_todos(lambda: (
        supabase.table(VINCULOS).select("*").eq("oficina_doc", oficina_doc).eq("status", "ativo")
        .order("created_at", desc=True).order("id")
    ))
    por_cliente = {str(v["customer_id"]): v for v in vinculos}
    clientes = buscar_por_ids(CLIENTES, por_cliente.keys())
    por_id = {str(c["id"]): c for c in clientes}
    return [(por_id[cid], v) for cid, v in por_cliente.items() if cid in por_id]


def vinculo_do_cliente(oficina_doc: str, customer_id):
    r = (supabase.table(VINCULOS).select("*").eq("oficina_doc", oficina_doc)
         .eq("customer_id", str(customer_id)).limit(1).execute().data)
    return r[0] if r else None


def cliente_da_carteira(oficina_doc: str, customer_id):
    """(customer, vinculo) se o cliente está na carteira ATIVA da oficina; senão None."""
    v = vinculo_do_cliente(oficina_doc, customer_id)
    if not v or v["status"] != "ativo":
        return None
    c = supabase.table(CLIENTES).select("*").eq("id", str(customer_id)).limit(1).execute().data
    return (c[0], v) if c else None


def _achar_balcao(oficina_doc: str, doc=None, email=None):
    """Cadastro de balcão desta oficina com o mesmo CPF/CNPJ ou e-mail (ativo ou arquivado)."""
    for coluna, valor in (("cpf", doc), ("email", email)):
        if not valor:
            continue
        r = (supabase.table(CLIENTES).select("*").eq("origem", "oficina")
             .eq("oficina_origem_doc", oficina_doc).eq(coluna, valor).limit(1).execute().data)
        if r:
            return r[0]
    return None


def criar_balcao(oficina_doc: str, cols: dict, observacoes=None):
    """Cadastra cliente de balcão. O vínculo nasce pelo trigger do banco. Se o mesmo
    CPF/e-mail já existir arquivado, reativa; se estiver ativo, 409. Devolve (customer, vinculo, reativado)."""
    agora = _now()
    existente = _achar_balcao(oficina_doc, cols.get("cpf"), cols.get("email"))
    if existente:
        vinc = vinculo_do_cliente(oficina_doc, existente["id"])
        if vinc and vinc["status"] == "ativo":
            campo = "cpfCnpj" if cols.get("cpf") and existente.get("cpf") == cols.get("cpf") else "email"
            raise erro_campo(campo, "Já existe um cliente com este dado.", http_status.HTTP_409_CONFLICT)
        # arquivado: volta pra carteira com os dados novos
        atualizado = (supabase.table(CLIENTES).update({**cols, "updated_at": agora})
                      .eq("id", str(existente["id"])).execute().data[0])
        patch = {"status": "ativo", "confirmado_em": agora, "revogado_em": None, "revogado_por": None}
        if observacoes is not None:
            patch["observacoes"] = observacoes
        vinc = (supabase.table(VINCULOS).update(patch).eq("oficina_doc", oficina_doc)
                .eq("customer_id", str(existente["id"])).execute().data[0])
        return atualizado, vinc, True

    criado = supabase.table(CLIENTES).insert({
        **cols, "origem": "oficina", "oficina_origem_doc": oficina_doc,
    }).execute().data[0]
    vinc = vinculo_do_cliente(oficina_doc, criado["id"])
    if vinc is None:  # o trigger não rodou (migration incompleta): falha alto em vez de seguir sem vínculo
        raise ErroCarteira({"detail": "Banco sem o gatilho de vínculo. Rode a migration 0003."},
                           http_status.HTTP_503_SERVICE_UNAVAILABLE)
    if observacoes:
        vinc = (supabase.table(VINCULOS).update({"observacoes": observacoes}).eq("oficina_doc", oficina_doc)
                .eq("customer_id", str(criado["id"])).execute().data[0])
    return criado, vinc, False


def resolver_cliente(oficina_doc: str, nome: str, doc=None, telefone=None, email=None):
    """Acha na carteira (por CPF/CNPJ, depois e-mail, depois nome exato) ou cadastra um cliente de balcão.
    É o que permite os formulários de Veículo e Agendamento continuarem mandando só texto.
    Devolve (customer, vinculo). Mais de um cliente com o mesmo nome e nenhum outro dado = 409."""
    doc = so_digitos(doc) or None
    if doc and not documento_valido(doc):
        raise erro_campo("proprietario", "CPF/CNPJ inválido.")
    email = (email or "").strip().lower() or None
    if email and not EMAIL_RE.match(email):
        raise erro_campo("proprietario", "E-mail inválido.")
    nome = (nome or "").strip()
    if not nome:
        raise erro_campo("proprietario", "Informe o nome do cliente.")

    carteira = carteira_da_oficina(oficina_doc)
    if doc:
        for c, v in carteira:
            if so_digitos(c.get("cpf")) == doc:
                return c, v
    if email:
        for c, v in carteira:
            if (c.get("email") or "").lower() == email:
                return c, v
    if not doc and not email:
        iguais = [(c, v) for c, v in carteira if (c["name"] or "").strip().lower() == nome.lower()]
        if len(iguais) == 1:
            return iguais[0]
        if len(iguais) > 1:
            raise ErroCarteira(
                {"detail": f"Há mais de um cliente chamado \"{nome}\". Informe o CPF/CNPJ ou escolha o cliente cadastrado.",
                 "candidatos": [{"id": str(c["id"]), "nome": c["name"]} for c, _ in iguais]},
                http_status.HTTP_409_CONFLICT)

    cols = {"name": nome, "cpf": doc, "phone": (telefone or "").strip() or None, "email": email}
    criado, vinc, _ = criar_balcao(oficina_doc, cols)
    return criado, vinc


def hoje_iso() -> str:
    return date.today().isoformat()
