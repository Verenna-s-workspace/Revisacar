"""
Agenda da oficina (tela Agendamentos) — inclui os PEDIDOS que o cliente faz pelo app.

Permissões (ver rbac.py):
  agendamentos.ver     → lista e consulta (todos os cargos)
  agendamentos.editar  → cria, edita, confirma/recusa e exclui (dono, gerente e atendente)

Tabela: appointments (a mesma do app do cliente), sempre filtrada por `oficina_doc`.

Status — um vocabulário só para os dois apps (banco → API):
  pendente   pedido do cliente (app) esperando a oficina       → "pendente"
  confirmado agendado                                          → "agendado"   (nome que a tela já usa)
  em_andamento, aguardando_pagamento, pronto_retirada, concluido, cancelado → iguais
  recusado   a oficina recusou o pedido (motivo em rejection_reason) → "recusado"
Agendamento criado pela oficina já nasce confirmado. Confirmar/recusar um pedido avisa o cliente do app
(tabela notifications) — só quando ele tem conta no app.

Agendamento × OS (só na leitura, nada é gravado): o agendamento acompanha a OS do mesmo carro.
  - Ligação: `ordem_id` gravado ("Iniciar Atendimento") ou, sem ele, a OS da mesma oficina com o mesmo
    veículo (vehicle_id) ou a mesma placa e o mesmo dia (data de entrada da OS). Só liga com UMA candidata
    — duas OS do carro no dia, ou dois agendamentos disputando a mesma OS, ficam sem ligação.
  - Status: só os de andamento (agendado, em_andamento, aguardando_pagamento, pronto_retirada) seguem a
    OS; pendente, cancelado, recusado e concluido são decisão de alguém e ficam. OS aberta → em_andamento;
    finalizada com entrada pendente no Financeiro → aguardando_pagamento; finalizada paga → concluido;
    recusada → concluido (o cliente veio e foi atendido).

Formato JSON: `Agendamento` (frontend/src/types/agendamento.ts) + `clienteId`, `veiculoId`, `motivoRecusa`.
O formulário manda cliente/veículo/placa como TEXTO: o cliente é resolvido (ou cadastrado de balcão) como em
veiculos_views.py; o veículo, se a placa já existe entre os do cliente. O rótulo é guardado em vehicle_label
como "Marca Modelo — PLACA" (mesmo formato do app do cliente).
"""
import json
import logging
import re
from collections import Counter
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import carteira as cart
from . import veiculos_views as veic
from .estoque_views import _corpo_valido, _listar_todos, _negado, _nao_encontrado, _uuid_valido
from .paralelo import em_paralelo
from .views import supabase, require_auth, _now, _oficina_doc_do_token

log = logging.getLogger(__name__)

AGENDA = "appointments"
DURACAO_PADRAO_MIN = 60
SEPARADOR = " — "

DB_PARA_API = {"confirmado": "agendado"}
API_PARA_DB = {"agendado": "confirmado"}
OPERACIONAIS = {"confirmado", "em_andamento", "aguardando_pagamento", "pronto_retirada", "concluido"}
STATUS_API = ("pendente", "agendado", "em_andamento", "aguardando_pagamento", "pronto_retirada",
              "concluido", "cancelado", "recusado")

HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

SEGUE_A_OS = {"confirmado", "em_andamento", "aguardando_pagamento", "pronto_retirada"}
FUSO_PADRAO = ZoneInfo("America/Sao_Paulo")


def _transicao_permitida(de: str, para: str) -> bool:
    """pendente só sai confirmando, recusando ou cancelando; recusado é final; concluído não volta.
    Entre os estados operacionais a tela deixa escolher qualquer um (mesmo comportamento de hoje)."""
    if de == para:
        return True
    if de == "pendente":
        return para in {"confirmado", "recusado", "cancelado"}
    if de == "recusado":
        return False
    if de == "concluido":
        return False
    if de == "cancelado":
        return para == "confirmado"
    return para in OPERACIONAIS | {"cancelado"}


# ── Mapeamento ────────────────────────────────────────────────────────────────

def _hhmm(valor) -> str:
    return str(valor)[:5] if valor else ""


def _hora_fim(row: dict) -> str:
    if row.get("hora_fim"):
        return _hhmm(row["hora_fim"])
    inicio = datetime.combine(date.today(), time.fromisoformat(_hhmm(row["time_slot"])))
    return (inicio + timedelta(minutes=DURACAO_PADRAO_MIN)).strftime("%H:%M")


