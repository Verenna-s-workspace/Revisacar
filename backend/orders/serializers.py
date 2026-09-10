import re
from rest_framework import serializers
from django.contrib.auth.hashers import make_password, check_password
from . import utils

# ── Helper functions for validation ─────────────────────────────────────

def normalize_doc(value: str) -> str:
    return utils.normalize_cpf_cnpj(value or "")

# ── Sub-serializers ────────────────────────────────────────────────────────────

class OSHeaderSerializer(serializers.Serializer):
    os_num = serializers.CharField()
    os_date = serializers.CharField(default="")
    os_time = serializers.CharField(default="")
    os_km = serializers.CharField(default="")

    def validate_os_num(self, value):
        if not value.strip():
            raise serializers.ValidationError("os_num não pode ser vazio")
        return value.strip()

    def validate_os_date(self, value):
        if value and not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            raise serializers.ValidationError("os_date inválido (esperado AAAA-MM-DD)")
        return value

    def validate_os_time(self, value):
        if value and not re.match(r"^\d{2}:\d{2}$", value):
            raise serializers.ValidationError("os_time inválido (esperado HH:MM)")
        return value


class ClienteSerializer(serializers.Serializer):
    nome = serializers.CharField()
    doc = serializers.CharField()  # CPF ou CNPJ
    telefone = serializers.CharField()
    email = serializers.CharField(default="")
    endereco = serializers.CharField(default="")
    observacoes = serializers.CharField(default="")
    pin = serializers.CharField(required=False, allow_blank=True)  # PIN de 6 dígitos (opcional)
    createdAt = serializers.CharField(default="")
    updatedAt = serializers.CharField(default="")

    def to_internal_value(self, data):
        # enviar tanto doc quanto cpfCnpj
        if 'cpfCnpj' in data and 'doc' not in data:
            data = data.copy()  # Don't modify original data
            data['doc'] = data['cpfCnpj']
        return super().to_internal_value(data)

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome obrigatório")
        return value.strip()

    def validate_doc(self, value):
        # Handle None or empty values
        if value is None:
            raise serializers.ValidationError("CPF/CNPJ é obrigatório")

        # Convert to string in case it's not
        value_str = str(value).strip()

        if not value_str:
            raise serializers.ValidationError("CPF/CNPJ é obrigatório")

        if not utils.validate_cpf_cnpj(value_str):
            # Provide more specific error message based on what we can detect
            normalized = utils.normalize_cpf_cnpj(value_str)
            if len(normalized) == 0:
                raise serializers.ValidationError("CPF/CNPJ não pode conter apenas espaços ou caracteres não numéricos")
            elif len(normalized) not in [11, 14]:
                raise serializers.ValidationError(f"CPF/CNPJ deve ter 11 ou 14 dígitos, recebido: {len(normalized)}")
            else:
                raise serializers.ValidationError("CPF/CNPJ inválido")

        return utils.normalize_cpf_cnpj(value_str)

    def validate_telefone(self, value):
        if not utils.validate_phone(value):
            raise serializers.ValidationError("Telefone inválido")
        return utils.normalize_phone(value)

    def validate_pin(self, value):
        # PIN is optional, but if provided must be exactly 6 digits
        if value is None or value == "":
            return value
        v = str(value).strip()
        if not re.match(r"^\d{6}$", v):
            raise serializers.ValidationError("PIN deve ter exatamente 6 dígitos numéricos")
        return v


# ── Funcionários (RBAC) ──────────────────────────────────────────────────────

from .rbac import cargo_valido_para_funcionario


def validate_pin_format(value: str) -> str:
    v = str(value).strip()
    if not re.match(r"^\d{6}$", v):
        raise serializers.ValidationError("PIN deve ter exatamente 6 dígitos numéricos")
    return v


class FuncionarioSerializer(serializers.Serializer):
    """Cadastro de funcionário pelo dono/gerente. O PIN aqui é o inicial —
    o funcionário pode trocar depois via 'esqueci meu PIN'."""
    nome = serializers.CharField()
    email = serializers.CharField()
    pin = serializers.CharField(write_only=True)
    cargo = serializers.CharField()

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome obrigatório")
        return value.strip()

    def validate_email(self, value):
        v = value.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise serializers.ValidationError("Email inválido")
        return v

    def validate_pin(self, value):
        return validate_pin_format(value)

    def validate_cargo(self, value):
        v = value.strip().lower()
        if not cargo_valido_para_funcionario(v):
            raise serializers.ValidationError("Cargo inválido")
        return v


