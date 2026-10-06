"""
Catálogo de serviços da oficina. Mesmo padrão de estoque_views.py.

Permissões (ver rbac.py):
  servicos.ver     → lista e consulta serviços (todos os cargos)
  servicos.editar  → cria, edita, ativa/desativa e exclui (dono e gerente)

Tabela e função SQL: backend/sql/servicos.sql (rodar uma vez no Supabase).

Convenções de resposta:
  - JSON em camelCase, no formato de ServicoItem (frontend/src/types/servico.ts).
  - PATCH mescla com o que já existe: só manda o que mudou (ex.: {"ativo": false}).
  - Erro de validação: 422 com os erros por campo.
"""
import logging

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .estoque_views import (
    _corpo_valido, _jsonb, _listar_todos, _negado, _nao_encontrado, _uuid_valido,
)
from .serializers import ServicoSerializer
from .views import supabase, require_auth, _oficina_doc_do_token

logger = logging.getLogger(__name__)

SERVICOS = "servicos"

# Tabela/função que o banco ainda não conhece = servicos.sql não foi rodado.
CODIGOS_OBJETO_INEXISTENTE = {"42P01", "42883", "PGRST205", "PGRST202"}


def _tratar_erros_banco(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except APIError as e:
            codigo = getattr(e, "code", None)
            if codigo in CODIGOS_OBJETO_INEXISTENTE:
                logger.error("Serviços: objeto do banco não encontrado (%s): %s", codigo, getattr(e, "message", e))
                return Response(
                    {"detail": "A tabela de serviços ainda não existe no banco. "
                               "Rode backend/sql/servicos.sql no SQL Editor do Supabase."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if codigo == "42501":
                logger.error("Serviços: permissão negada no banco. A SUPABASE_KEY precisa ser a service_role "
                             "(ou rode os GRANTs de servicos.sql).")
                return Response(
                    {"detail": "O backend não tem permissão para acessar o banco. Confira a chave no supabase.env."},
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            logger.exception("Serviços: erro do banco (%s)", codigo)
            return Response({"detail": "Erro ao acessar o banco de dados."},
                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    wrapper.__name__ = view_func.__name__
    return wrapper


def servico_para_api(row: dict) -> dict:
    out = {
        "id": str(row["id"]),
        "nome": row["nome"],
        "categoria": row["categoria"],
        "preco": _num(row["preco"]),
        "duracao": row.get("duracao") or "",
        "descricao": row.get("descricao") or "",
        "ativo": bool(row["ativo"]),
        "createdAt": row["created_at"],
    }
    if row.get("updated_at"):
        out["updatedAt"] = row["updated_at"]
    return out


def _num(valor):
    n = float(valor)
    return int(n) if n.is_integer() else n


@api_view(["GET", "POST"])
@require_auth
@_tratar_erros_banco
def servicos_list(request):
    """
    GET  /servicos  → lista os serviços da oficina (mais novos primeiro)
    POST /servicos  → cadastra um serviço
    """
    negado = _negado(request, "servicos.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        negado = _negado(request, "servicos.editar")
        if negado:
            return negado
        serializer = ServicoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
        row = {**serializer.validated_data, "oficina_doc": oficina_doc}
        criado = supabase.table(SERVICOS).insert(row).execute().data[0]
        return Response(servico_para_api(criado), status=http_status.HTTP_201_CREATED)

    linhas = _listar_todos(lambda: (
        supabase.table(SERVICOS).select("*").eq("oficina_doc", oficina_doc)
        .order("created_at", desc=True).order("id")
    ))
    return Response([servico_para_api(l) for l in linhas])


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
@_tratar_erros_banco
def servico_detail(request, servico_id):
    """
    GET    /servicos/<id>  → um serviço
    PATCH  /servicos/<id>  → edição parcial (mescla com o que já existe)
    DELETE /servicos/<id>  → exclui; kits de estoque ligados a ele ficam sem vínculo
    """
    negado = _negado(request, "servicos.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if not _uuid_valido(servico_id):
        return _nao_encontrado("Serviço não encontrado.")
    res = (
        supabase.table(SERVICOS).select("*")
        .eq("id", servico_id).eq("oficina_doc", oficina_doc).limit(1).execute()
    )
    if not res.data:
        return _nao_encontrado("Serviço não encontrado.")
    atual = res.data[0]

    if request.method == "GET":
        return Response(servico_para_api(atual))

    negado = _negado(request, "servicos.editar")
    if negado:
        return negado

    if request.method == "DELETE":
        resultado = _jsonb(supabase.rpc("servicos_excluir", {
            "p_oficina_doc": oficina_doc,
            "p_servico_id": servico_id,
        }).execute().data)
        if not resultado["ok"]:
            return _nao_encontrado(resultado.get("mensagem") or "Serviço não encontrado.")
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    if not _corpo_valido(request):
        return Response({"detail": "Corpo da requisição inválido."}, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    serializer = ServicoSerializer(data={**servico_para_api(atual), **request.data})
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)
    atualizado = (
        supabase.table(SERVICOS).update(dict(serializer.validated_data))
        .eq("id", servico_id).eq("oficina_doc", oficina_doc).execute().data
    )
    if not atualizado:
        return _nao_encontrado("Serviço não encontrado.")
    return Response(servico_para_api(atualizado[0]))
