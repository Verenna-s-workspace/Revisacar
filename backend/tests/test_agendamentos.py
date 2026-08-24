"""
Testes para os endpoints de agendamentos
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
import json

from orders.serializers import AgendamentoSerializer


class AgendamentosTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_agendamento_serializer_validacao(self):
        """Testa a validação do serializer de agendamentos"""
        # Dados válidos
        dados_validos = {
            "cliente": "João Silva",
            "veiculo": "Toyota Corolla",
            "placa": "ABC1234",
            "data": "2023-12-15",
            "horaInicio": "09:00",
            "horaFim": "11:00",
            "titulo": "Revisão",
            "descricao": "Revisão de 10.000 km",
            "status": "agendado",
        }
        serializer = AgendamentoSerializer(data=dados_validos)
        self.assertTrue(serializer.is_valid())

        # Cliente obrigatório
        dados_invalidos = dados_validos.copy()
        dados_invalidos["cliente"] = ""
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("cliente", serializer.errors)

        # Veículo obrigatório
        dados_invalidos = dados_validos.copy()
        dados_invalidos["veiculo"] = ""
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("veiculo", serializer.errors)

        # Placa inválida
        dados_invalidos = dados_validos.copy()
        dados_invalidos["placa"] = "ABCD123"  # placa inválida
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("placa", serializer.errors)

        # Data inválida
        dados_invalidos = dados_validos.copy()
        dados_invalidos["data"] = "15/12/2023"  # formato errado
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("data", serializer.errors)

        # Hora de início inválida
        dados_invalidos = dados_validos.copy()
        dados_invalidos["horaInicio"] = "9:00"  # faltando zero à esquerda
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("horaInicio", serializer.errors)

        # Hora de término inválida
        dados_invalidos = dados_validos.copy()
        dados_invalidos["horaFim"] = "11:0"  # faltando zero à direita
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("horaFim", serializer.errors)

        # Hora de término antes da hora de início
        dados_invalidos = dados_validos.copy()
        dados_invalidos["horaFim"] = "08:00"  # antes da hora de início
        serializer = AgendamentoSerializer(data=dados_invalidos)
        self.assertFalse(serializer.is_valid())
        self.assertIn("horaFim", serializer.errors)  # deveria validar no método validate()

    def test_agendamento_serializer_normalizacao(self):
        """Testa se o serializer normaliza corretamente os campos"""
        dados_entrada = {
            "cliente": "  João Silva  ",  # espaços extras
            "veiculo": "  Toyota Corolla  ",  # espaços extras
            "placa": "abc-1234",  # letras minusculas e hífen
            "data": "2023-12-15",
            "horaInicio": "09:00",
            "horaFim": "11:00",
            "titulo": "  Revisão  ",  # espaços extras
            "descricao": "  Revisão de 10.000 km  ",  # espaços extras
            "status": "  agendado  ",  # espaços extras
        }

        serializer = AgendamentoSerializer(data=dados_entrada)
        self.assertTrue(serializer.is_valid())

        # Verifica se os dados foram normalizados
        validated_data = serializer.validated_data
        self.assertEqual(validated_data["cliente"], "João Silva")  # espaços removidos
        self.assertEqual(validated_data["veiculo"], "Toyota Corolla")  # espaços removidos
        self.assertEqual(validated_data["placa"], "ABC1234")  # maiúsculas e hífen removido
        self.assertEqual(validated_data["titulo"], "Revisão")  # espaços removidos
        self.assertEqual(validated_data["descricao"], "Revisão de 10.000 km")  # espaços removidos
        self.assertEqual(validated_data["status"], "agendado")  # espaços removidos