"""
Dados da oficina (tela Configurações): nome comercial, telefone, e-mail de atendimento, endereço,
taxa de mão de obra e horário de funcionamento. Ficam em `admins.config_oficina` (jsonb, migração
backend/sql/migrations/0005_config_oficina.sql). Antes viviam só no navegador (localStorage
'oficina_config'), que continua como cópia local: a Agenda lê o horário de lá.

Rotas:
  GET /oficina/config  → qualquer usuário logado (a Agenda de todos os cargos usa o horário)
  PUT /oficina/config  → configuracoes.editar; corpo inteiro (OficinaConfigSerializer), substitui

Resposta (camelCase): nome, cnpj, telefone, email, endereco, valorHora, horaAbertura, horaFechamento,
`salvo` (false = a oficina ainda não salvou nada no servidor) e `atualizadoEm`.
O CNPJ é o da conta (`admins.doc`, o login) e não se edita aqui. Sem nada salvo, `nome` vem do
nome da conta e o horário é o padrão da Agenda.
Sem a coluna (0005 não rodada): GET responde `salvo: false` com os padrões; PUT → 503.
"""
import logging

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .estoque_views import _corpo_valido, _negado
from .serializers import OficinaConfigSerializer
from .views import supabase, require_auth, _now, _oficina_doc_do_token

logger = logging.getLogger(__name__)

HORA_ABERTURA_PADRAO = "08:00"     # mesmos padrões de frontend/src/utils/agenda.ts
HORA_FECHAMENTO_PADRAO = "19:00"
COLUNA_AUSENTE = ("42703", "PGRST204")


def config_para_api(admin: dict) -> dict:
    salvo = admin.get("config_oficina") if isinstance(admin.get("config_oficina"), dict) else None
    c = salvo or {}
    return {
        "nome": c.get("nome") or admin.get("nome") or "",
        "cnpj": admin.get("doc") or "",
        "telefone": c.get("telefone") or "",
        "email": c.get("email") or "",
        "endereco": c.get("endereco") or "",
        "valorHora": c.get("valorHora") or 0,
        "horaAbertura": c.get("horaAbertura") or HORA_ABERTURA_PADRAO,
        "horaFechamento": c.get("horaFechamento") or HORA_FECHAMENTO_PADRAO,
        "salvo": salvo is not None,
        "atualizadoEm": admin.get("config_oficina_em"),
    }


def _admin(oficina_doc: str, colunas: str):
    linhas = supabase.table("admins").select(colunas).eq("doc", oficina_doc).limit(1).execute().data
    return linhas[0] if linhas else None


@api_view(["GET", "PUT"])
@require_auth
def oficina_config(request):
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "GET":
        try:
            admin = _admin(oficina_doc, "nome,doc,config_oficina,config_oficina_em")
        except APIError as e:
            if getattr(e, "code", None) not in COLUNA_AUSENTE:
                raise
            logger.warning("Configurações: admins.config_oficina ausente; rode a migração 0005.")
            admin = _admin(oficina_doc, "nome,doc")
        if admin is None:
            return Response({"detail": "Oficina não encontrada"}, status=http_status.HTTP_404_NOT_FOUND)
        return Response(config_para_api(admin))

    negado = _negado(request, "configuracoes.editar")
    if negado:
        return negado
    if not _corpo_valido(request):
        return Response({"detail": "Corpo inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
    serializer = OficinaConfigSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http_status.HTTP_422_UNPROCESSABLE_ENTITY)

    try:
        res = (supabase.table("admins")
               .update({"config_oficina": dict(serializer.validated_data), "config_oficina_em": _now()})
               .eq("doc", oficina_doc).execute())
    except APIError as e:
        if getattr(e, "code", None) in COLUNA_AUSENTE:
            return Response(
                {"detail": "Os dados da oficina ainda não existem no banco. "
                           "Rode backend/sql/migrations/0005_config_oficina.sql no SQL Editor do Supabase."},
                status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        raise
    if not res.data:
        return Response({"detail": "Oficina não encontrada"}, status=http_status.HTTP_404_NOT_FOUND)
    return Response(config_para_api(res.data[0]))
