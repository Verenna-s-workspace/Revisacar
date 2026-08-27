"""Testes do RBAC — o mapa cargo→permissões é fonte única de verdade e o
front só espelha o claim resolvido no token, então uma regressão aqui vaza
ou bloqueia acesso silenciosamente."""
from orders.rbac import (
    PERMISSOES,
    FUNCIONARIO_CARGOS,
    permissoes_do_cargo,
    cargo_valido_para_funcionario,
)


def test_dono_tem_todas_as_permissoes():
    assert set(permissoes_do_cargo("dono")) == set(PERMISSOES)


def test_gerente_nao_ve_margem_nem_gerencia_funcionarios():
    perms = set(permissoes_do_cargo("gerente"))
    assert "financeiro.ver_margem" not in perms
    assert "funcionarios.gerenciar" not in perms
    assert "ordens.editar" in perms


def test_mecanico_nao_edita_financeiro():
    perms = set(permissoes_do_cargo("mecanico"))
    assert "financeiro.editar" not in perms
    assert "financeiro.ver" not in perms
    assert "ordens.ver" in perms


def test_atendente_cria_ordem_mas_nao_exclui():
    perms = set(permissoes_do_cargo("atendente"))
    assert "ordens.criar" in perms
    assert "ordens.excluir" not in perms


def test_cargo_desconhecido_sem_permissao():
    assert permissoes_do_cargo("hacker") == []


def test_permissoes_do_cargo_ordenado():
    perms = permissoes_do_cargo("gerente")
    assert perms == sorted(perms)


def test_funcionario_nunca_pode_ser_dono():
    assert not cargo_valido_para_funcionario("dono")
    for cargo in FUNCIONARIO_CARGOS:
        assert cargo_valido_para_funcionario(cargo)
