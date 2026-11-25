"""
Busca global do painel (atalho ⌘K / Ctrl+K na top-bar): GET /busca?q=<texto>.

Procura, na oficina do token, em três grupos — cada um só aparece se o cargo puder ver aquele módulo:
  clientes   → clientes.ver   (nome, telefone, CPF/CNPJ, e-mail)
  veiculos   → clientes.ver   (placa, marca, modelo) — veículo é dado do cliente (mesma regra de veiculos_views)
  ordens     → ordens.ver     (nº da OS, nome do cliente, placa, modelo)

Resposta (camelCase). Cada grupo traz no máximo LIMITE_POR_GRUPO itens, já ordenados por relevância,
e o `total` de correspondências (para a tela mostrar "+N"):
  { "clientes": {"itens": [{"tipo","id","titulo","subtitulo"}], "total": 7}, "veiculos": {...}, "ordens": {...},
    "indisponiveis": ["ordens"] }          ← só quando um grupo falhou no banco; os demais seguem normais

Decisões:
  - O resultado é só um RESUMO (id + texto). A tela abre o registro pelo id na lista que ela mesma já carrega.
  - Sem migração: traz só as colunas leves (nada de fotos em data URL) e filtra aqui, ignorando acento e caixa.
    Se a oficina crescer a ponto de pesar, o próximo passo é uma função SQL com unaccent (migração nova).
  - Isolamento por oficina vem do token; cliente arquivado e veículo excluído não aparecem (mesma regra das telas).
  - A falha do banco em UM grupo (tabela/coluna ausente) não derruba a busca inteira.
"""
import logging
import re
import unicodedata

from postgrest.exceptions import APIError
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import carteira as cart
from .estoque_views import _listar_todos
from .veiculos_views import VEICULOS
from .views import supabase, require_auth, _oficina_doc_do_token

logger = logging.getLogger(__name__)

MIN_CARACTERES = 2
LIMITE_POR_GRUPO = 5
MAX_CONSULTA = 80  # evita varrer a lista com um texto absurdo

COLUNAS_CLIENTE = "id,name,cpf,phone,email"
COLUNAS_VEICULO = "id,plate,plate_norm,brand,model,year,customer_id,deleted,created_at,oficina_origem_doc"
COLUNAS_ORDEM = "id,os_num,placa,modelo,cliente,status,created_at"


# ── Normalização e pontuação ──────────────────────────────────────────────────

def _sem_acento(valor) -> str:
    base = unicodedata.normalize("NFKD", str(valor or ""))
    return "".join(ch for ch in base if not unicodedata.combining(ch)).casefold()


def _texto(valor) -> str:
    """Minúsculo, sem acento e com espaços colapsados: 'José  da Silva' → 'jose da silva'."""
    return re.sub(r"\s+", " ", _sem_acento(valor)).strip()


def _codigo(valor) -> str:
    """Só letras e números, minúsculo: 'ABC-1D23' → 'abc1d23', '(11) 99999-0000' → '11999990000'."""
    return re.sub(r"[^a-z0-9]", "", _sem_acento(valor))


class Consulta:
    """O texto digitado, preparado uma vez para comparar com todas as linhas."""

    def __init__(self, bruto: str):
        self.texto = _texto(bruto)
        self.tokens = self.texto.split()
        self.codigo = _codigo(bruto)
        # Trecho de letras puras ('ana') não vira busca por código: só com algum número ou 3+ caracteres.
        self.busca_codigo = len(self.codigo) >= 3 or bool(re.search(r"\d", self.codigo))

    def pontuar(self, nomes, codigos) -> int:
        """0 = não casa. Maior = mais relevante: código exato > prefixo de código > prefixo de nome > o resto."""
        melhor = 0
        if self.busca_codigo and self.codigo:
            for c in codigos:
                c = _codigo(c)
                if not c:
                    continue
                if c == self.codigo:
                    melhor = max(melhor, 100)
                elif c.startswith(self.codigo):
                    melhor = max(melhor, 80)
                elif self.codigo in c:
                    melhor = max(melhor, 50)
        if self.tokens:
            for nome in nomes:
                n = _texto(nome)
                if not n or not all(t in n for t in self.tokens):
                    continue
                if n == self.texto:
                    melhor = max(melhor, 90)
                elif n.startswith(self.texto):
                    melhor = max(melhor, 70)
                elif any(p.startswith(self.tokens[0]) for p in n.split()):
                    melhor = max(melhor, 55)
                else:
                    melhor = max(melhor, 30)
        return melhor


def _melhores(linhas, pontuar, montar):
    """Pontua, descarta o que não casa, ordena (estável: a ordem original — mais novos primeiro — desempata)."""
    pontuadas = [(pontuar(l), i, l) for i, l in enumerate(linhas)]
    casadas = sorted((p for p in pontuadas if p[0] > 0), key=lambda p: (-p[0], p[1]))
    return {"itens": [montar(l) for _, _, l in casadas[:LIMITE_POR_GRUPO]], "total": len(casadas)}


# ── Dados leves de cada grupo ─────────────────────────────────────────────────

