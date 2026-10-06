"""
Estoque: itens, kits (receitas) e movimentações. Arquivo separado de views.py
(mesmo padrão de financeiro_views.py): reaproveita supabase/require_auth/etc.

Permissões (ver rbac.py):
  estoque.ver     → lista e consulta itens, kits e movimentações
  estoque.editar  → cria, edita e exclui itens e kits, aplica kit (dá baixa)

Tabelas e funções SQL: backend/sql/estoque.sql (rodar uma vez no Supabase).

Por que parte da lógica vive em funções Postgres (supabase.rpc) e não aqui:
aplicar kit, ajustar quantidade e salvar kit mexem em mais de uma tabela e
precisam ser tudo-ou-nada, com trava de linha pra duas pessoas não baixarem a
mesma peça ao mesmo tempo. O supabase-py não tem transação entre chamadas
separadas. O resto (CRUD simples de uma tabela só) fica aqui, como no
financeiro.

Convenções de resposta:
  - JSON em camelCase, no formato dos tipos de frontend/src/types/estoque.ts.
  - Campos opcionais sem valor são OMITIDOS (o TypeScript trata como undefined).
  - Pra LIMPAR um campo opcional numa edição (ex.: remover a foto), mande
    `null` explicitamente. Chave ausente significa "não mexer".
  - Erro de validação: 422 com os erros por campo. Regra de negócio ao aplicar
    kit (estoque insuficiente, quarentena...) volta 200 com {ok:false,mensagem},
    que é o formato de ResultadoAplicarKit no frontend.
"""
import json
import logging
import uuid as uuid_lib
from datetime import datetime

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import EstoqueItemSerializer, EstoqueKitSerializer
from .views import supabase, require_auth, require_permission, _oficina_doc_do_token

logger = logging.getLogger(__name__)

ITENS = "estoque_itens"
KITS = "estoque_kits"
KIT_ITENS = "estoque_kit_itens"
MOVIMENTOS = "estoque_movimentos"

# O PostgREST devolve no máximo ~1000 linhas por chamada (limite do projeto
# Supabase), sem avisar. Listagens páginam por aqui pra nunca truncar em silêncio.
TAMANHO_PAGINA = 1000

# Tabela/função que o banco ainda não conhece = estoque.sql não foi rodado
# (ou o cache do PostgREST ainda não atualizou).
CODIGOS_OBJETO_INEXISTENTE = {"42P01", "42883", "PGRST205", "PGRST202"}
# Apagar um item que está numa receita: ON DELETE RESTRICT (23001) ou FK (23503).
CODIGOS_REFERENCIADO = {"23001", "23503"}


# ── Infra ─────────────────────────────────────────────────────────────────────

