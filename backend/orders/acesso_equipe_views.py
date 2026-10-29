"""
Acesso da equipe — login de funcionário em qualquer aparelho.

O login de funcionário (nome + PIN) precisa saber de qual oficina listar os nomes. Antes isso era o
CNPJ digitado e guardado no navegador de cada aparelho; num computador novo o funcionário tinha que
saber o CNPJ de cabeça. Agora a oficina tem um CÓDIGO CURTO (admins.codigo_acesso, migração
backend/sql/migrations/0006_codigo_acesso_equipe.sql) e um link /f/<código> que pareia o aparelho
sozinho e já abre a lista de nomes.

Rotas da OFICINA (login; funcionarios.gerenciar — só o dono por padrão):
  GET    /oficina/acesso-equipe             {codigo: "ABCD2345" | null}
  POST   /oficina/acesso-equipe             {renovar?: bool} gera o código (ou devolve o atual);
                                            `renovar` troca por outro e o antigo para de valer.
                                            201 novo, 200 já existia.
  DELETE /oficina/acesso-equipe             desativa o link (código vira null). 204.

Rota PÚBLICA (sem login — ninguém logou ainda):
  GET    /publico/oficina/<codigo>          {oficinaDoc, nome} da oficina dona do código

Segurança
  • O código tem 8 caracteres de um alfabeto de 31 (≈ 8,5e11 combinações), gerados com `secrets`.
  • Quem acerta o código só descobre o que o CNPJ já mostra (nome da oficina e quem trabalha lá:
    nome/cargo, nunca PIN nem e-mail). O PIN continua protegido pelo bloqueio anti-força-bruta.
  • Formato inválido é descartado ANTES de tocar no banco; código errado e código desativado
    respondem o mesmo 404 (não revela nada). Limite de tentativas por IP.
  • Respostas com `Cache-Control: no-store`, `X-Robots-Tag: noindex` e `Referrer-Policy: no-referrer`.
"""
import logging
import re
import secrets

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .estoque_views import _corpo_valido, _negado
from .orcamento_link_views import _ip, _liberado, _muitas_tentativas
from .views import supabase, require_auth, _oficina_doc_do_token

logger = logging.getLogger(__name__)

# Sem 0/O, 1/I/L: o código vai ser lido em voz alta ou digitado do papel.
ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
TAMANHO = 8
_FORMATO = re.compile(rf"^[{ALFABETO}]{{{TAMANHO}}}$")

COLUNA_AUSENTE = ("42703", "PGRST204")
CONFLITO_UNICO = "23505"
TENTATIVAS_GERAR = 5

CONSULTAS_POR_IP = 30          # por minuto
JANELA_S = 60


def novo_codigo() -> str:
    return "".join(secrets.choice(ALFABETO) for _ in range(TAMANHO))


def normalizar(codigo) -> str:
    """'abcd-2345' → 'ABCD2345'. O que não for string vira '' (e não passa no formato)."""
    if not isinstance(codigo, str):
        return ""
    return re.sub(r"[\s-]", "", codigo).upper()


def _sem_cache(resposta: Response) -> Response:
    resposta["Cache-Control"] = "no-store"
    resposta["X-Robots-Tag"] = "noindex"
    resposta["Referrer-Policy"] = "no-referrer"
    return resposta


def _sem_coluna():
    return Response(
        {"detail": "O código de acesso ainda não existe no banco. "
                   "Rode backend/sql/migrations/0006_codigo_acesso_equipe.sql no SQL Editor do Supabase."},
        status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _codigo_atual(oficina_doc: str):
    """(achou_oficina, código). Levanta APIError se a coluna não existir."""
    linhas = (supabase.table("admins").select("codigo_acesso")
              .eq("doc", oficina_doc).limit(1).execute().data)
    if not linhas:
        return False, None
    return True, linhas[0].get("codigo_acesso")


def _gravar_codigo(oficina_doc: str, codigo):
    return supabase.table("admins").update({"codigo_acesso": codigo}).eq("doc", oficina_doc).execute()


@api_view(["GET", "POST", "DELETE"])
@require_auth
def acesso_equipe(request):
    negado = _negado(request, "funcionarios.gerenciar")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    try:
        achou, atual = _codigo_atual(oficina_doc)
    except APIError as e:
        if getattr(e, "code", None) in COLUNA_AUSENTE:
            logger.warning("Acesso da equipe: admins.codigo_acesso ausente; rode a migração 0006.")
            return _sem_coluna()
        raise
    if not achou:
        return Response({"detail": "Oficina não encontrada"}, status=http_status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return _sem_cache(Response({"codigo": atual}))

    if request.method == "DELETE":
        _gravar_codigo(oficina_doc, None)
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    # POST
    corpo = request.data if _corpo_valido(request) else {}
    renovar = corpo.get("renovar") is True
    if atual and not renovar:
        return _sem_cache(Response({"codigo": atual}, status=http_status.HTTP_200_OK))

    for _ in range(TENTATIVAS_GERAR):
        codigo = novo_codigo()
        try:
            _gravar_codigo(oficina_doc, codigo)
        except APIError as e:
            if getattr(e, "code", None) == CONFLITO_UNICO:      # outra oficina já tem esse (raríssimo)
                continue
            raise
        return _sem_cache(Response(
            {"codigo": codigo},
            status=http_status.HTTP_200_OK if atual else http_status.HTTP_201_CREATED,
        ))
    return Response({"detail": "Não foi possível gerar o código. Tente de novo."},
                    status=http_status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["GET"])
def publico_oficina_por_codigo(request, codigo):
    """Resolve o código do link /f/<código> na oficina. Sem login."""
    if not _liberado(f"acesso-equipe:ip:{_ip(request)}", CONSULTAS_POR_IP, JANELA_S):
        return _sem_cache(_muitas_tentativas())

    codigo = normalizar(codigo)
    nao_achou = _sem_cache(Response({"detail": "Código inválido ou desativado."},
                                    status=http_status.HTTP_404_NOT_FOUND))
    if not _FORMATO.match(codigo):
        return nao_achou

    try:
        linhas = (supabase.table("admins").select("doc,nome")
                  .eq("codigo_acesso", codigo).limit(1).execute().data)
    except APIError as e:
        if getattr(e, "code", None) in COLUNA_AUSENTE:
            logger.warning("Acesso da equipe: admins.codigo_acesso ausente; rode a migração 0006.")
            return _sem_cache(Response({"detail": "Acesso por link indisponível no momento."},
                                       status=http_status.HTTP_503_SERVICE_UNAVAILABLE))
        raise
    if not linhas:
        return nao_achou
    return _sem_cache(Response({"oficinaDoc": linhas[0]["doc"], "nome": linhas[0].get("nome") or ""}))