def _veiculo_e_placa(rotulo):
    if not rotulo:
        return "", ""
    nome, sep, placa = rotulo.rpartition(SEPARADOR)
    return (nome, placa) if sep else (rotulo, "")


def agendamento_para_api(row: dict, cliente: dict | None, mecanico: dict | None) -> dict:
    veiculo, placa = _veiculo_e_placa(row.get("vehicle_label"))
    status_db = row.get("status") or "pendente"
    out = {
        "id": str(row["id"]),
        "cliente": (cliente or {}).get("name") or "",
        "clienteId": str(row["customer_id"]) if row.get("customer_id") else None,
        "veiculo": veiculo,
        "placa": placa,
        "data": str(row["date"]),
        "horaInicio": _hhmm(row["time_slot"]),
        "horaFim": _hora_fim(row),
        "titulo": row["service_type"],
        "descricao": row.get("service_description") or "",
        "status": DB_PARA_API.get(status_db, status_db),
        "createdAt": row.get("created_at"),
    }
    if row.get("vehicle_id"):
        out["veiculoId"] = str(row["vehicle_id"])
    if mecanico:
        out["mecanico"] = mecanico["nome"]
    if row.get("ordem_id"):
        out["ordemServicoId"] = row["ordem_id"]
    if row.get("updated_at"):
        out["updatedAt"] = row["updated_at"]
    if row.get("reagend_data_anterior"):
        out["reagendamento"] = {
            "dataAnterior": str(row["reagend_data_anterior"]),
            "novaData": str(row["date"]),
            **({"horaAnterior": _hhmm(row["reagend_hora_anterior"])} if row.get("reagend_hora_anterior") else {}),
            "novaHora": _hhmm(row["time_slot"]),
            **({"motivo": row["reagend_motivo"]} if row.get("reagend_motivo") else {}),
        }
    if status_db == "recusado" and row.get("rejection_reason"):
        out["motivoRecusa"] = row["rejection_reason"]
    if row.get("notes"):
        out["observacoes"] = row["notes"]
    return out


# ── Agendamento × OS ──────────────────────────────────────────────────────────

def status_pela_os(status_os: str, a_receber: bool) -> str:
    if status_os == "finalizada":
        return "aguardando_pagamento" if a_receber else "concluido"
    if status_os == "recusada":
        return "concluido"
    return "em_andamento"


def _dia_da_os(ordem: dict) -> str:
    """Data de entrada da OS (os_header.os_date); sem ela, o dia em que foi criada, no fuso da oficina."""
    payload = ordem.get("payload")
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            payload = None
    dia = str(((payload or {}).get("os_header") or {}).get("os_date") or "")[:10] if isinstance(payload, dict) else ""
    if dia:
        return dia
    criado = str(ordem.get("created_at") or "")
    try:
        quando = datetime.fromisoformat(criado.replace("Z", "+00:00"))
    except ValueError:
        return criado[:10]
    return (quando.astimezone(FUSO_PADRAO) if quando.tzinfo else quando).date().isoformat()


def _placa_do_agendamento(linha: dict) -> str:
    return cart.normalizar_placa(_veiculo_e_placa(linha.get("vehicle_label"))[1])


