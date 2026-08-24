"""
Testes para as funções utilitárias
"""
from django.test import TestCase

from orders.utils import (
    normalize_cpf_cnpj, validate_cpf_cnpj,
    normalize_phone, validate_phone
)


class UtilsTestCase(TestCase):
    def test_normalize_cpf_cnpj(self):
        """Testa a normalização de CPF/CNPJ"""
        self.assertEqual(normalize_cpf_cnpj("123.456.789-09"), "12345678909")
        self.assertEqual(normalize_cpf_cnpj("12.345.678/0001-95"), "12345678000195")
        self.assertEqual(normalize_cpf_cnpj(""), "")
        self.assertEqual(normalize_cpf_cnpj(None), "")

    def test_validate_cpf_cnpj(self):
        """Testa a validação de CPF/CNPJ"""
        # CPFs válidos (exemplos conhecidos)
        self.assertTrue(validate_cpf_cnpj("123.456.789-09"))  # CPF válido
        self.assertTrue(validate_cpf_cnpj("111.444.777-35"))  # CPF válido

        # CNPJs válidos (exemplos conhecidos)
        self.assertTrue(validate_cpf_cnpj("12.345.678/0001-95"))  # CNPJ válido
        self.assertTrue(validate_cpf_cnpj("11.222.333/0001-81"))  # CNPJ válido

        # CPFs inválidos
        self.assertFalse(validate_cpf_cnpj("123.456.789-00"))  # DV inválido
        self.assertFalse(validate_cpf_cnpj("111.111.111-11"))  # todos os dígitos iguais
        self.assertFalse(validate_cpf_cnpj("123.456.789"))  # tamanho incorreto

        # CNPJs inválidos
        self.assertFalse(validate_cpf_cnpj("12.345.678/0001-90"))  # DV inválido
        self.assertFalse(validate_cpf_cnpj("11.111.111/0001-11"))  # todos os dígitos iguais
        self.assertFalse(validate_cpf_cnpj("12.345.678/0001"))  # tamanho incorreto

        # Entradas inválidas
        self.assertFalse(validate_cpf_cnpj(""))
        self.assertFalse(validate_cpf_cnpj(None))
        self.assertFalse(validate_cpf_cnpj("abc.def.ghi-jk"))

    def test_normalize_phone(self):
        """Testa a normalização de telefone"""
        self.assertEqual(normalize_phone("(11) 99999-9999"), "11999999999")
        self.assertEqual(normalize_phone("11-9999-9999"), "1199999999")
        self.assertEqual(normalize_phone(""), "")
        self.assertEqual(normalize_phone(None), "")

    def test_validate_phone(self):
        """Testa a validação de telefone"""
        # Telefones válidos
        self.assertTrue(validate_phone("(11) 99999-9999"))
        self.assertTrue(validate_phone("11999999999"))
        self.assertTrue(validate_phone("(21) 3333-4444"))
        self.assertTrue(validate_phone("2133334444"))

        # Telefones inválidos
        self.assertFalse(validate_phone(""))  # vazio
        self.assertFalse(validate_phone(None))  # None
        self.assertFalse(validate_phone("123"))  # muito curto
        self.assertFalse(validate_phone("1234567890123"))  # muito longo
        self.assertFalse(validate_phone("(01) 9999-9999"))  # DDD inválido
        self.assertFalse(validate_phone("(99) 9999-9999"))  # DDD inválido (99 não é usado)
        self.assertFalse(validate_phone("abc-def-ghij"))  # caracteres não numéricos