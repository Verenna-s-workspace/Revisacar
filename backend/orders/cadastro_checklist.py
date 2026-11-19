"""
Cadastro automático de cliente e veículo pelo checklist (OS), sem duplicar.

Quando a OS é salva com um cliente ou veículo que ainda não existe na carteira da oficina, eles são
cadastrados na hora. O risco é duplicar, então a regra é: **só reaproveita por sinal forte; sinal fraco
vira sugestão na tela, nunca fusão automática**.

Cliente (nesta ordem; vale o primeiro que bater, sempre DENTRO da carteira da própria oficina):
  1. `cliente.id` escolhido na tela (sugestão aceita pelo mecânico);
  2. CPF/CNPJ;
  3. e-mail;
  4. dono do veículo da placa, se o que foi digitado for compatível com ele (mesmo nome OU mesmo telefone);
  5. telefone E nome iguais (nome sem acento/caixa e sem "da/de/do");
  6. o vínculo que a OS já tem (corrigir um erro de digitação não cria outra pessoa);
  7. nada bateu → cadastra um cliente de balcão novo.
Telefone sozinho NÃO junta cadastros: família inteira usa o mesmo número. Nome sozinho também não.

Veículo: a placa normalizada (sem hífen, maiúscula) é a chave. Já existe → reaproveita; senão cadastra.
Se a placa está no nome de OUTRA pessoa, a OS fica ligada à pessoa digitada e o veículo NÃO muda de dono
(carro vendido: quem transfere é a tela Veículos) — a resposta avisa.

Limites assumidos:
  - Só cadastra quem tem `clientes.editar` (mecânico, por exemplo, não tem): para os demais a OS é salva
    e ligada ao que já existe, como sempre foi.
  - `customer_vehicles` exige marca e ano no banco (é compartilhado com o app do cliente). O checklist não
    tem "marca": o texto do campo Modelo vai inteiro para `model` e `brand` fica vazio. Sem o ano o veículo
    NÃO é cadastrado (nada é inventado); a resposta avisa e o cliente é cadastrado normalmente.
  - Melhor esforço: qualquer falha é registrada e a OS segue salva (mesma regra de os_vinculo.py).
"""
import logging
import re
import unicodedata
from datetime import date

from postgrest.exceptions import APIError

from . import campos_os as campos
from . import carteira as cart
from . import veiculos_views as veic
from .estoque_views import _uuid_valido

log = logging.getLogger(__name__)

_PARTICULAS = frozenset({"da", "de", "do", "das", "dos", "e"})
ANO_MIN = 1900


# ── Normalização ──────────────────────────────────────────────────────────────