def _seguir_as_os(oficina_doc: str, linhas):
    """As linhas com `ordem_id` e `status` vindos da OS ligada (ver o topo do módulo). Melhor esforço:
    qualquer falha devolve as linhas como estão no banco."""
    alvo = [linha for linha in linhas if linha.get("status") in SEGUE_A_OS]
    if not alvo:
        return linhas
    try:
        # A disputa (dois agendamentos pela mesma OS) é vista no DIA inteiro, não só nas linhas pedidas:
        # senão GET /agendamentos/<id> e a lista dariam respostas diferentes.
        do_dia = {str(li["id"]): li for li in cart.buscar_por_ids(
            AGENDA, {str(li["date"]) for li in alvo}, coluna="date",
            extra=lambda q: q.eq("oficina_doc", oficina_doc))}
        do_dia.update({str(li["id"]): li for li in alvo})
        do_dia = [li for li in do_dia.values() if li.get("status") in SEGUE_A_OS]
        explicitas = [str(linha["ordem_id"]) for linha in do_dia if linha.get("ordem_id")]
        sem_os = [linha for linha in do_dia if not linha.get("ordem_id")]
        placas = set()
        for linha in sem_os:
            p = _placa_do_agendamento(linha)
            if p:
                placas.add(p)
                if re.fullmatch(r"[A-Z]{3}\d{4}", p):  # placa antiga também pode estar salva como ABC-1234
                    placas.add(f"{p[:3]}-{p[3:]}")

        def da_oficina(q):
            return q.eq("oficina_doc", oficina_doc)
        ordens = {}
        por_id, por_veiculo, por_placa = em_paralelo(
            lambda: cart.buscar_por_ids("ordens", explicitas, extra=da_oficina),
            lambda: cart.buscar_por_ids("ordens", [li["vehicle_id"] for li in sem_os if li.get("vehicle_id")],
                                        coluna="vehicle_id", extra=da_oficina),
            lambda: cart.buscar_por_ids("ordens", placas, coluna="placa", extra=da_oficina))
        for o in por_id + por_veiculo + por_placa:
            ordens[str(o["id"])] = o

        candidatas = {}
        for linha in sem_os:
            placa, veiculo, dia = _placa_do_agendamento(linha), linha.get("vehicle_id"), str(linha["date"])
            candidatas[str(linha["id"])] = [
                oid for oid, o in ordens.items()
                if oid not in explicitas and _dia_da_os(o) == dia
                and ((veiculo and str(o.get("vehicle_id")) == str(veiculo))
                     or (placa and cart.normalizar_placa(o.get("placa")) == placa))]
        disputa = Counter(oid for c in candidatas.values() for oid in c)
        ordem_de = {str(li["id"]): str(li["ordem_id"]) for li in do_dia if li.get("ordem_id")}
        ordem_de.update({aid: c[0] for aid, c in candidatas.items() if len(c) == 1 and disputa[c[0]] == 1})

        finalizadas = [oid for oid in set(ordem_de.values()) if (ordens.get(oid) or {}).get("status") == "finalizada"]
        try:
            a_receber = {str(t["ordem_servico_id"]) for t in cart.buscar_por_ids(
                "financeiro_transacoes", finalizadas, coluna="ordem_servico_id",
                extra=lambda q: q.eq("oficina_doc", oficina_doc).eq("tipo", "entrada").eq("status", "pendente"))}
        except Exception:  # noqa: BLE001 — sem o Financeiro não dá pra saber se foi pago: finalizada fica como está
            log.warning("Agenda: não consegui ler o Financeiro para os agendamentos.", exc_info=True)
            a_receber = None
    except Exception:  # noqa: BLE001 — a agenda continua aparecendo, só sem acompanhar a OS
        log.warning("Agenda: não consegui ligar os agendamentos às OS.", exc_info=True)
        return linhas

    saida = []
    for linha in linhas:
        oid = ordem_de.get(str(linha["id"]))
        o = ordens.get(oid) if oid else None
        if o is None or (o.get("status") == "finalizada" and a_receber is None):
            saida.append(linha)
            continue
        saida.append({**linha, "ordem_id": oid, "status": status_pela_os(o.get("status"), oid in (a_receber or ()))})
    return saida


def _montar(oficina_doc: str, linhas):
    # Clientes e mecânicos não dependem da OS ligada: as três buscas saem juntas (ver paralelo.py).
    func_ids = [l["mecanico_id"] for l in linhas if l.get("mecanico_id")]
    linhas, lista_clientes, lista_funcs = em_paralelo(
        lambda: _seguir_as_os(oficina_doc, linhas),
        lambda: cart.buscar_por_ids(cart.CLIENTES, [l.get("customer_id") for l in linhas]),
        (lambda: cart.buscar_por_ids("funcionarios", func_ids)) if func_ids else list)
    clientes = {str(c["id"]): c for c in lista_clientes}
    funcs = {str(f["id"]): f for f in lista_funcs}
    return [agendamento_para_api(l, clientes.get(str(l.get("customer_id"))), funcs.get(str(l.get("mecanico_id"))))
            for l in linhas]


# ── Validação ─────────────────────────────────────────────────────────────────

def _data(valor, campo, erros):
    try:
        return date.fromisoformat(str(valor)).isoformat()
    except (ValueError, TypeError):
        erros[campo] = ["Data inválida (use AAAA-MM-DD)."]
        return None


def _hora(valor, campo, erros):
    if not isinstance(valor, str) or not HORA_RE.match(valor):
        erros[campo] = ["Horário inválido (use HH:MM)."]
        return None
    return valor


