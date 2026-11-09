"""
Taxa da maquininha nas entradas do Financeiro (migration 0009).

`financeiro_transacoes.valor` é o que o cliente PAGOU (bruto); `taxa` é o que a maquininha descontou;
o líquido (o que caiu na conta) é `valor - taxa`, sempre calculado — nunca gravado.

Quem informa a taxa é o dono (cada oficina tem a sua maquininha e a sua tabela), então o sistema não
estima nada. Este módulo reúne só o que mais de uma tela precisa: ler a coluna sem quebrar quando a
migration ainda não foi rodada, e somar taxa/líquido.
"""
from decimal import Decimal

from postgrest.exceptions import APIError

COLUNA_AUSENTE = ("42703", "PGRST204")


def com_taxa(consultar, campos: str):
    """`consultar(campos)` pedindo também `taxa`. Se a coluna ainda não existe (migration 0009 por rodar),
    repete sem ela: o Financeiro segue funcionando, só sem taxa (as linhas vêm sem a chave = taxa 0)."""
    try:
        return consultar(f"{campos},taxa")
    except APIError as e:
        if getattr(e, "code", None) not in COLUNA_AUSENTE:
            raise
        return consultar(campos)


def taxa_de(linha: dict) -> Decimal:
    return Decimal(str(linha.get("taxa") or 0))


def soma_taxas(linhas) -> Decimal:
    return sum((taxa_de(l) for l in linhas), Decimal("0"))


def soma_liquido(linhas) -> Decimal:
    """O que de fato entra na conta: valor - taxa da maquininha."""
    return sum((Decimal(str(l["valor"])) - taxa_de(l) for l in linhas), Decimal("0"))