class FuncionarioPinLoginSerializer(serializers.Serializer):
    """Login pelo fluxo de quiosque: funcionário já foi escolhido na lista
    (funcionario_id), só falta confirmar com o PIN."""
    funcionario_id = serializers.CharField()
    pin = serializers.CharField(write_only=True)

    def validate_pin(self, value):
        return validate_pin_format(value)


class VeiculoSerializer(serializers.Serializer):
    placa = serializers.CharField()
    marca = serializers.CharField()
    modelo = serializers.CharField()
    ano = serializers.IntegerField()
    cor = serializers.CharField(default="")
    categoria = serializers.CharField(default="")
    quilometragem = serializers.IntegerField(default=0)
    combustivel = serializers.CharField(default="")
    cambio = serializers.CharField(default="")
    portas = serializers.IntegerField(default=4)
    chassi = serializers.CharField(default="")
    renavam = serializers.CharField(default="")
    motor = serializers.CharField(default="")
    observacoes = serializers.CharField(default="")
    status = serializers.CharField(default="disponivel")
    createdAt = serializers.CharField(default="")
    updatedAt = serializers.CharField(default="")

    def validate_placa(self, value):
        v = value.upper().strip()
        if not re.match(r"^[A-Z]{3}[-]?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$", v):
            raise serializers.ValidationError("Placa inválida")
        return v

    def validate_modelo(self, value):
        if not value.strip():
            raise serializers.ValidationError("Modelo obrigatório")
        return value.strip()

    def validate_ano(self, value):
        if value < 1950 or value > 2050:
            raise serializers.ValidationError("Ano inválido")
        return value

    def validate_quilometragem(self, value):
        if value < 0:
            raise serializers.ValidationError("Quilometragem não pode ser negativa")
        return value


