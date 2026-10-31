"""
Veículos da oficina (tela Veículos). Mesmo padrão de clientes_views.py.

Permissões: clientes.ver (lista/consulta) e clientes.editar (cadastra, edita, exclui) — veículo é
dado do cliente, então segue as permissões de Clientes (rbac.py).

Tabela: customer_vehicles (a mesma do app do cliente). Quais veículos a oficina enxerga:
  • os de clientes que estão na carteira ATIVA dela; e
  • os que ela mesma cadastrou sem dono (oficina_origem_doc = oficina_doc).
Veículo de outra oficina ou de cliente fora da carteira é "não encontrado" (404).

Formato JSON: `VeiculoCadastrado` (frontend/src/types/veiculo.ts).
  • `proprietario`: o formulário manda texto (nome, CPF/CNPJ, telefone, e-mail) ou `clienteId`. Com texto, o
    cliente é achado na carteira (CPF/CNPJ, e-mail ou nome exato) ou cadastrado na hora (balcão).
  • `status` é derivado da OS mais recente ligada ao veículo; nunca é gravado.
  • Fotos (migration 0007): `fotoPrincipal` e `fotosAdicionais` (até 5) são data URLs de imagem já comprimidas
    pelo navegador, gravadas em `foto_data_url` / `fotos_adicionais` — o mesmo funcionamento da foto dos itens
    do estoque. `fotoPrincipal: null` limpa; chave ausente não mexe. Sem foto, o card usa a imagem da categoria.
  • Excluir é "soft": o veículo some das listas mas continua no banco (histórico de OS e agendamentos).
"""
from datetime import date

from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import carteira as cart
from .estoque_views import _corpo_valido, _negado, _nao_encontrado, _uuid_valido
from .views import supabase, require_auth, _now, _oficina_doc_do_token

VEICULOS = "customer_vehicles"
MAX_FOTOS_ADICIONAIS = 5  # manter em sincronia com a constraint da 0007 e com o formulário
CATEGORIAS = ("sedan", "hatch", "suv", "picape", "van", "utilitario", "esportivo")
CAMBIOS = ("Manual", "Automático", "CVT", "Automatizado")

# Status da OS → status do veículo na oficina. OS finalizada/recusada = sem pendência.
STATUS_VEICULO = {
    "rascunho": "na_oficina", "em_orcamento": "na_oficina", "aprovada": "na_oficina",
    "em_execucao": "na_oficina", "aguardando": "na_oficina",
    "pendente_aprovacao": "aguardando_aprovacao",
    "finalizada": "disponivel", "recusada": "disponivel",
}


# ── Mapeamento ────────────────────────────────────────────────────────────────

def proprietario_para_api(c: dict | None):
    if not c:
        return None
    out = {"clienteId": str(c["id"]), "nome": c["name"]}
    for chave, valor in (("docCpfCnpj", c.get("cpf")), ("telefone", c.get("phone")), ("email", c.get("email"))):
        if valor:
            out[chave] = valor
    return out


def veiculo_para_api(v: dict, dono: dict | None, ultima_os: dict | None) -> dict:
    out = {
        "id": str(v["id"]),
        "placa": v.get("plate_norm") or cart.normalizar_placa(v["plate"]),
        "marca": v["brand"],
        "modelo": v["model"],
        "ano": v["year"],
        "cor": v.get("color") or "",
        "categoria": v.get("categoria") if v.get("categoria") in CATEGORIAS else "sedan",
        "quilometragem": v.get("mileage") or 0,
        "combustivel": v.get("fuel_type") or "",
        "cambio": v.get("cambio") if v.get("cambio") in CAMBIOS else "Manual",
        "portas": v.get("portas") or 4,
        "fotosAdicionais": _fotos_adicionais_do_banco(v),
        "proprietario": proprietario_para_api(dono),
        "status": STATUS_VEICULO.get((ultima_os or {}).get("status"), "disponivel"),
        "createdAt": v["created_at"],
    }
    for chave, valor in (("motor", v.get("motor")), ("chassi", v.get("vin")), ("renavam", v.get("renavam")),
                         ("observacoes", v.get("notes"))):
        if valor:
            out[chave] = valor
    if cart.foto_valida(v.get("foto_data_url")):
        out["fotoPrincipal"] = v["foto_data_url"]
    if ultima_os:
        out["ultimaOSId"] = ultima_os["id"]
    if v.get("updated_at"):
        out["updatedAt"] = v["updated_at"]
    return out


