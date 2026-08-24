"""
Testes para os endpoints de estoque
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
import json

from orders.serializers import EstoqueSerializer


class EstoqueTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_estoque_serializer_validacao(self):
        """Testa a validação do serializer de estoque"""
        # Dados válidos
        dados_validos = {
            "nome": "Filtro de óleo",
            "categoria": "Filtros",
            "quantidade": 50,
            "unidade": "un",
            "localizacao": "Prateleira A1",
            "estoqueMinimo": 10,
            "criadoPor": "admin",
        }
        serializer = EstoqueSerializer(data=dados_validos)
        self.assertTrue(serializer.is_valid())

        # Nome inválido
        dados_invalidos = dados_validos.copy()
        dados_invalidos["nome"] = ""
        serializer = EstoqueSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("nome", serializer.errors)

        # Quantidade negativa
        dados_invalidos = dados_validos.copy()
        dados_invalidos["quantidade"] = -5
        serializer = EstoqueSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("quantidade", serializer.errors)

        # Estoque mínimo negativo
        dados_invalidos = dados_validos.copy()
        dados_invalidos["estoqueMinimo"] = -5
        serializer = EstoqueSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("estoqueMinimo", serializer.errors)

    def test_estoque_serializer_normalizacao(self):
        """Testa se o serializer normaliza corretamente os campos"""
        dados_entrada = {
            "nome": "  Filtro de óleo  ",  # espaços extras
            "categoria": "  Filtros  ",  # espaços extras
            "quantidade": 50,
            "unidade": "  un  ",  # espaços extras
            "localizacao": "  Prateleira A1  ",  # espaços extras
            "estoqueMinimo": 10,
            "criadoPor": "  admin  ",  # espaços extras
        }

        serializer = EstoqueSerializer(data=dados_entrada)
        self.assertTrue(serializer.is_valid())

        # Verifica se os dados foram normalizados
        validated_data = serializer.validated_data
        self.assertEqual(validated_data["nome"], "Filtro de óleo")  # espaços removidos
        self.assertEqual(validated_data["categoria"], "Filtros")  # espaços removidos
        self.assertEqual(validated_data["unidade"], "un")  # espaços removidos
        self.assertEqual(validated_data["localizacao"], "Prateleira A1")  # espaços removidos
        self.assertEqual(validated_data["criadoPor"], "admin")  # espaços removidos