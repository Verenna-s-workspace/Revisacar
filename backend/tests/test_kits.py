"""
Testes para os endpoints de kits
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
import json

from orders.serializers import KitSerializer


class KitsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_kit_serializer_validacao(self):
        """Testa a validação do serializer de kits"""
        # Dados válidos
        dados_validos = {
            "nome": "Kit Básico",
            "descricao": "Kit com itens essenciais para manutenção",
            "criadoPor": "admin",
        }
        serializer = KitSerializer(data=dados_validos)
        self.assertTrue(serializer.is_valid())

        # Nome inválido
        dados_invalidos = dados_validos.copy()
        dados_invalidos["nome"] = ""
        serializer = KitSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("nome", serializer.errors)

    def test_kit_serializer_normalizacao(self):
        """Testa se o serializer normaliza corretamente os campos"""
        dados_entrada = {
            "nome": "  Kit Básico  ",  # espaços extras
            "descricao": "  Kit com itens essenciais para manutenção  ",  # espaços extras
            "criadoPor": "  admin  ",  # espaços extras
        }

        serializer = KitSerializer(data=dados_entrada)
        self.assertTrue(serializer.is_valid())

        # Verifica se os dados foram normalizados
        validated_data = serializer.validated_data
        self.assertEqual(validated_data["nome"], "Kit Básico")  # espaços removidos
        self.assertEqual(validated_data["descricao"], "Kit com itens essenciais para manutenção")  # espaços removidos
        self.assertEqual(validated_data["criadoPor"], "admin")  # espaços removidos