def _mecanico_por_nome(oficina_doc: str, nome):
    nome = (nome or "").strip()
    if not nome:
        return None
    for f in supabase.table("funcionarios").select("id,nome,ativo").eq("oficina_doc", oficina_doc).execute().data or []:
        if f.get("ativo") and (f["nome"] or "").strip().lower() == nome.lower():
            return f
    raise cart.erro_campo("mecanico", "Funcionário não encontrado nesta oficina.")


def _avisar_cliente(row: dict, cliente: dict | None, titulo: str, mensagem: str):
    """Notificação no app do cliente. Só quando ele tem conta; nunca derruba a ação principal."""
    if not cliente or cliente.get("origem") != "app":
        return
    try:
        supabase.table("notifications").insert({
            "customer_id": str(cliente["id"]), "title": titulo, "message": mensagem,
            "type": "agendamento", "action_url": "/agendamentos",
        }).execute()
    except Exception:  # noqa: BLE001 — aviso é best-effort
        import logging
        logging.getLogger(__name__).warning("Não consegui avisar o cliente %s do agendamento", cliente.get("id"), exc_info=True)


def _resolver_cliente_e_veiculo(oficina_doc: str, dados: dict):
    """(customer, veiculo|None, rótulo). Prioridade: clienteId → placa de veículo da carteira →
    nome (achado ou cadastrado de balcão)."""
    erros = {}
    veiculo_txt = (dados.get("veiculo") or "").strip() if isinstance(dados.get("veiculo"), str) else ""
    placa = cart.normalizar_placa(dados.get("placa"))
    carteira = cart.carteira_da_oficina(oficina_doc)
    cliente = veiculo = None

    if dados.get("clienteId"):
        achado = cart.cliente_da_carteira(oficina_doc, dados["clienteId"]) if _uuid_valido(dados["clienteId"]) else None
        if not achado:
            raise cart.erro_campo("clienteId", "Cliente não encontrado.")
        cliente = achado[0]
    if dados.get("veiculoId"):
        veiculo, _ = veic._veiculo_da_oficina(oficina_doc, dados["veiculoId"], carteira) \
            if _uuid_valido(dados["veiculoId"]) else (None, carteira)
        if not veiculo:
            raise cart.erro_campo("veiculoId", "Veículo não encontrado.")
        if cliente is None and veiculo.get("customer_id"):
            cliente = next((c for c, _ in carteira if str(c["id"]) == str(veiculo["customer_id"])), None)
    elif placa:
        for v in veic._veiculos_visiveis(oficina_doc, carteira):
            if (v.get("plate_norm") or cart.normalizar_placa(v["plate"])) == placa and \
                    (cliente is None or str(v.get("customer_id")) == str(cliente["id"])):
                veiculo = v
                if cliente is None and v.get("customer_id"):
                    cliente = next((c for c, _ in carteira if str(c["id"]) == str(v["customer_id"])), None)
                break

    if cliente is None:
        nome = (dados.get("cliente") or "").strip() if isinstance(dados.get("cliente"), str) else ""
        if not nome:
            erros["cliente"] = ["Obrigatório."]
            raise cart.ErroCarteira(erros)
        cliente, _ = cart.resolver_cliente(oficina_doc, nome)

    if veiculo is not None:
        rotulo_nome = f"{veiculo['brand']} {veiculo['model']}".strip()
        placa = placa or veiculo.get("plate_norm") or cart.normalizar_placa(veiculo["plate"])
        veiculo_txt = veiculo_txt or rotulo_nome
    rotulo = f"{veiculo_txt}{SEPARADOR}{placa}" if veiculo_txt and placa else (veiculo_txt or placa or None)
    return cliente, veiculo, rotulo