def _fotos_adicionais_do_banco(v: dict) -> list:
    """Lista de fotos do registro. Sem a coluna (0007 não rodada) ou com lixo, vem vazia."""
    fotos = v.get("fotos_adicionais")
    return [f for f in fotos if cart.foto_valida(f)] if isinstance(fotos, list) else []


# ── Consulta ──────────────────────────────────────────────────────────────────

def _veiculos_visiveis(oficina_doc: str, carteira):
    """Veículos não excluídos que a oficina enxerga, mais novos primeiro."""
    dos_clientes = cart.buscar_por_ids(VEICULOS, [c["id"] for c, _ in carteira], coluna="customer_id")
    proprios = supabase.table(VEICULOS).select("*").eq("oficina_origem_doc", oficina_doc).execute().data or []
    vistos = {}
    for v in dos_clientes + proprios:
        if not v.get("deleted"):
            vistos[str(v["id"])] = v
    return sorted(vistos.values(), key=lambda v: (v.get("created_at") or "", str(v["id"])), reverse=True)


def _ultima_os_por_veiculo(oficina_doc: str, veiculo_ids):
    ordens = cart.buscar_por_ids(
        "ordens", veiculo_ids, coluna="vehicle_id",
        extra=lambda q: q.eq("oficina_doc", oficina_doc).order("created_at", desc=True))
    por_veiculo = {}
    for o in sorted(ordens, key=lambda o: o["created_at"] or "", reverse=True):
        por_veiculo.setdefault(str(o["vehicle_id"]), {"id": o["id"], "status": o.get("status")})
    return por_veiculo


def _montar(oficina_doc: str, veiculos, carteira):
    donos = {str(c["id"]): c for c, _ in carteira}
    faltam = [v["customer_id"] for v in veiculos if v.get("customer_id") and str(v["customer_id"]) not in donos]
    for c in cart.buscar_por_ids(cart.CLIENTES, faltam):  # dono arquivado: o veículo ainda aparece (se for da oficina)
        donos[str(c["id"])] = c
    ultimas = _ultima_os_por_veiculo(oficina_doc, [v["id"] for v in veiculos])
    return [veiculo_para_api(v, donos.get(str(v["customer_id"])) if v.get("customer_id") else None,
                             ultimas.get(str(v["id"]))) for v in veiculos]


def _veiculo_da_oficina(oficina_doc: str, veiculo_id, carteira=None):
    """(veiculo, carteira) se a oficina enxerga esse veículo; senão (None, carteira)."""
    carteira = carteira if carteira is not None else cart.carteira_da_oficina(oficina_doc)
    r = supabase.table(VEICULOS).select("*").eq("id", str(veiculo_id)).limit(1).execute().data
    if not r or r[0].get("deleted"):
        return None, carteira
    v = r[0]
    ids_carteira = {str(c["id"]) for c, _ in carteira}
    if (v.get("customer_id") and str(v["customer_id"]) in ids_carteira) or v.get("oficina_origem_doc") == oficina_doc:
        return v, carteira
    return None, carteira


# ── Validação do corpo ────────────────────────────────────────────────────────

def _inteiro(dados, chave, minimo, maximo, erros, obrigatorio=False, parcial=False):
    if chave not in dados or dados[chave] in (None, ""):
        if obrigatorio and not parcial:
            erros[chave] = ["Obrigatório."]
        return False, None
    valor = dados[chave]
    if isinstance(valor, bool):
        erros[chave] = ["Número inválido."]
        return False, None
    try:
        valor = int(str(valor).strip())
    except (ValueError, TypeError):
        erros[chave] = ["Número inválido."]
        return False, None
    if not minimo <= valor <= maximo:
        erros[chave] = [f"Deve ficar entre {minimo} e {maximo}."]
        return False, None
    return True, valor