def normalizar_nome(valor) -> str:
    """Nome comparável: sem acento, minúsculo, sem pontuação, sem "da/de/do/das/dos/e", espaços únicos."""
    s = unicodedata.normalize("NFKD", str(valor or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).casefold()
    return " ".join(p for p in re.sub(r"[^a-z0-9]+", " ", s).split() if p not in _PARTICULAS)


def normalizar_telefone(valor) -> str:
    """Telefone comparável: só dígitos, sem o 55 do país e com o 9 do celular. Inválido = vazio.

    Fixo (10 dígitos começando em 2-5) fica como está; celular antigo digitado sem o 9 (10 dígitos
    começando em 6-9) ganha o 9, para "(11) 8888-7777" e "(11) 98888-7777" serem a mesma linha."""
    d = cart.so_digitos(valor)
    if len(d) in (12, 13) and d.startswith("55"):
        d = d[2:]
    if len(d) == 10 and d[2] in "6789":
        d = d[:2] + "9" + d[2:]
    return d if len(d) in (10, 11) else ""


def formatar_telefone(valor) -> str:
    """"(11) 99999-0000" — o mesmo formato que a tela Clientes grava. Sem 10/11 dígitos, devolve como veio."""
    d = cart.so_digitos(valor)
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return str(valor or "").strip()


def _mais_antigo(linhas):
    return min(linhas, key=lambda c: (str(c.get("created_at") or ""), str(c["id"]))) if linhas else None


# ── Escolha do que já existe ──────────────────────────────────────────────────

def _id_valido(valor):
    valor = str(valor or "").strip()
    return valor if _uuid_valido(valor) else None


def achar_cliente(carteira, cli: dict, donos_da_placa, atual_id=None):
    """Cliente da carteira que corresponde ao que foi digitado, ou None. `carteira` = [(customer, vinculo)]."""
    clientes = [c for c, _ in carteira]
    por_id = {str(c["id"]): c for c in clientes}

    explicito = _id_valido(cli.get("id"))
    if explicito and explicito in por_id:
        return por_id[explicito]

    doc = cart.so_digitos(cli.get("doc"))
    if doc and cart.documento_valido(doc):
        achado = _mais_antigo([c for c in clientes if cart.so_digitos(c.get("cpf")) == doc])
        if achado:
            return achado

    email = (cli.get("email") or "").strip().lower()
    if email:
        achado = _mais_antigo([c for c in clientes if (c.get("email") or "").lower() == email])
        if achado:
            return achado

    nome_n, tel_n = normalizar_nome(cli.get("nome")), normalizar_telefone(cli.get("tel"))

    def mesmo_nome(c):
        return bool(nome_n) and normalizar_nome(c.get("name")) == nome_n

    def mesmo_tel(c):
        return bool(tel_n) and normalizar_telefone(c.get("phone")) == tel_n

    for dono in donos_da_placa:  # dono do veículo, se for compatível com o que foi digitado
        if dono and (mesmo_nome(dono) or mesmo_tel(dono)):
            return dono

    achado = _mais_antigo([c for c in clientes if mesmo_nome(c) and mesmo_tel(c)])
    if achado:
        return achado

    if atual_id and str(atual_id) in por_id:
        return por_id[str(atual_id)]
    return None


def achar_veiculo(visiveis, ve: dict, cliente=None):
    """(veículos com a placa, escolhido). Placa igual em mais de um cadastro: fica o do cliente da OS."""
    explicito = _id_valido(ve.get("id"))
    if explicito:
        por_id = next((v for v in visiveis if str(v["id"]) == explicito), None)
        if por_id:
            return [por_id], por_id
    placa = cart.normalizar_placa(ve.get("placa"))
    candidatos = [v for v in visiveis
                  if placa and (v.get("plate_norm") or cart.normalizar_placa(v.get("plate"))) == placa]
    escolhido = None
    if cliente is not None:
        escolhido = next((v for v in candidatos if str(v.get("customer_id")) == str(cliente["id"])), None)
    return candidatos, escolhido or (candidatos[0] if candidatos else None)


# ── Criação ───────────────────────────────────────────────────────────────────

def _criar_cliente(oficina_doc: str, cli: dict, rotulo: str):
    nome, tel = (cli.get("nome") or "").strip(), (cli.get("tel") or "").strip()
    if not nome or not tel:
        return None
    doc = cart.so_digitos(cli.get("doc"))
    cols = {
        "name": nome, "phone": formatar_telefone(tel),
        "cpf": doc if doc and cart.documento_valido(doc) else None,
        "email": (cli.get("email") or "").strip().lower() or None,
    }
    criado, _vinculo, _reativado = cart.criar_balcao(
        oficina_doc, cols, observacoes=f"Cadastrado automaticamente pelo checklist ({rotulo}).")
    return criado


def _ano_valido(valor):
    v = str(valor or "").strip()
    if not re.fullmatch(r"\d{4}", v):
        return None
    return int(v) if ANO_MIN <= int(v) <= date.today().year + 1 else None


def _criar_veiculo(oficina_doc: str, ve: dict, os_header: dict, cliente, rotulo: str):
    """(veículo|None, motivo, criado). Motivo "ano": faltou o ano, exigido pelo banco. `criado` False = outro
    salvamento cadastrou a mesma placa um instante antes e foi o veículo dele que voltou."""
    placa = cart.normalizar_placa(ve.get("placa"))
    modelo = (ve.get("modelo") or "").strip()
    if not placa or not cart.PLACA_RE.match(placa) or not modelo:
        return None, None, False
    ano = _ano_valido(ve.get("ano"))
    if ano is None:
        return None, "ano", False

    cols = {"plate": placa, "brand": "", "model": modelo[:80], "year": ano,
            "notes": f"Cadastrado automaticamente pelo checklist ({rotulo})."}
    cor = (ve.get("cor") or "").strip()[:40]
    if cor:
        cols["color"] = cor
    if ve.get("combustivel") in campos.COMBUSTIVEIS:
        cols["fuel_type"] = ve["combustivel"]
    chassi = (ve.get("chassi") or "").strip().upper()
    if chassi:
        cols["vin"] = chassi[:17]
    km = cart.so_digitos((os_header or {}).get("os_km"))
    if km and int(km) <= 9_999_999:
        cols["mileage"] = int(km)
    if cliente is not None:
        cols["customer_id"] = str(cliente["id"])
        cols["oficina_origem_doc"] = oficina_doc if cliente.get("origem") == "oficina" else None
    else:
        cols["customer_id"], cols["oficina_origem_doc"] = None, oficina_doc

    try:
        return cart.supabase.table(veic.VEICULOS).insert(cols).execute().data[0], None, True
    except APIError as e:
        if getattr(e, "code", None) != "23505":
            raise
        # Outro salvamento cadastrou a mesma placa um instante antes (índice único da 0011): usa o dele.
        existente = next((v for v in veic._veiculos_visiveis(oficina_doc, cart.carteira_da_oficina(oficina_doc))
                          if (v.get("plate_norm") or cart.normalizar_placa(v.get("plate"))) == placa), None)
        return existente, None, False


# ── Orquestração ──────────────────────────────────────────────────────────────

def resolver_e_cadastrar(oficina_doc: str, ordem: dict, pode_cadastrar: bool, atual: dict | None = None) -> dict:
    """Liga a OS ao cliente/veículo e, se `pode_cadastrar`, cadastra o que não existe.

    Devolve {"customer_id", "vehicle_id", "cliente_criado", "veiculo_criado", "avisos"}.
    `atual` = {"customer_id", "vehicle_id"} que a OS já tem gravados (None na primeira vez)."""
    cli, ve = ordem.get("cliente") or {}, ordem.get("veiculo") or {}
    os_header = ordem.get("os_header") or {}
    rotulo = f"OS {os_header.get('os_num')}" if os_header.get("os_num") else "OS"
    atual = atual or {}
    avisos = []

    carteira = cart.carteira_da_oficina(oficina_doc)
    visiveis = veic._veiculos_visiveis(oficina_doc, carteira)
    por_id = {str(c["id"]): c for c, _ in carteira}

    candidatos, _ = achar_veiculo(visiveis, ve)
    donos_da_placa = [por_id.get(str(v["customer_id"])) for v in candidatos if v.get("customer_id")]
    cliente = achar_cliente(carteira, cli, donos_da_placa, atual.get("customer_id"))

    cliente_criado = veiculo_criado = False
    if cliente is None and pode_cadastrar:
        try:
            cliente = _criar_cliente(oficina_doc, cli, rotulo)
            cliente_criado = cliente is not None
        except Exception:  # noqa: BLE001 — a OS já está salva; o cadastro é complemento
            log.warning("Checklist: não foi possível cadastrar o cliente da %s.", rotulo, exc_info=True)

    _, veiculo = achar_veiculo(visiveis, ve, cliente)
    if veiculo is None and pode_cadastrar:
        try:
            veiculo, motivo, veiculo_criado = _criar_veiculo(oficina_doc, ve, os_header, cliente, rotulo)
            if motivo == "ano":
                avisos.append("Veículo não cadastrado na frota: informe o ano para registrá-lo.")
        except Exception:  # noqa: BLE001
            log.warning("Checklist: não foi possível cadastrar o veículo da %s.", rotulo, exc_info=True)

    if not pode_cadastrar and (cliente is None or veiculo is None):
        avisos.append("Seu cargo não cadastra clientes nem veículos: a OS foi salva sem criar cadastro novo.")

    if veiculo is not None and cliente is not None and veiculo.get("customer_id") \
            and str(veiculo["customer_id"]) != str(cliente["id"]):
        dono = por_id.get(str(veiculo["customer_id"]))
        quem = f" de {dono['name']}" if dono else " de outro cliente"
        avisos.append(f"Esta placa está cadastrada no nome{quem}. A OS ficou com {cliente['name']}; "
                      "para trocar o dono do veículo, use a tela Veículos.")

    return {
        "customer_id": str(cliente["id"]) if cliente else None,
        "vehicle_id": str(veiculo["id"]) if veiculo else None,
        "cliente_criado": cliente_criado,
        "veiculo_criado": veiculo_criado,
        "avisos": avisos,
    }