# ── Rotas ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@require_auth
@cart.tratar_erros_carteira
def agendamentos_list(request):
    """
    GET  /agendamentos[?de=AAAA-MM-DD&ate=AAAA-MM-DD&status=...]  → agenda da oficina (por data/hora)
    POST /agendamentos  → cria já confirmado. data, horaInicio, horaFim, titulo e cliente (nome ou clienteId)
    """
    negado = _negado(request, "agendamentos.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)

    if request.method == "POST":
        negado = _negado(request, "agendamentos.editar")
        if negado:
            return negado
        dados = request.data
        if not _corpo_valido(request):
            return Response({"detail": "Corpo inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
        erros = {}
        data = _data(dados.get("data"), "data", erros)
        inicio = _hora(dados.get("horaInicio"), "horaInicio", erros)
        fim = _hora(dados.get("horaFim"), "horaFim", erros)
        if inicio and fim and fim <= inicio:
            erros["horaFim"] = ["Deve ser depois do início."]
        _, titulo = cart.texto(dados, "titulo", 100, erros, obrigatorio=True)
        _, descricao = cart.texto(dados, "descricao", 1000, erros)
        if erros:
            raise cart.ErroCarteira(erros)

        mecanico = _mecanico_por_nome(oficina_doc, dados.get("mecanico"))
        cliente, veiculo, rotulo = _resolver_cliente_e_veiculo(oficina_doc, dados)
        agora = _now()
        criado = supabase.table(AGENDA).insert({
            "oficina_doc": oficina_doc, "customer_id": str(cliente["id"]),
            "vehicle_id": str(veiculo["id"]) if veiculo else None, "vehicle_label": rotulo,
            "service_type": titulo, "service_description": descricao or None,
            "date": data, "time_slot": inicio, "hora_fim": fim, "status": "confirmado",
            "mecanico_id": str(mecanico["id"]) if mecanico else None,
            "confirmado_em": agora, "confirmado_por_nome": request.admin.get("nome") or "",
        }).execute().data[0]
        return Response(_montar(oficina_doc, [criado])[0], status=http_status.HTTP_201_CREATED)

    erros = {}
    de = _data(request.query_params["de"], "de", erros) if "de" in request.query_params else None
    ate = _data(request.query_params["ate"], "ate", erros) if "ate" in request.query_params else None
    filtro_status = request.query_params.get("status")
    if filtro_status and filtro_status not in STATUS_API:
        erros["status"] = [f"Use um de: {', '.join(STATUS_API)}."]
    if erros:
        raise cart.ErroCarteira(erros)

    def consulta():
        q = supabase.table(AGENDA).select("*").eq("oficina_doc", oficina_doc)
        if de:
            q = q.gte("date", de)
        if ate:
            q = q.lte("date", ate)
        return q.order("date", desc=True).order("time_slot", desc=True).order("id")
    agenda = _montar(oficina_doc, _listar_todos(consulta))
    if filtro_status:  # depois de montar: o status pode vir da OS, não só do banco
        agenda = [a for a in agenda if a["status"] == filtro_status]
    return Response(agenda)


def _linha_da_oficina(oficina_doc: str, agendamento_id):
    r = (supabase.table(AGENDA).select("*").eq("id", str(agendamento_id)).eq("oficina_doc", oficina_doc)
         .limit(1).execute().data)
    return r[0] if r else None


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
@cart.tratar_erros_carteira
def agendamento_detail(request, agendamento_id):
    """
    GET    /agendamentos/<id>  → um agendamento
    PATCH  /agendamentos/<id>  → edição parcial: data, horaInicio, horaFim, titulo, descricao, status,
                                 mecanico, ordemServicoId, motivoRecusa, reagendamento.motivo.
                                 Mudar data/hora guarda a data/hora anteriores (reagendamento).
    DELETE /agendamentos/<id>  → só pedido/recusado/cancelado; os demais devem ser cancelados antes
    """
    negado = _negado(request, "agendamentos.ver")
    if negado:
        return negado
    oficina_doc = _oficina_doc_do_token(request.admin)
    if not _uuid_valido(agendamento_id):
        return _nao_encontrado("Agendamento não encontrado.")
    row = _linha_da_oficina(oficina_doc, agendamento_id)
    if not row:
        return _nao_encontrado("Agendamento não encontrado.")

    if request.method == "GET":
        return Response(_montar(oficina_doc, [row])[0])

    negado = _negado(request, "agendamentos.editar")
    if negado:
        return negado

    if request.method == "DELETE":
        if row["status"] not in ("pendente", "recusado", "cancelado"):
            return Response({"detail": "Cancele o agendamento antes de excluir."}, status=http_status.HTTP_409_CONFLICT)
        supabase.table(AGENDA).delete().eq("id", str(row["id"])).eq("oficina_doc", oficina_doc).execute()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    dados = request.data
    if not _corpo_valido(request):
        return Response({"detail": "Corpo inválido."}, status=http_status.HTTP_400_BAD_REQUEST)
    erros, upd = {}, {}

    if "data" in dados:
        data = _data(dados["data"], "data", erros)
        if data:
            upd["date"] = data
    if "horaInicio" in dados:
        h = _hora(dados["horaInicio"], "horaInicio", erros)
        if h:
            upd["time_slot"] = h
    if "horaFim" in dados:
        h = _hora(dados["horaFim"], "horaFim", erros)
        if h:
            upd["hora_fim"] = h
    inicio_final = upd.get("time_slot") or _hhmm(row["time_slot"])
    fim_final = upd.get("hora_fim") or (_hhmm(row["hora_fim"]) if row.get("hora_fim") else None)
    if ("time_slot" in upd or "hora_fim" in upd) and fim_final and fim_final <= inicio_final:
        erros["horaFim"] = ["Deve ser depois do início."]
    ok, v = cart.texto(dados, "titulo", 100, erros, obrigatorio=True, parcial=True)
    if ok:
        upd["service_type"] = v
    ok, v = cart.texto(dados, "descricao", 1000, erros)
    if ok:
        upd["service_description"] = v or None
    if "ordemServicoId" in dados:
        ordem = dados["ordemServicoId"]
        if ordem in (None, ""):
            upd["ordem_id"] = None
        elif isinstance(ordem, str):
            upd["ordem_id"] = ordem  # a FK composta (oficina_doc, ordem_id) recusa OS de outra oficina
        else:
            erros["ordemServicoId"] = ["Inválido."]
    if erros:
        raise cart.ErroCarteira(erros)
    if "mecanico" in dados:
        m = _mecanico_por_nome(oficina_doc, dados["mecanico"])
        upd["mecanico_id"] = str(m["id"]) if m else None

    novo_status = None
    if "status" in dados:
        if dados["status"] not in STATUS_API:
            raise cart.erro_campo("status", f"Use um de: {', '.join(STATUS_API)}.")
        novo_status = API_PARA_DB.get(dados["status"], dados["status"])
        if not _transicao_permitida(row["status"], novo_status):
            return Response(
                {"detail": f"Não dá para mudar de \"{DB_PARA_API.get(row['status'], row['status'])}\" "
                           f"para \"{dados['status']}\"."},
                status=http_status.HTTP_409_CONFLICT)
        if novo_status != row["status"]:
            upd["status"] = novo_status
            if novo_status == "confirmado" and row["status"] == "pendente":
                upd["confirmado_em"] = _now()
                upd["confirmado_por_nome"] = request.admin.get("nome") or ""
            if novo_status == "recusado":
                ok, motivo = cart.texto(dados, "motivoRecusa", 500, erros)
                if erros:
                    raise cart.ErroCarteira(erros)
                upd["rejection_reason"] = motivo or None

    status_anterior = row["status"]
    mudou_horario = ("date" in upd and upd["date"] != str(row["date"])) or \
                    ("time_slot" in upd and upd["time_slot"] != _hhmm(row["time_slot"]))
    if mudou_horario:  # guarda a data/hora de antes da ÚLTIMA remarcação
        upd["reagend_data_anterior"] = str(row["date"])
        upd["reagend_hora_anterior"] = _hhmm(row["time_slot"])
        reag = dados.get("reagendamento") if isinstance(dados.get("reagendamento"), dict) else {}
        ok, motivo = cart.texto(reag, "motivo", 300, erros)
        if erros:
            raise cart.ErroCarteira(erros)
        upd["reagend_motivo"] = motivo or None

    if upd:
        row = (supabase.table(AGENDA).update({**upd, "updated_at": _now()})
               .eq("id", str(row["id"])).eq("oficina_doc", oficina_doc).execute().data[0])
        if status_anterior == "pendente" and upd.get("status") in ("confirmado", "recusado"):  # respondeu um pedido
            cli = cart.buscar_por_ids(cart.CLIENTES, [row.get("customer_id")])
            titulo = "Agendamento confirmado" if upd["status"] == "confirmado" else "Pedido de agendamento recusado"
            msg = f"{row['service_type']} em {row['date']} às {_hhmm(row['time_slot'])}."
            if upd["status"] == "recusado" and row.get("rejection_reason"):
                msg += f" Motivo: {row['rejection_reason']}"
            _avisar_cliente(row, cli[0] if cli else None, titulo, msg)
    return Response(_montar(oficina_doc, [row])[0])