def ler_veiculo(dados, parcial=False):
    """Valida POST/PATCH. Devolve só as colunas de customer_vehicles que vieram."""
    if not isinstance(dados, dict):
        raise cart.ErroCarteira({"detail": "Corpo inválido."}, http_status.HTTP_400_BAD_REQUEST)
    erros, cols = {}, {}

    if "placa" in dados or not parcial:
        placa = cart.normalizar_placa(dados.get("placa"))
        if not placa:
            erros["placa"] = ["Obrigatório."]
        elif not cart.PLACA_RE.match(placa):
            erros["placa"] = ["Placa inválida (ex.: ABC1D23 ou ABC1234)."]
        else:
            cols["plate"] = placa
    for chave, coluna, maximo in (("marca", "brand", 60), ("modelo", "model", 80)):
        ok, v = cart.texto(dados, chave, maximo, erros, obrigatorio=True, parcial=parcial)
        if ok:
            cols[coluna] = v
    ok, v = _inteiro(dados, "ano", 1900, date.today().year + 1, erros, obrigatorio=True, parcial=parcial)
    if ok:
        cols["year"] = v
    ok, v = _inteiro(dados, "quilometragem", 0, 9_999_999, erros)
    if ok:
        cols["mileage"] = v
    ok, v = _inteiro(dados, "portas", 1, 8, erros)
    if ok:
        cols["portas"] = v

    for chave, coluna, maximo in (("cor", "color", 40), ("combustivel", "fuel_type", 20), ("motor", "motor", 60),
                                  ("chassi", "vin", 17), ("renavam", "renavam", 20), ("observacoes", "notes", 1000)):
        ok, v = cart.texto(dados, chave, maximo, erros)
        if ok:
            cols[coluna] = (v.upper() if chave == "chassi" else v) or None
    if "categoria" in dados:
        if dados["categoria"] in CATEGORIAS:
            cols["categoria"] = dados["categoria"]
        else:
            erros["categoria"] = [f"Use uma de: {', '.join(CATEGORIAS)}."]
    if "cambio" in dados:
        if dados["cambio"] in CAMBIOS:
            cols["cambio"] = dados["cambio"]
        else:
            erros["cambio"] = [f"Use uma de: {', '.join(CAMBIOS)}."]

    # Fotos: `null`/"" limpa a principal; chave ausente não mexe. A lista de adicionais é sempre a lista
    # COMPLETA desejada (o formulário reenvia as que ficaram).
    if "fotoPrincipal" in dados:
        ok, v = cart.ler_foto(dados["fotoPrincipal"], "fotoPrincipal", erros)
        if ok:
            cols["foto_data_url"] = v
    if "fotosAdicionais" in dados:
        bruto = dados["fotosAdicionais"]
        if bruto is None:
            bruto = []
        if not isinstance(bruto, list):
            erros["fotosAdicionais"] = ["Lista de fotos inválida."]
        elif len(bruto) > MAX_FOTOS_ADICIONAIS:
            erros["fotosAdicionais"] = [f"No máximo {MAX_FOTOS_ADICIONAIS} fotos adicionais."]
        else:
            fotos = []
            for foto in bruto:
                ok, v = cart.ler_foto(foto, "fotosAdicionais", erros)
                if ok and v:
                    fotos.append(v)
            if "fotosAdicionais" not in erros:
                cols["fotos_adicionais"] = fotos
    if erros:
        raise cart.ErroCarteira(erros)
    return cols


def _sem_mudanca_de_foto(cols: dict, atual: dict | None) -> dict:
    """Tira de `cols` a foto que não mudou (ou que continua vazia). O formulário reenvia as fotos em todo
    salvamento (`fotosAdicionais: []` quando não há nenhuma): sem isto, qualquer veículo sem foto tentaria
    gravar as colunas da 0007 — e falharia em quem ainda não rodou a migration."""
    atual = atual or {}
    if "foto_data_url" in cols and (cols["foto_data_url"] or None) == (atual.get("foto_data_url") or None):
        del cols["foto_data_url"]
    if "fotos_adicionais" in cols and cols["fotos_adicionais"] == _fotos_adicionais_do_banco(atual):
        del cols["fotos_adicionais"]
    return cols