class AgendamentoSerializer(serializers.Serializer):
    id = serializers.CharField(default="")
    cliente = serializers.CharField()
    veiculo = serializers.CharField()
    placa = serializers.CharField()
    data = serializers.CharField()  # YYYY-MM-DD
    horaInicio = serializers.CharField()  # HH:MM
    horaFim = serializers.CharField()  # HH:MM
    titulo = serializers.CharField()
    descricao = serializers.CharField(default="")
    status = serializers.CharField(default="agendado")
    mecanico = serializers.CharField(default="")
    ordemServicoId = serializers.CharField(default="")
    createdAt = serializers.CharField(default="")
    updatedAt = serializers.CharField(default="")

    def validate_cliente(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome do cliente é obrigatório")
        return value.strip()

    def validate_veiculo(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome do veículo é obrigatório")
        return value.strip()

    def validate_placa(self, value):
        v = value.upper().strip()
        if not re.match(r"^[A-Z]{3}[-]?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$", v):
            raise serializers.ValidationError("Placa inválida")
        return v

    def validate_data(self, value):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            raise serializers.ValidationError("Data inválida (esperado YYYY-MM-DD)")
        return value

    def validate_horaInicio(self, value):
        if not re.match(r"^\d{2}:\d{2}$", value):
            raise serializers.ValidationError("Hora de início inválida (esperado HH:MM)")
        return value

    def validate_horaFim(self, value):
        if not re.match(r"^\d{2}:\d{2}$", value):
            raise serializers.ValidationError("Hora de término inválida (esperado HH:MM)")
        return value

    def validate(self, data):
        # Valida que horaFim seja após horaInicio
        if 'horaInicio' in data and 'horaFim' in data:
            try:
                h1 = int(data['horaInicio'].split(':')[0]) * 60 + int(data['horaInicio'].split(':')[1])
                h2 = int(data['horaFim'].split(':')[0]) * 60 + int(data['horaFim'].split(':')[1])
                if h2 <= h1:
                    raise serializers.ValidationError({
                        "horaFim": "Hora de término deve ser posterior à hora de início"
                    })
            except (ValueError, IndexError):
                raise serializers.ValidationError({
                    "horaFim": "Formato de hora inválido"
                })
        return data


class ServicoSerializer(serializers.Serializer):
    id = serializers.CharField(default="")
    nome = serializers.CharField()
    categoria = serializers.CharField(default="")
    preco = serializers.DecimalField(max_digits=10, decimal_places=2)
    duracao = serializers.CharField(default="")
    descricao = serializers.CharField(default="")
    ativo = serializers.BooleanField(default=True)
    createdAt = serializers.CharField(default="")
    updatedAt = serializers.CharField(default="")

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome do serviço é obrigatório")
        return value.strip()

    def validate_preco(self, value):
        if value < 0:
            raise serializers.ValidationError("Preço não pode ser negativo")
        return value


class EstoqueSerializer(serializers.Serializer):
    id = serializers.CharField(default="")
    nome = serializers.CharField()
    categoria = serializers.CharField(default="")
    quantidade = serializers.IntegerField(default=0)
    unidade = serializers.CharField(default="")
    localizacao = serializers.CharField(default="")
    estoqueMinimo = serializers.IntegerField(default=0)
    criadoPor = serializers.CharField(default="")
    createdAt = serializers.CharField(default="")
    updatedAt = serializers.CharField(default="")

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome do item é obrigatório")
        return value.strip()

    def validate_quantidade(self, value):
        if value < 0:
            raise serializers.ValidationError("Quantidade não pode ser negativa")
        return value

    def validate_estoqueMinimo(self, value):
        if value < 0:
            raise serializers.ValidationError("Estoque mínimo não pode ser negativo")
        return value


class KitSerializer(serializers.Serializer):
    id = serializers.CharField(default="")
    nome = serializers.CharField()
    descricao = serializers.CharField(default="")
    criadoPor = serializers.CharField(default="")
    createdAt = serializers.CharField(default="")
    updatedAt = serializers.CharField(default="")

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome do kit é obrigatório")
        return value.strip()


# ── Ordem principal ────────────────────────────────────────────────────────

class OrdemServicoSerializer(serializers.Serializer):
    os_header = OSHeaderSerializer()
    cliente = ClienteSerializer()
    veiculo = VeiculoSerializer()
    servicos_selecionados = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    checklist = serializers.DictField(
        child=serializers.CharField(), default=dict
    )
    fotos_base64 = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    fotos_paths = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    tecnico = serializers.DictField(
        child=serializers.CharField(),
        default=dict
    )
    status = serializers.CharField(default="rascunho")

    def validate(self, data):
        # Valida sub-serializers aninhados manualmente
        for field_name in ("os_header", "cliente", "veiculo"):
            nested = data.get(field_name)
            if nested is None:
                raise serializers.ValidationError({field_name: "Campo obrigatório"})
        return data

class AdminSerializer(serializers.Serializer):
    nome = serializers.CharField()
    doc = serializers.CharField()
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome obrigatório")
        return value.strip()

    def validate_doc(self, value):
        if not utils.validate_cpf_cnpj(value):
            raise serializers.ValidationError("CPF/CNPJ inválido")
        return utils.normalize_cpf_cnpj(value)

    def validate_email(self, value):
        if not value.strip():
            raise serializers.ValidationError("Email obrigatório")
        return value.lower().strip()

    def validate_senha(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Senha deve ter pelo menos 6 caracteres")
        return value


class AdminLoginSerializer(serializers.Serializer):
    doc = serializers.CharField()
    senha = serializers.CharField(write_only=True)

    def validate_doc(self, value):
        if not utils.validate_cpf_cnpj(value):
            raise serializers.ValidationError("CPF/CNPJ inválido")
        return utils.normalize_cpf_cnpj(value)

    def validate_senha(self, value):
        if not value.strip():
            raise serializers.ValidationError("Senha obrigatória")
        return value


# ── Criptografia de senha ────────────────────────────────────────────────────────────

def pwhash(senha: str):
    return make_password(senha)


def valhash(senha: str, pwhash: str):
    return check_password(senha, pwhash)