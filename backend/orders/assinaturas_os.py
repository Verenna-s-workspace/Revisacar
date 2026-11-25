"""
Assinaturas da OS (`payload.assinaturas`) — hoje só a da ENTRADA (termo de recebimento do veículo).

Formato guardado no payload da OS (sem tabela nova, sem migração):

    assinaturas = {
        "entrada": {
            "status": "assinada" | "adiada" | "pendente",
            "imagem": "data:image/png;base64,..." (só se assinada; senão ""),
            "quem":   nome de quem assinou (o cliente),
            "quando": ISO 8601 — carimbado AQUI, pelo servidor,
            "por":    nome de quem registrou (do token) — também carimbado aqui,
        },
        # "aprovacao": {...}, "fechamento": {...}   ← as próximas fases entram na mesma chave
    }

Regras:
- O que o cliente (navegador) manda é só status/imagem/quem. `quando` e `por` nunca vêm do navegador.
- A imagem é reencodada (decodificar_assinatura): nada do que veio é guardado como veio; traço em
  branco não vale como assinatura.
- Só muda o carimbo quando status ou imagem mudam; salvar a OS de novo não "reassina".
- Campo `assinaturas` ausente/nulo no salvamento = NÃO mexer (um app antigo, ou outra tela que salva a
  OS sem esse estado, não pode apagar a assinatura). Para voltar a "pendente" envia-se o status.
- Chaves de outras fases que já existam no payload são preservadas.
"""
import base64

from rest_framework import serializers

STATUS_ENTRADA = ("assinada", "adiada", "pendente")
QUEM_MAX = 100
_PREFIXO_PNG = "data:image/png;base64,"


def normalizar_imagem(valor) -> str:
    """data URL de PNG → data URL do PNG reencodado. Vazio/ausente → "". Em branco ou inválido → erro."""
    if not valor:
        return ""
    from .orcamento_pdf import decodificar_assinatura  # import tardio: PIL só quando há imagem

    try:
        png = decodificar_assinatura(valor)
    except ValueError as e:
        raise serializers.ValidationError(str(e))
    if png is None:
        raise serializers.ValidationError("A assinatura está em branco.")
    return _PREFIXO_PNG + base64.b64encode(png).decode("ascii")


def _entrada_vazia() -> dict:
    return {"status": "pendente", "imagem": "", "quem": "", "quando": "", "por": ""}


def aplicar(novo, antigo, *, por_nome: str, agora: str):
    """Mescla `assinaturas` validadas no que já está gravado e carimba quando/por.

    novo   = validated_data["assinaturas"] (dict ou None); antigo = payload["assinaturas"] gravado (dict ou None).
    Devolve o dict a gravar, ou None se não há nada (nem antes nem agora).
    """
    base = dict(antigo) if isinstance(antigo, dict) else {}
    entrada_nova = novo.get("entrada") if isinstance(novo, dict) else None
    if entrada_nova is None:
        return base or None

    entrada_antiga = base.get("entrada") if isinstance(base.get("entrada"), dict) else None
    status = entrada_nova["status"]
    imagem = entrada_nova.get("imagem") or ""
    if entrada_antiga and entrada_antiga.get("status") == status and (entrada_antiga.get("imagem") or "") == imagem:
        return base  # nada mudou: mantém quem/quando/por originais

    if status == "pendente":
        base["entrada"] = _entrada_vazia()
    else:
        base["entrada"] = {
            "status": status,
            "imagem": imagem if status == "assinada" else "",
            "quem": entrada_nova.get("quem") or "",
            "quando": agora,
            "por": (por_nome or "")[:120],
        }
    return base


def estado_entrada(assinaturas) -> str:
    """'assinada' | 'adiada' | 'pendente' de um payload qualquer (linha antiga sem o campo = pendente)."""
    entrada = assinaturas.get("entrada") if isinstance(assinaturas, dict) else None
    st = entrada.get("status") if isinstance(entrada, dict) else None
    return st if st in STATUS_ENTRADA else "pendente"
