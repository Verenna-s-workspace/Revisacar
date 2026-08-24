"""
Testes para os endpoints de clientes
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
import json

from orders.serializers import ClienteSerializer
from orders.utils import normalize_cpf_cnpj, validate_cpf_cnpj, normalize_phone, validate_phone


class ClientesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Nota: estes testes não incluem autenticação para simplificar
        # Em um teste real, seria necessário criar um admin e fazer login

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
        self.assertFalse(validate_cpf_cnpj("12.345.678/0001-95"))  # tamanho incorreto (faltando dígitos)

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

    def test_cliente_serializer_validacao(self):
        """Testa a validação do serializer de clientes"""
        # Dados válidos
        dados_validos = {
            "nome": "João Silva",
            "doc": "123.456.789-09",
            "telefone": "(11) 99999-9999",
            "email": "joao@email.com",
            "endereco": "Rua Exemplo, 123",
            "observacoes": "Cliente de teste"
        }
        serializer = ClienteSerializer(data=dados_validos)
        self.assertTrue(serializer.is_valid())

        # Nome obrigatório
        dados_invalidos = dados_validos.copy()
        dados_invalidos["nome"] = ""
        serializer = ClienteSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("nome", serializer.errors)

        # CPF inválido
        dados_invalidos = dados_validos.copy()
        dados_invalidos["doc"] = "123.456.789-00"  # CPF com DV inválido
        serializer = ClienteSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("doc", serializer.errors)

        # Telefone inválido
        dados_invalidos = dados_validos.copy()
        dados_invalidos["telefone"] = "123"  # telefone muito curto
        serializer = ClienteSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("telefone", serializer.errors)

    def test_cliente_serializer_normalizacao(self):
        """Testa se o serializer normaliza corretamente os campos"""
        dados_entrada = {
            "nome": "  João Silva  ",  # espaços extras
            "doc": "123.456.789-09",   # CPF com formatação
            "telefone": "(11) 99999-9999",  # telefone com formatação
            "email": "joao@email.com",
            "endereco": "Rua Exemplo, 123",
            "observacoes": "Cliente de teste"
        }

        serializer = ClienteSerializer(data=dados_entrada)
        self.assertTrue(serializer.is_valid())

        # Verifica se os dados foram normalizados
        validated_data = serializer.validated_data
        self.assertEqual(validated_data["nome"], "João Silva")  # espaços removidos
        self.assertEqual(validated_data["doc"], "12345678909")   # apenas números
        self.assertEqual(validated_data["telefone"], "11999999999")  # apenas números