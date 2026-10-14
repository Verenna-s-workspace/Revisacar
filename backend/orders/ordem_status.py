"""
Status da ordem de serviço (`ordens.status`) e as mudanças permitidas entre eles.

Ciclo de vida (as etapas do orçamento entram nas próximas fases; o vocabulário
já fica definido aqui para o banco e as telas não precisarem mudar de novo):

  rascunho            checklists de entrada/diagnóstico ainda incompletos
  em_orcamento        checklists completos; orçamento sendo montado
  pendente_aprovacao  orçamento enviado, esperando o cliente
  aprovada            cliente aprovou; ainda não começou o serviço
  em_execucao         manutenção em andamento
  aguardando          serviço parado esperando algo (ex.: peça)
  finalizada          serviço CONCLUÍDO (nome mantido por compatibilidade:
                      Relatórios, Visão Geral e Atendimento já leem este valor)
  recusada            encerrada sem execução (cliente recusou / acerto pessoal)

Importante: "finalizada" NÃO significa "checklist preenchido" — até aqui o
salvamento marcava `finalizada` assim que o cabeçalho estava completo, e a OS
entrava no faturamento sem ter sido feita. Agora o salvamento do checklist só
escolhe entre `rascunho` e `em_orcamento`; qualquer outra mudança de status
passa por `PATCH /ordens/<id>/status`, que confere as transições abaixo.
"""

RASCUNHO = "rascunho"
EM_ORCAMENTO = "em_orcamento"
PENDENTE_APROVACAO = "pendente_aprovacao"
APROVADA = "aprovada"
EM_EXECUCAO = "em_execucao"
AGUARDANDO = "aguardando"
FINALIZADA = "finalizada"
RECUSADA = "recusada"

TODOS = (
    RASCUNHO, EM_ORCAMENTO, PENDENTE_APROVACAO, APROVADA,
    EM_EXECUCAO, AGUARDANDO, FINALIZADA, RECUSADA,
)

# Fase em que o salvamento do checklist ainda decide o status sozinho.
PRE_ORCAMENTO = (RASCUNHO, EM_ORCAMENTO)

TRANSICOES = {
    RASCUNHO: {EM_ORCAMENTO, RECUSADA},
    EM_ORCAMENTO: {RASCUNHO, PENDENTE_APROVACAO, APROVADA, RECUSADA},
    PENDENTE_APROVACAO: {EM_ORCAMENTO, APROVADA, RECUSADA},
    APROVADA: {PENDENTE_APROVACAO, EM_EXECUCAO, RECUSADA},
    EM_EXECUCAO: {AGUARDANDO, PENDENTE_APROVACAO, FINALIZADA},
    # RASCUNHO: compatível com o "Desbloquear" que já existia no Atendimento.
    AGUARDANDO: {EM_EXECUCAO, RASCUNHO, FINALIZADA},
    FINALIZADA: set(),
    RECUSADA: {EM_ORCAMENTO},
}


def status_no_salvamento(atual, enviado):
    """Status que vale quando o checklist é salvo (POST/PUT /ordens).

    O cliente só pode escolher entre rascunho e em_orcamento, e só enquanto a OS
    está nessa fase. Fora dela (aprovada, em execução, concluída…) salvar o
    checklist NÃO mexe no status — antes, editar uma OS a devolvia para
    rascunho/finalizada. Valor desconhecido ou de fase posterior (ex.: um app
    desatualizado mandando `finalizada`) é ignorado, não vira erro.
    """
    if atual not in TODOS:                 # OS nova, ou linha antiga com status fora do padrão
        return enviado if enviado in PRE_ORCAMENTO else RASCUNHO
    if atual in PRE_ORCAMENTO and enviado in PRE_ORCAMENTO:
        return enviado
    return atual


def transicao_permitida(atual, novo):
    return novo in TRANSICOES.get(atual, set())


def origens_para(novo):
    """Status de OS dos quais dá pra ir para `novo` (ou que já são `novo`).
    O orçamento passa essa lista ao banco, que confere com a OS TRAVADA — assim
    a tabela de transições continua só aqui."""
    return [s for s in TODOS if s == novo or transicao_permitida(s, novo)]


# Status de OS que aceitam um orçamento NOVO (rascunho de nova versão):
# antes do checklist completo não há o que orçar; depois de concluída, não há
# mais o que mudar. Em execução / aprovada / pendente: é uma revisão do orçamento.
ACEITAM_NOVO_ORCAMENTO = (EM_ORCAMENTO, PENDENTE_APROVACAO, APROVADA, EM_EXECUCAO, RECUSADA)
