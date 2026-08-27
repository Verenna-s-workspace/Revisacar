# ── RBAC: cargos e permissões ──────────────────────────────────────────────
#
# Fonte única de verdade dos cargos e do que cada um pode fazer.
# O front-end NUNCA decide permissão sozinho — ele só espelha o que vier
# resolvido no token (claim "permissoes"). Se quiser mudar o que um cargo
# pode fazer, muda só aqui.

# Cargos atribuíveis a um funcionário (o dono não é um "funcionario", ele é
# a conta admin já existente — ver observação em views.py).
FUNCIONARIO_CARGOS = ("gerente", "mecanico", "atendente")

# Todos os cargos possíveis, incluindo o dono (usado em validações/telas).
CARGOS = ("dono",) + FUNCIONARIO_CARGOS

# Catálogo de permissões — string livre "modulo.acao". Adicionar uma nova
# permissão aqui não afeta nada até você atribuí-la a um cargo abaixo.
PERMISSOES = {
    # Financeiro
    "financeiro.ver",
    "financeiro.editar",          # lançar entrada/saída manual
    "financeiro.ver_margem",      # ver lucro/margem (dado mais sensível)
    # Configurações
    "configuracoes.ver",
    "configuracoes.editar",       # dados da oficina, horários, ticket
    "funcionarios.gerenciar",     # cadastrar/editar cargo/desativar funcionário
    # Ordens de serviço
    "ordens.ver",
    "ordens.criar",
    "ordens.editar",
    "ordens.excluir",
    # Estoque
    "estoque.ver",
    "estoque.editar",
    # Clientes e veículos
    "clientes.ver",
    "clientes.editar",
    # Agendamentos
    "agendamentos.ver",
    "agendamentos.editar",
    # Relatórios
    "relatorios.ver",
}

# Mapa cargo → permissões. Dono sempre tem tudo (calculado, não listado à
# mão, pra nunca ficar desatualizado se PERMISSOES crescer).
CARGO_PERMISSOES: dict[str, frozenset[str]] = {
    "dono": frozenset(PERMISSOES),
    "gerente": frozenset(PERMISSOES - {
        # Gerente faz o dia a dia todo, mas não vê margem de lucro nem
        # mexe em quem tem acesso a quê — ajuste se quiser diferente.
        "financeiro.ver_margem",
        "funcionarios.gerenciar",
    }),
    "mecanico": frozenset({
        "ordens.ver",
        "ordens.editar",
        "estoque.ver",
        "clientes.ver",
        "agendamentos.ver",
    }),
    "atendente": frozenset({
        "ordens.ver",
        "ordens.criar",
        "clientes.ver",
        "clientes.editar",
        "agendamentos.ver",
        "agendamentos.editar",
        "estoque.ver",
    }),
}


def permissoes_do_cargo(cargo: str) -> list[str]:
    """Resolve a lista de permissões de um cargo. Cargo desconhecido = sem nenhuma."""
    return sorted(CARGO_PERMISSOES.get(cargo, frozenset()))


def cargo_valido_para_funcionario(cargo: str) -> bool:
    """Um funcionário nunca pode ser cadastrado como 'dono' — só a conta admin é dono."""
    return cargo in FUNCIONARIO_CARGOS