def _tratar_erros_banco(view_func):
    """Erro do Supabase vira JSON limpo em vez de 500 cru. O caso mais provável
    no primeiro uso é o SQL ainda não ter sido rodado — a mensagem diz isso."""
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            if codigo in CODIGOS_OBJETO_INEXISTENTE:
                logger.error("Estoque: objeto do banco não encontrado (%s): %s", codigo, getattr(e, "message", e))
                return Response(
                    {"detail": "As tabelas de estoque ainda não existem no banco. "
                               "Rode backend/sql/estoque.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo == "42501":
                logger.error("Estoque: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role.")
                return Response(
                    {"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            logger.exception("Estoque: erro do banco (%s)", codigo)
            return Response(
                {"detail": "Erro ao acessar o banco de dados."},
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    wrapper.__name__ = view_func.__name__
    return wrapper


def _negado(request, permissao):
    if permissao not in request.admin.get("permissoes", []):
        return Response({"detail": "Você não tem permissão para isso"}, status=http_status.HTTP_403_FORBIDDEN)
    return None


def _nao_encontrado(msg="Não encontrado"):
    return Response({"detail": msg}, status=http_status.HTTP_404_NOT_FOUND)


def _uuid_valido(valor) -> bool:
    try:
        uuid_lib.UUID(str(valor))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _listar_todos(consulta):
    """`consulta` é uma função sem argumentos que devolve um query builder NOVO
    (já ordenado de forma estável). Percorre as páginas até acabar."""
    linhas, inicio = [], 0
    while True:
        dados = consulta().range(inicio, inicio + TAMANHO_PAGINA - 1).execute().data or []
        linhas.extend(dados)
        if len(dados) < TAMANHO_PAGINA:
            return linhas
        inicio += TAMANHO_PAGINA


def _jsonb(dado):
    """supabase.rpc devolve o jsonb já como dict; por garantia aceita string."""
    return json.loads(dado) if isinstance(dado, str) else dado


def _corpo_valido(request) -> bool:
    return isinstance(request.data, dict)


# ── Mapeadores: linha do banco → JSON do frontend ─────────────────────────────

def _num(valor):
    """numeric do Postgres chega como float; 12.0 vira 12 (mais limpo no JSON)."""
    n = float(valor)
    return int(n) if n.is_integer() else n


def item_para_api(row: dict) -> dict:
    out = {
        "id": str(row["id"]),
        "nome": row["nome"],
        "categoria": row["categoria"],
        "quantidade": _num(row["quantidade"]),
        "minimo": _num(row["minimo"]),
        "preco": _num(row["preco"]),
        "localizacao": row.get("localizacao") or "",
        "status": row["status"],
        "createdAt": row["created_at"],
    }
    for chave, coluna in (
        ("descricao", "descricao"),
        ("aplicacao", "aplicacao"),
        ("fotoDataUrl", "foto_data_url"),
        ("updatedAt", "updated_at"),
    ):
        if row.get(coluna):
            out[chave] = row[coluna]
    if row["status"] == "quarentena":
        out["quarentena"] = {
            "motivo": row.get("quarentena_motivo") or "",
            "fornecedor": row.get("quarentena_fornecedor") or "",
            "dataEntrada": row.get("quarentena_data_entrada") or row["created_at"],
        }
    return out


def movimento_para_api(row: dict) -> dict:
    out = {
        "id": str(row["id"]),
        "itemId": str(row["item_id"]),
        "tipo": row["tipo"],
        "quantidade": _num(row["quantidade"]),
        "motivo": row.get("motivo") or "",
        "criadoEm": row["criado_em"],
    }
    if row.get("ordem_servico_id"):
        out["ordemId"] = row["ordem_servico_id"]
    return out


def kit_para_api(row: dict, receita: list) -> dict:
    """`receita`: linhas com item_id e quantidade (e posicao, se vier da tabela)."""
    ordenada = sorted(receita, key=lambda r: r.get("posicao", 0))
    out = {
        "id": str(row["id"]),
        "nome": row["nome"],
        "itens": [{"itemId": str(r["item_id"]), "quantidade": _num(r["quantidade"])} for r in ordenada],
        "createdAt": row["created_at"],
    }
    for chave, coluna in (
        ("descricao", "descricao"),
        ("servicoId", "servico_id"),
        ("fotoDataUrl", "foto_data_url"),
        ("updatedAt", "updated_at"),
    ):
        if row.get(coluna):
            out[chave] = row[coluna]
    return out


# ── Acesso a dados ────────────────────────────────────────────────────────────

def _buscar_item(item_id: str, oficina_doc: str):
    res = supabase.table(ITENS).select("*").eq("id", item_id).eq("oficina_doc", oficina_doc).limit(1).execute()
    return res.data[0] if res.data else None


def _receita_do_kit(kit_id: str, oficina_doc: str) -> list:
    return (
        supabase.table(KIT_ITENS)
        .select("item_id,quantidade,posicao")
        .eq("kit_id", kit_id)
        .eq("oficina_doc", oficina_doc)
        .execute()
        .data
        or []
    )


def _buscar_kit(kit_id: str, oficina_doc: str):
    """(kit_api, None) ou (None, Response 404)."""
    res = supabase.table(KITS).select("*").eq("id", kit_id).eq("oficina_doc", oficina_doc).limit(1).execute()
    if not res.data:
        return None, _nao_encontrado("Kit não encontrado.")
    return kit_para_api(res.data[0], _receita_do_kit(kit_id, oficina_doc)), None


def _salvar_kit(oficina_doc: str, kit_id, dados: dict):
    """Chama estoque_salvar_kit. Devolve (resultado_dict)."""
    res = supabase.rpc("estoque_salvar_kit", {
        "p_oficina_doc": oficina_doc,
        "p_kit_id": kit_id,
        "p_nome": dados["nome"],
        "p_descricao": dados.get("descricao"),
        "p_servico_id": dados.get("servico_id"),
        "p_foto_data_url": dados.get("foto_data_url"),
        "p_itens": dados["itens"],
    }).execute()
    return _jsonb(res.data)


# ── Itens ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@require_auth
@_tratar_erros_banco
def estoque_list(request):
    """
    GET  /estoque  → lista os itens da oficina (mais novos primeiro)
    POST /estoque  → cadastra um item; se vier com quantidade, registra a
                     entrada 'Cadastro inicial' no log de movimentações
    """
    negado = _negado(request, "estoque.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        negado = _negado(request, "estoque.editar")
        if negado:
            return negado

        serializer = EstoqueItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

        row = {**serializer.validated_data, "oficina_doc": oficina_doc}
        criado = supabase.table(ITENS).insert(row).execute().data[0]

        if float(criado["quantidade"]) > 0:
            try:
                supabase.table(MOVIMENTOS).insert({
                    "oficina_doc": oficina_doc,
                    "item_id": criado["id"],
                    "tipo": "entrada",
                    "quantidade": criado["quantidade"],
                    "motivo": "Cadastro inicial",
                }).execute()
            except Exception:
                # Item sem o log da entrada inicial deixaria o histórico
                # incoerente: desfaz o cadastro em vez de seguir pela metade.
                logger.exception("Estoque: falha ao registrar entrada inicial; desfazendo cadastro")
                try:
                    supabase.table(ITENS).delete().eq("id", criado["id"]).eq("oficina_doc", oficina_doc).execute()
                except Exception:
                    logger.exception("Estoque: não foi possível desfazer o cadastro do item %s", criado["id"])
                return Response(
                    {"detail": "Não foi possível registrar a entrada inicial do item. Nada foi salvo."},
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response(item_para_api(criado), status=http_status.HTTP_201_CREATED)

    linhas = _listar_todos(lambda: (
        supabase.table(ITENS).select("*").eq("oficina_doc", oficina_doc)
        .order("created_at", desc=True).order("id")
    ))
    return Response([item_para_api(l) for l in linhas])


@api_view(["GET"])
@require_auth
@_tratar_erros_banco
def movimentos_list(request):
    """
    GET /estoque/movimentos[?desde=<data ISO>]  → log de movimentações
    (mais recentes primeiro). `desde` limita pelo início do período.
    """
    negado = _negado(request, "estoque.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    desde = request.query_params.get("desde")
    if desde:
        try:
            datetime.fromisoformat(desde.replace("Z", "+00:00"))
        except ValueError:
            return Response({"desde": ["Data inválida (use o formato ISO, ex.: 2026-10-01)."]},
                            status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    def consulta():
        q = supabase.table(MOVIMENTOS).select("*").eq("oficina_doc", oficina_doc)
        if desde:
            q = q.gte("criado_em", desde)
        return q.order("criado_em", desc=True).order("id")

    return Response([movimento_para_api(m) for m in _listar_todos(consulta)])


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
@_tratar_erros_banco
def estoque_detail(request, item_id):
    """
    GET    /estoque/<id>  → um item
    PATCH  /estoque/<id>  → edição parcial (mescla com o que já existe). Se a
                            quantidade mudar, registra um movimento 'ajuste'
    DELETE /estoque/<id>  → exclui (recusado se o item faz parte de algum kit)
    """
    negado = _negado(request, "estoque.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if not _uuid_valido(item_id):
        return _nao_encontrado("Item não encontrado.")
    atual = _buscar_item(item_id, oficina_doc)
    if not atual:
        return _nao_encontrado("Item não encontrado.")

    if request.method == "GET":
        return Response(item_para_api(atual))

    negado = _negado(request, "estoque.editar")
    if negado:
        return negado

    if request.method == "DELETE":
        referencias = (
            supabase.table(KIT_ITENS).select("kit_id")
            .eq("oficina_doc", oficina_doc).eq("item_id", item_id).execute().data or []
        )
        if referencias:
            return _item_em_kits(oficina_doc, [r["kit_id"] for r in referencias])
        try:
            supabase.table(ITENS).delete().eq("id", item_id).eq("oficina_doc", oficina_doc).execute()
        except APIError as e:
            if getattr(e, "code", None) in CODIGOS_REFERENCIADO:
                # Alguém colocou o item num kit entre a checagem e a exclusão.
                referencias = (
                    supabase.table(KIT_ITENS).select("kit_id")
                    .eq("oficina_doc", oficina_doc).eq("item_id", item_id).execute().data or []
                )
                return _item_em_kits(oficina_doc, [r["kit_id"] for r in referencias])
            raise
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    # PATCH — mescla com o estado atual e valida tudo junto, reaproveitando as
    # mesmas regras da criação sem apagar campo que não veio no payload.
    if not _corpo_valido(request):
        return Response({"detail": "Corpo da requisição inválido."}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    serializer = EstoqueItemSerializer(data={**item_para_api(atual), **request.data})
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = dict(serializer.validated_data)
    nova_quantidade = dados.pop("quantidade")

    # Quantidade passa pela função do banco: troca + log 'ajuste' atômicos.
    if round(float(atual["quantidade"]), 3) != nova_quantidade:
        resultado = _jsonb(supabase.rpc("estoque_ajustar_quantidade", {
            "p_oficina_doc": oficina_doc,
            "p_item_id": item_id,
            "p_nova_quantidade": nova_quantidade,
        }).execute().data)
        if not resultado["ok"]:
            if resultado.get("codigo") == "nao_encontrado":
                return _nao_encontrado("Item não encontrado.")
            return Response({"detail": resultado["mensagem"]}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    atualizado = (
        supabase.table(ITENS).update(dados)
        .eq("id", item_id).eq("oficina_doc", oficina_doc).execute().data
    )
    if not atualizado:
        return _nao_encontrado("Item não encontrado.")
    return Response(item_para_api(atualizado[0]))


def _item_em_kits(oficina_doc: str, kit_ids: list):
    nomes = []
    if kit_ids:
        nomes = [
            k["nome"] for k in (
                supabase.table(KITS).select("nome")
                .eq("oficina_doc", oficina_doc).in_("id", kit_ids).execute().data or []
            )
        ]
    onde = ", ".join(sorted(nomes)) if nomes else "um ou mais kits"
    return Response(
        {"detail": f"Este item faz parte do(s) kit(s): {onde}. Remova-o do(s) kit(s) antes de excluir."},
        status=http_status.HTTP_409_CONFLICT,
    )


# ── Kits ──────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@require_auth
@_tratar_erros_banco
def kits_list(request):
    """
    GET  /kits  → lista os kits com a receita de cada um
    POST /kits  → cria um kit (receita obrigatória, sem item repetido)
    """
    negado = _negado(request, "estoque.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        negado = _negado(request, "estoque.editar")
        if negado:
            return negado

        serializer = EstoqueKitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

        resultado = _salvar_kit(oficina_doc, None, serializer.validated_data)
        if not resultado["ok"]:
            return Response({"detail": resultado["mensagem"]}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
        return Response(kit_para_api(resultado["kit"], resultado["itens"]), status=http_status.HTTP_201_CREATED)

    kits = _listar_todos(lambda: (
        supabase.table(KITS).select("*").eq("oficina_doc", oficina_doc)
        .order("created_at", desc=True).order("id")
    ))
    receitas = _listar_todos(lambda: (
        supabase.table(KIT_ITENS).select("kit_id,item_id,quantidade,posicao")
        .eq("oficina_doc", oficina_doc).order("kit_id").order("item_id")
    ))
    por_kit: dict = {}
    for r in receitas:
        por_kit.setdefault(str(r["kit_id"]), []).append(r)
    return Response([kit_para_api(k, por_kit.get(str(k["id"]), [])) for k in kits])


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
@_tratar_erros_banco
def kit_detail(request, kit_id):
    """
    GET    /kits/<id>  → um kit com a receita
    PATCH  /kits/<id>  → edição parcial; se mandar `itens`, a receita inteira é substituída
    DELETE /kits/<id>  → exclui o kit (a receita vai junto; o estoque não muda)
    """
    negado = _negado(request, "estoque.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if not _uuid_valido(kit_id):
        return _nao_encontrado("Kit não encontrado.")
    atual, erro = _buscar_kit(kit_id, oficina_doc)
    if erro:
        return erro

    if request.method == "GET":
        return Response(atual)

    negado = _negado(request, "estoque.editar")
    if negado:
        return negado

    if request.method == "DELETE":
        supabase.table(KITS).delete().eq("id", kit_id).eq("oficina_doc", oficina_doc).execute()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    if not _corpo_valido(request):
        return Response({"detail": "Corpo da requisição inválido."}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    serializer = EstoqueKitSerializer(data={**atual, **request.data})
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    resultado = _salvar_kit(oficina_doc, kit_id, serializer.validated_data)
    if not resultado["ok"]:
        if resultado.get("codigo") == "nao_encontrado":
            return _nao_encontrado("Kit não encontrado.")
        return Response({"detail": resultado["mensagem"]}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    return Response(kit_para_api(resultado["kit"], resultado["itens"]))


@api_view(["POST"])
@require_permission("estoque.editar")
@_tratar_erros_banco
def kit_aplicar(request, kit_id):
    """
    POST /kits/<id>/aplicar  → dá baixa em todos os componentes do kit e
    registra uma saída por componente. Tudo-ou-nada (função do banco).

    Sucesso:  200 {ok:true, itens:[...itens atualizados], movimentos:[...novos]}
    Rejeição: 200 {ok:false, mensagem}  (estoque insuficiente, quarentena...)
    """
    oficina_doc = _oficina_doc_do_token(request.admin)

    if not _uuid_valido(kit_id):
        return _nao_encontrado("Kit não encontrado.")

    resultado = _jsonb(supabase.rpc("estoque_aplicar_kit", {
        "p_oficina_doc": oficina_doc,
        "p_kit_id": kit_id,
    }).execute().data)

    if resultado["ok"]:
        return Response({
            "ok": True,
            "itens": [item_para_api(i) for i in resultado["itens"]],
            "movimentos": [movimento_para_api(m) for m in resultado["movimentos"]],
        })
    if resultado.get("codigo") == "nao_encontrado":
        return _nao_encontrado("Kit não encontrado.")
    return Response({"ok": False, "mensagem": resultado["mensagem"]})