def _resolver_dono(oficina_doc: str, prop, carteira):
    """Interpreta `proprietario` e devolve (customer_id|None, oficina_origem_doc|None).
    None = veículo sem dono, guardado como da própria oficina."""
    if prop in (None, {}):
        return None, oficina_doc
    if not isinstance(prop, dict):
        raise cart.erro_campo("proprietario", "Proprietário inválido.")
    if prop.get("clienteId"):
        if not _uuid_valido(prop["clienteId"]):
            raise cart.erro_campo("proprietario", "Cliente não encontrado.")
        achado = cart.cliente_da_carteira(oficina_doc, prop["clienteId"])
        if not achado:
            raise cart.erro_campo("proprietario", "Cliente não encontrado.")
        c = achado[0]
    else:
        if not (prop.get("nome") or "").strip():  # formulário com proprietário em branco = sem dono
            return None, oficina_doc
        c, _ = cart.resolver_cliente(oficina_doc, prop.get("nome"), prop.get("docCpfCnpj"),
                                     prop.get("telefone"), prop.get("email"))
    return str(c["id"]), (oficina_doc if c.get("origem") == "oficina" else None)


def _placa_em_uso(oficina_doc, placa_norm, carteira, ignorar_id=None):
    for v in _veiculos_visiveis(oficina_doc, carteira):
        if str(v["id"]) != str(ignorar_id) and (v.get("plate_norm") or cart.normalizar_placa(v["plate"])) == placa_norm:
            return True
    return False


# ── Rotas ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@require_auth
@cart.tratar_erros_carteira
def veiculos_list(request):
    """
    GET  /veiculos  → veículos da oficina (mais novos primeiro)
    POST /veiculos  → cadastra. placa, marca, modelo e ano obrigatórios; `proprietario` opcional
    """
    negado = _negado(request, "clientes.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    carteira = cart.carteira_da_oficina(oficina_doc)

    if request.method == "POST":
        negado = _negado(request, "clientes.editar")
        if negado:
            return negado
        cols = _sem_mudanca_de_foto(ler_veiculo(request.data), None)
        if _placa_em_uso(oficina_doc, cols["plate"], carteira):
            raise cart.erro_campo("placa", "Já existe um veículo com esta placa.", http_status.HTTP_409_CONFLICT)
        dono_id, origem_doc = _resolver_dono(oficina_doc, request.data.get("proprietario"), carteira)
        criado = supabase.table(VEICULOS).insert({
            **cols, "customer_id": dono_id, "oficina_origem_doc": origem_doc,
        }).execute().data[0]
        return Response(_montar(oficina_doc, [criado], cart.carteira_da_oficina(oficina_doc))[0],
                        status=http_status.HTTP_201_CREATED)

    veiculos = _veiculos_visiveis(oficina_doc, carteira)
    return Response(_montar(oficina_doc, veiculos, carteira))


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
@cart.tratar_erros_carteira
def veiculo_detail(request, veiculo_id):
    """
    GET    /veiculos/<id>  → um veículo
    PATCH  /veiculos/<id>  → edição parcial; `proprietario` troca o dono (null = sem dono)
    DELETE /veiculos/<id>  → exclui da lista (soft: o histórico fica)
    """
    negado = _negado(request, "clientes.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(veiculo_id):
        return _nao_encontrado("Veículo não encontrado.")
    v, carteira = _veiculo_da_oficina(oficina_doc, veiculo_id)
    if not v:
        return _nao_encontrado("Veículo não encontrado.")

    if request.method == "GET":
        return Response(_montar(oficina_doc, [v], carteira)[0])

    negado = _negado(request, "clientes.editar")
    if negado:
        return negado

    if request.method == "DELETE":
        supabase.table(VEICULOS).update({"deleted": True, "is_active": False, "updated_at": _now()}) \
            .eq("id", str(v["id"])).execute()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    if not _corpo_valido(request):
        return Response({"detail": "Corpo inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
    cols = _sem_mudanca_de_foto(ler_veiculo(request.data, parcial=True), v)
    if "plate" in cols and _placa_em_uso(oficina_doc, cols["plate"], carteira, ignorar_id=v["id"]):
        raise cart.erro_campo("placa", "Já existe um veículo com esta placa.", http_status.HTTP_409_CONFLICT)
    if "proprietario" in request.data:
        dono_id, origem_doc = _resolver_dono(oficina_doc, request.data["proprietario"], carteira)
        cols["customer_id"], cols["oficina_origem_doc"] = dono_id, origem_doc
    if cols:
        v = (supabase.table(VEICULOS).update({**cols, "updated_at": _now()})
             .eq("id", str(v["id"])).execute().data[0])
    return Response(_montar(oficina_doc, [v], cart.carteira_da_oficina(oficina_doc))[0])
