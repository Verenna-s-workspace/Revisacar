"""
Carteira de clientes da oficina (tela Clientes) e convites para o app do cliente.

Permissões (ver rbac.py):
  clientes.ver     → lista e consulta (todos os cargos)
  clientes.editar  → cadastra, edita, arquiva e gera convites (dono, gerente e atendente)

Tabelas: customers + oficina_clientes + oficina_convites (backend/sql/migrations/0003).

Convenções:
  - JSON em camelCase, no formato de `Cliente` (frontend/src/types/cliente.ts); opcionais vazios são omitidos.
  - Cadastro de balcão (origem "oficina"): a oficina edita tudo. Cliente com conta no app (origem "app"):
    a oficina só edita as próprias `observacoes`; nome, documento, telefone, e-mail e endereço são do cliente.
  - Excluir = arquivar o vínculo. O histórico (OS, orçamentos, financeiro) continua apontando para ele.
  - Entrar na carteira de uma conta do app só acontece por convite aceito pelo próprio cliente — a oficina
    nunca "puxa" uma conta do app pelo e-mail/CPF (isso revelaria quem tem conta).
"""
from datetime import datetime, timedelta, timezone

from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import carteira as cart
from .estoque_views import _corpo_valido, _listar_todos, _negado, _nao_encontrado, _uuid_valido
from .views import supabase, require_auth, _now, _oficina_doc_do_token

CONVITES = "oficina_convites"
CONVITE_DIAS_PADRAO = 7
CONVITE_DIAS_MAX = 90


def cliente_para_api(c: dict, v: dict) -> dict:
    out = {
        "id": str(c["id"]),
        "nome": c["name"],
        "createdAt": v.get("created_at") or c.get("created_at"),
        "origem": c.get("origem") or "app",
        "temConta": (c.get("origem") or "app") == "app",
    }
    for chave, valor in (
        ("cpfCnpj", c.get("cpf")), ("telefone", c.get("phone")), ("email", c.get("email")),
        ("endereco", c.get("address")), ("observacoes", v.get("observacoes")),
    ):
        if valor:
            out[chave] = valor
    if c.get("updated_at"):
        out["updatedAt"] = c["updated_at"]
    return out


def _dono_do_cadastro(c: dict, oficina_doc: str) -> bool:
    return c.get("origem") == "oficina" and c.get("oficina_origem_doc") == oficina_doc


