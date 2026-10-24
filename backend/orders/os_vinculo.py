"""
Liga a OS ao cliente e ao veículo da carteira (ordens.customer_id / ordens.vehicle_id).

A tela de OS é de texto livre (nome, documento, e-mail, placa), então a ligação é feita no salvamento
por correspondência DENTRO da carteira da própria oficina: documento ou e-mail do cliente, placa do veículo.
É isso que permite ao cliente do app ver orçamentos/OS da oficina onde ele está vinculado.

Regras:
  - nunca cria cliente nem veículo (salvar uma OS não tem efeito colateral na carteira);
  - nunca procura fora da carteira (não revela contas do app por e-mail/CPF);
  - melhor esforço: qualquer falha (migração pendente, rede) é registrada e a OS segue salva sem vínculo.
"""
import logging

from . import carteira as cart
from . import veiculos_views as veic

log = logging.getLogger(__name__)


def resolver(oficina_doc: str, ordem: dict):
    """(customer_id | None, vehicle_id | None) para os dados de uma OS."""
    cli, ve = ordem.get("cliente") or {}, ordem.get("veiculo") or {}
    carteira = cart.carteira_da_oficina(oficina_doc)

    doc = cart.so_digitos(cli.get("doc"))
    email = (cli.get("email") or "").strip().lower()
    dono = None
    if doc and cart.documento_valido(doc):
        dono = next((c for c, _ in carteira if cart.so_digitos(c.get("cpf")) == doc), None)
    if dono is None and email:
        dono = next((c for c, _ in carteira if (c.get("email") or "").lower() == email), None)

    placa = cart.normalizar_placa(ve.get("placa"))
    veiculo = None
    if placa:
        candidatos = [v for v in veic._veiculos_visiveis(oficina_doc, carteira)
                      if cart.normalizar_placa(v.get("plate")) == placa]
        if dono is not None:  # mesma placa em mais de um cadastro: fica o do cliente da OS
            veiculo = next((v for v in candidatos if str(v.get("customer_id")) == str(dono["id"])), None)
        veiculo = veiculo or (candidatos[0] if candidatos else None)
        if dono is None and veiculo and veiculo.get("customer_id"):
            dono = next((c for c, _ in carteira if str(c["id"]) == str(veiculo["customer_id"])), None)
    return (str(dono["id"]) if dono else None, str(veiculo["id"]) if veiculo else None)


def vincular(oficina_doc: str, ordem_id: str, ordem: dict) -> None:
    try:
        customer_id, vehicle_id = resolver(oficina_doc, ordem)
        cart.supabase.table("ordens").update({"customer_id": customer_id, "vehicle_id": vehicle_id}) \
            .eq("id", ordem_id).eq("oficina_doc", oficina_doc).execute()
    except Exception:  # noqa: BLE001 — a OS já está salva; o vínculo é complemento
        log.warning("Não foi possível ligar a OS %s à carteira.", ordem_id, exc_info=True)
