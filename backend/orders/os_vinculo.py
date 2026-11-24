"""
Liga a OS ao cliente e ao veículo da carteira (ordens.customer_id / ordens.vehicle_id) e, quando o cargo
pode, cadastra na hora o que ainda não existe — sem duplicar (regras em cadastro_checklist.py).

A tela de OS é de texto livre (nome, documento, e-mail, placa), então a ligação é feita no salvamento
por correspondência DENTRO da carteira da própria oficina. É isso que permite ao cliente do app ver
orçamentos/OS da oficina onde ele está vinculado.

Regras:
  - só cadastra quem tem `clientes.editar` (mesma permissão da tela Clientes); os demais cargos só ligam;
  - nunca procura fora da carteira (não revela contas do app por e-mail/CPF);
  - melhor esforço: qualquer falha (migração pendente, rede) é registrada e a OS segue salva sem vínculo.
"""
import logging

from . import cadastro_checklist as cadastro
from . import carteira as cart

log = logging.getLogger(__name__)

SEM_VINCULO = {"customer_id": None, "vehicle_id": None, "cliente_criado": False, "veiculo_criado": False, "avisos": []}


def _vinculo_atual(oficina_doc: str, ordem_id: str) -> dict:
    """O que a OS já tem gravado (vazio na primeira vez). Falha aqui não impede o resto."""
    try:
        r = (cart.supabase.table("ordens").select("customer_id,vehicle_id")
             .eq("id", ordem_id).eq("oficina_doc", oficina_doc).limit(1).execute().data)
        return r[0] if r else {}
    except Exception:  # noqa: BLE001
        log.warning("Não foi possível ler o vínculo atual da OS %s.", ordem_id, exc_info=True)
        return {}


def vincular(oficina_doc: str, ordem_id: str, ordem: dict, pode_cadastrar: bool = False) -> dict:
    """Resolve, cadastra (se permitido) e grava o vínculo. Devolve o resultado para a resposta da API."""
    try:
        res = cadastro.resolver_e_cadastrar(oficina_doc, ordem, pode_cadastrar, _vinculo_atual(oficina_doc, ordem_id))
        cart.supabase.table("ordens").update({"customer_id": res["customer_id"], "vehicle_id": res["vehicle_id"]}) \
            .eq("id", ordem_id).eq("oficina_doc", oficina_doc).execute()
        return res
    except Exception:  # noqa: BLE001 — a OS já está salva; o vínculo é complemento
        log.warning("Não foi possível ligar a OS %s à carteira.", ordem_id, exc_info=True)
        return dict(SEM_VINCULO, avisos=[])