@api_view(["GET", "POST"])
@require_auth
@cart.tratar_erros_carteira
def clientes_list(request):
    """
    GET  /clientes  → clientes ativos da carteira (mais novos primeiro)
    POST /clientes  → cadastra cliente de balcão (nome obrigatório; CPF/CNPJ e e-mail únicos por oficina)
    """
    negado = _negado(request, "clientes.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        negado = _negado(request, "clientes.editar")
        if negado:
            return negado
        cols, obs = cart.ler_cliente(request.data)
        criado, vinc, reativado = cart.criar_balcao(oficina_doc, cols, obs)
        return Response(cliente_para_api(criado, vinc),
                        status=http_status.HTTP_200_OK if reativado else http_status.HTTP_201_CREATED)

    return Response([cliente_para_api(c, v) for c, v in cart.carteira_da_oficina(oficina_doc)])


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
@cart.tratar_erros_carteira
def cliente_detail(request, cliente_id):
    """
    GET    /clientes/<id>  → um cliente da carteira
    PATCH  /clientes/<id>  → edição parcial (balcão: tudo; conta do app: só observacoes)
    DELETE /clientes/<id>  → tira da carteira (arquiva o vínculo; nada é apagado)
    """
    negado = _negado(request, "clientes.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(cliente_id):
        return _nao_encontrado("Cliente não encontrado.")
    achado = cart.cliente_da_carteira(oficina_doc, cliente_id)
    if not achado:
        return _nao_encontrado("Cliente não encontrado.")
    c, v = achado

    if request.method == "GET":
        return Response(cliente_para_api(c, v))

    negado = _negado(request, "clientes.editar")
    if negado:
        return negado

    if request.method == "DELETE":
        agora = _now()
        supabase.table(cart.VINCULOS).update({
            "status": "revogado", "revogado_em": agora, "revogado_por": "oficina",
        }).eq("oficina_doc", oficina_doc).eq("customer_id", str(c["id"])).execute()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    cols, obs = cart.ler_cliente(request.data, parcial=True)
    if not _dono_do_cadastro(c, oficina_doc):
        # Conta do app: dados pessoais são do cliente. Aceita o que vier igual (o formulário reenvia tudo).
        atual = {"name": c.get("name"), "cpf": c.get("cpf"), "phone": c.get("phone"),
                 "email": c.get("email"), "address": c.get("address")}
        mudou = [k for k, novo in cols.items() if (novo or None) != (atual.get(k) or None)]
        if mudou:
            return Response(
                {"detail": "Este cliente tem conta no app: nome, documento, telefone, e-mail e endereço "
                           "só ele pode alterar. Você pode editar as observações."},
                status=http_status.HTTP_403_FORBIDDEN)
        cols = {}

    agora = _now()
    if cols:
        # CPF/e-mail únicos por oficina: o banco recusa (23505); aqui traduzimos para o campo certo.
        for coluna, campo in (("cpf", "cpfCnpj"), ("email", "email")):
            if cols.get(coluna):
                outro = cart._achar_balcao(oficina_doc, **{"doc" if coluna == "cpf" else "email": cols[coluna]})
                if outro and str(outro["id"]) != str(c["id"]):
                    raise cart.erro_campo(campo, "Já existe um cliente com este dado.",
                                          http_status.HTTP_409_CONFLICT)
        c = (supabase.table(cart.CLIENTES).update({**cols, "updated_at": agora})
             .eq("id", str(c["id"])).execute().data[0])
    if obs is not None:
        v = (supabase.table(cart.VINCULOS).update({"observacoes": obs}).eq("oficina_doc", oficina_doc)
             .eq("customer_id", str(c["id"])).execute().data[0])
    return Response(cliente_para_api(c, v))


# ── Convites: a oficina entrega (link/QR); o cliente do app escaneia e entra na carteira ─────────

def convite_para_api(row: dict) -> dict:
    agora = datetime.now(timezone.utc)
    expira = datetime.fromisoformat(str(row["expira_em"]).replace("Z", "+00:00"))
    esgotado = row.get("max_usos") is not None and row["usos"] >= row["max_usos"]
    out = {
        "id": str(row["id"]),
        # O código É o id (uuid aleatório, 122 bits): as duas pontas (este backend e o do app do cliente)
        # precisam validá-lo sem compartilhar segredo. Vale por poucos dias, é revogável e só permite
        # entrar na carteira estando logado no app.
        "codigo": str(row["id"]),
        "criadoPorNome": row.get("criado_por_nome") or "",
        "createdAt": row["created_at"],
        "expiraEm": row["expira_em"],
        "usos": row["usos"],
        "ativo": not row.get("revogado_em") and expira > agora and not esgotado,
    }
    if row.get("max_usos") is not None:
        out["maxUsos"] = row["max_usos"]
    if row.get("revogado_em"):
        out["revogadoEm"] = row["revogado_em"]
    return out


@api_view(["GET", "POST"])
@require_auth
@cart.tratar_erros_carteira
def convites_list(request):
    """
    GET  /clientes/convites  → convites da oficina (mais novos primeiro)
    POST /clientes/convites  → gera um convite. Corpo opcional: {"dias": 1..90 (padrão 7), "maxUsos": n | null}
    """
    negado = _negado(request, "clientes.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        dados = request.data if _corpo_valido(request) else {}
        dias, max_usos = dados.get("dias", CONVITE_DIAS_PADRAO), dados.get("maxUsos")
        if isinstance(dias, bool) or not isinstance(dias, int) or not 1 <= dias <= CONVITE_DIAS_MAX:
            raise cart.erro_campo("dias", f"Informe de 1 a {CONVITE_DIAS_MAX} dias.")
        if max_usos is not None and (isinstance(max_usos, bool) or not isinstance(max_usos, int) or max_usos < 1):
            raise cart.erro_campo("maxUsos", "Informe um número inteiro maior que zero (ou deixe vazio).")
        expira = datetime.now(timezone.utc) + timedelta(days=dias)
        criado = supabase.table(CONVITES).insert({
            "oficina_doc": oficina_doc,
            "criado_por_nome": request.admin.get("nome") or "",
            "expira_em": expira.isoformat(),
            "max_usos": max_usos,
        }).execute().data[0]
        return Response(convite_para_api(criado), status=http_status.HTTP_201_CREATED)

    linhas = _listar_todos(lambda: (
        supabase.table(CONVITES).select("*").eq("oficina_doc", oficina_doc)
        .order("created_at", desc=True).order("id")
    ))
    return Response([convite_para_api(l) for l in linhas])


@api_view(["DELETE"])
@require_auth
@cart.tratar_erros_carteira
def convite_detail(request, convite_id):
    """DELETE /clientes/convites/<id>  → revoga o convite (quem já entrou continua na carteira)."""
    negado = _negado(request, "clientes.editar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(convite_id):
        return _nao_encontrado("Convite não encontrado.")
    res = (supabase.table(CONVITES).update({"revogado_em": _now()})
           .eq("id", str(convite_id)).eq("oficina_doc", oficina_doc).execute().data)
    if not res:
        return _nao_encontrado("Convite não encontrado.")
    return Response(status=http_status.HTTP_204_NO_CONTENT)
