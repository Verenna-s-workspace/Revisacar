"""
Testes para os endpoints de serviços
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
import json

from orders.serializers import ServicoSerializer


class ServicosTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_servico_serializer_validacao(self):
        """Testa a validação do serializer de serviços"""
        # Dados válidos
        dados_validos = {
            "nome": "Troca de óleo",
            "categoria": "Lubrificação",
            "preco": 89.90,
            "duracao": "30 min",
            "descricao": "Troca de óleo e filtro",
            "ativo": True,
        }
        serializer = ServicoSerializer(data=dados_validos)
        self.assertTrue(serializer.is_valid())

        # Nome inválido
        dados_invalidos = dados_validos.copy()
        dados_invalidos["nome"] = ""
        serializer = ServicoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("nome", serializer.errors)

        # Preço inválido (negativo)
        dados_invalidos = dados_validos.copy()
        dados_invalidos["preco"] = -10.00
        serializer = ServicoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("preco", serializer.errors)

        # Preço inválido (zero é permitido? vamos permitir, já que pode ser serviço gratuito)
        # Se quisermos proibir zero, seria:
        """
        dados_invalidos = dados_validos.copy()
        dados_invalidos["preco"] = 0.00
        serializer = ServicoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("preco", serializer.errors)
        """

    def test_servico_serializer_normalizacao(self):
        """Testa se o serializer normaliza corretamente os campos"""
        dados_entrada = {
            "nome": "  Troca de óleo  ",  # espaços extras
            "categoria": "  Lubrificação  ",  # espaços extras
            "preco": 89.90,
            "duracao": "  30 min  ",  # espaços extras
            "descricao": "  Troca de óleo e filtro  ",  # espaços extras
            "ativo": True,
        }

        serializer = ServicoSerializer(data=dados_entrada)
        self.assertTrue(serializer.is_valid())

        # Verifica se os dados foram normalizados
        validated_data = serializer.validated_data
        self.assertEqual(validated_data["nome"], "Troca de óleo")  # espaços removidos
        self.assertEqual(validated_data["categoria"], "Lubrificação")  # espaços removidos
        self.assertEqual(validated_data["duracao"], "30 min")  # espaços removidos
        self.assertEqual(validated_data["descricao"], "Troca de óleo e filtro")  # espaços removidos