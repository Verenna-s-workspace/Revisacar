"""
Testes para os endpoints de veículos
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
import json

from orders.serializers import VeiculoSerializer


class VeiculosTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_veiculo_serializer_validacao(self):
        """Testa a validação do serializer de veículos"""
        # Dados válidos
        dados_validos = {
            "placa": "ABC1234",
            "marca": "Toyota",
            "modelo": "Corolla",
            "ano": 2020,
            "cor": "Prata",
            "categoria": "sedan",
            "quilometragem": 15000,
            "combustivel": "Flex",
            "cambio": "Automático",
            "portas": 4,
        }
        serializer = VeiculoSerializer(data=dados_validos)
        self.assertTrue(serializer.is_valid())

        # Placa inválida
        dados_invalidos = dados_validos.copy()
        dados_invalidos["placa"] = "ABCD123"  # placa inválida
        serializer = VeiculoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("placa", serializer.errors)

        # Ano inválido (muito antigo)
        dados_invalidos = dados_validos.copy()
        dados_invalidos["ano"] = 1940
        serializer = VeiculoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("ano", serializer.errors)

        # Ano inválido (muito recente)
        dados_invalidos = dados_validos.copy()
        dados_invalidos["ano"] = 2050
        serializer = VeiculoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("ano", serializer.errors)

        # Quilometragem negativa
        dados_invalidos = dados_validos.copy()
        dados_invalidos["quilometragem"] = -1000
        serializer = VeiculoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("quilometragem", serializer.errors)

        # Modelo obrigatório
        dados_invalidos = dados_validos.copy()
        dados_invalidos["modelo"] = ""
        serializer = VeiculoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("modelo", serializer.errors)

    def test_veiculo_serializer_normalizacao(self):
        """Testa se o serializer normaliza corretamente os campos"""
        dados_entrada = {
            "placa": "abc-1234",  # letras minusculas e hífen
            "marca": "  toyota  ",  # espaços extras
            "modelo": "  corolla  ",  # espaços extras
            "ano": 2020,
            "cor": "  prata  ",  # espaços extras
            "categoria": "  sedan  ",  # espaços extras
            "quilometragem": 15000,
            "combustivel": "  flex  ",  # espaços extras
            "cambio": "  automático  ",  # espaços extras
            "portas": 4,
        }

        serializer = VeiculoSerializer(data=dados_entrada)
        self.assertTrue(serializer.is_valid())

        # Verifica se os dados foram normalizados
        validated_data = serializer.validated_data
        self.assertEqual(validated_data["placa"], "ABC1234")  # maiúsculas e hífen removido
        self.assertEqual(validated_data["marca"], "Toyota")  # espaços removidos
        self.assertEqual(validated_data["modelo"], "Corolla")  # espaços removidos
        self.assertEqual(validated_data["cor"], "Prata")  # espaços removidos
        self.assertEqual(validated_data["categoria"], "sedan")  # espaços removidos
        self.assertEqual(validated_data["combustivel"], "Flex")  # espaços removidos
        self.assertEqual(validated_data["cambio"], "Automático")  # espaços removidos