def _clientes_da_carteira(oficina_doc: str):
    vinculos = _listar_todos(lambda: (
        supabase.table(cart.VINCULOS).select("customer_id").eq("oficina_doc", oficina_doc).eq("status", "ativo")
        .order("created_at", desc=True).order("id")
    ))
    ids = [v["customer_id"] for v in vinculos]
    por_id = {str(c["id"]): c for c in cart.buscar_por_ids(cart.CLIENTES, ids, colunas=COLUNAS_CLIENTE)}
    return [por_id[str(i)] for i in dict.fromkeys(ids) if str(i) in por_id]  # mantém "mais novos primeiro"


def _veiculos_visiveis_leves(oficina_doc: str, clientes):
    """Mesma regra de veiculos_views._veiculos_visiveis (dos clientes da carteira + os que a oficina cadastrou
    sem dono), sem as colunas de foto."""
    dos_clientes = cart.buscar_por_ids(VEICULOS, [c["id"] for c in clientes], coluna="customer_id",
                                       colunas=COLUNAS_VEICULO)
    proprios = _listar_todos(lambda: (
        supabase.table(VEICULOS).select(COLUNAS_VEICULO).eq("oficina_origem_doc", oficina_doc)
        .order("created_at", desc=True).order("id")
    ))
    vistos = {}
    for v in dos_clientes + proprios:
        if not v.get("deleted"):
            vistos[str(v["id"])] = v
    return sorted(vistos.values(), key=lambda v: (v.get("created_at") or "", str(v["id"])), reverse=True)


def _ordens_da_oficina(oficina_doc: str):
    return _listar_todos(lambda: (
        supabase.table("ordens").select(COLUNAS_ORDEM).eq("oficina_doc", oficina_doc)
        .order("created_at", desc=True).order("id")
    ))


# ── Montagem dos resultados ───────────────────────────────────────────────────

def _grupo_clientes(q: Consulta, clientes):
    def montar(c):
        extra = c.get("phone") or c.get("email") or ""
        return {"tipo": "cliente", "id": str(c["id"]), "titulo": c["name"], "subtitulo": extra}

    return _melhores(
        clientes,
        lambda c: q.pontuar([c.get("name")], [c.get("phone"), c.get("cpf"), c.get("email")]),
        montar,
    )


def _grupo_veiculos(q: Consulta, veiculos, clientes):
    donos = {str(c["id"]): c["name"] for c in clientes}

    def placa(v):
        return v.get("plate_norm") or cart.normalizar_placa(v.get("plate"))

    def montar(v):
        modelo = " ".join(p for p in (v.get("brand"), v.get("model")) if p)
        partes = [modelo, str(v["year"]) if v.get("year") else "", donos.get(str(v.get("customer_id")), "")]
        return {"tipo": "veiculo", "id": str(v["id"]), "titulo": f"{placa(v)} · {modelo}".strip(" ·"),
                "subtitulo": " · ".join(p for p in partes[1:] if p)}

    return _melhores(
        veiculos,
        lambda v: q.pontuar([f"{v.get('brand') or ''} {v.get('model') or ''}"], [placa(v)]),
        montar,
    )


def _grupo_ordens(q: Consulta, ordens):
    def montar(o):
        veiculo = " ".join(p for p in (o.get("placa"), o.get("modelo")) if p)
        return {"tipo": "ordem", "id": str(o["id"]), "titulo": f"OS {o.get('os_num') or '—'}",
                "subtitulo": " · ".join(p for p in (o.get("cliente"), veiculo) if p), "status": o.get("status")}

    return _melhores(
        ordens,
        lambda o: q.pontuar([o.get("cliente"), o.get("modelo")], [o.get("os_num"), o.get("placa")]),
        montar,
    )


@api_view(["GET"])
@require_auth
def busca_global(request):
    """GET /busca?q=<texto> → ver o docstring do módulo."""
    permissoes = request.admin.get("permissoes") or []
    ver_clientes = "clientes.ver" in permissoes
    ver_ordens = "ordens.ver" in permissoes
    if not (ver_clientes or ver_ordens):
        return Response({"detail": "Você não tem permissão para isso"}, status=http_status.HTTP_403_FORBIDDEN)

    bruto = str(request.query_params.get("q") or "").strip()[:MAX_CONSULTA]
    q = Consulta(bruto)
    if len(q.texto) < MIN_CARACTERES:
        return Response({})

    oficina_doc = _oficina_doc_do_token(request.admin)
    resposta, indisponiveis = {}, []

    if ver_clientes:
        try:
            clientes = _clientes_da_carteira(oficina_doc)
            resposta["clientes"] = _grupo_clientes(q, clientes)
            resposta["veiculos"] = _grupo_veiculos(q, _veiculos_visiveis_leves(oficina_doc, clientes), clientes)
        except APIError as e:
            logger.error("Busca: falha em clientes/veículos (%s): %s", getattr(e, "code", None),
                         getattr(e, "message", e))
            resposta.pop("veiculos", None)
            resposta.pop("clientes", None)
            indisponiveis += ["clientes", "veiculos"]

    if ver_ordens:
        try:
            resposta["ordens"] = _grupo_ordens(q, _ordens_da_oficina(oficina_doc))
        except APIError as e:
            logger.error("Busca: falha em ordens (%s): %s", getattr(e, "code", None), getattr(e, "message", e))
            indisponiveis.append("ordens")

    if indisponiveis:
        resposta["indisponiveis"] = indisponiveis
    return Response(resposta)
