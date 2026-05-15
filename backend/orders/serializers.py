import re
from rest_framework import serializers
from django.contrib.auth.hashers import make_password, check_password

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
    doc = serializers.CharField(default="")
    tel = serializers.CharField()
    email = serializers.CharField(default="")

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Campo obrigatório")
        return value.strip()

    def validate_tel(self, value):
        if not value.strip():
            raise serializers.ValidationError("Campo obrigatório")
        return value.strip()

def normalize_doc(value: str) -> str:
    return re.sub(r"\D", "", value or "")

class AdminSerializer(serializers.Serializer):
    nome = serializers.CharField()
    doc = serializers.CharField(default="")
    senha = serializers.CharField(write_only=True)  # pra nao aparecer no json

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome obrigatório")
        return value.strip()

    def validate_doc(self, value):
        digits = normalize_doc(value)
        if len(digits) != 14:
            raise serializers.ValidationError("CNPJ deve conter 14 dígitos")
        return digits

    def validate_senha(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Senha deve ter pelo menos 6 caracteres")
        return value


class AdminLoginSerializer(serializers.Serializer):
    doc = serializers.CharField(default="")
    senha = serializers.CharField(write_only=True)

    def validate_doc(self, value):
        digits = normalize_doc(value)
        if len(digits) != 14:
            raise serializers.ValidationError("CNPJ deve conter 14 dígitos")
        return digits

    def validate_senha(self, value):
        if not value:
            raise serializers.ValidationError("Senha obrigatória")
        return value


class VeiculoSerializer(serializers.Serializer):
    placa = serializers.CharField()
    modelo = serializers.CharField()
    ano = serializers.CharField(default="")
    cor = serializers.CharField(default="")
    combustivel = serializers.CharField(default="")
    nivel_combustivel = serializers.CharField(default="")
    chassi = serializers.CharField(default="")
    obs_entrada = serializers.CharField(default="")

    def validate_placa(self, value):
        v = value.upper().strip()
        if not re.match(r"^[A-Z]{3}[-]?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$", v):
            raise serializers.ValidationError("Placa inválida")
        return v

    def validate_modelo(self, value):
        if not value.strip():
            raise serializers.ValidationError("Campo obrigatório")
        return value.strip()


class ChecklistItemSerializer(serializers.Serializer):
    status = serializers.CharField(allow_null=True, required=False)
    obs = serializers.CharField(default="")


class TecnicoSerializer(serializers.Serializer):
    nome = serializers.CharField(default="", allow_blank=True)
    registro = serializers.CharField(default="", allow_blank=True)
    data_saida = serializers.CharField(default="", allow_blank=True)
    hora_saida = serializers.CharField(default="", allow_blank=True)
    km_saida = serializers.CharField(default="", allow_blank=True)
    parecer_geral = serializers.CharField(default="", allow_blank=True)


# ── Ordem principal ────────────────────────────────────────────────────────────

class OrdemServicoSerializer(serializers.Serializer):
    os_header = OSHeaderSerializer()
    cliente = ClienteSerializer()
    veiculo = VeiculoSerializer()
    servicos_selecionados = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    checklist = serializers.DictField(
        child=ChecklistItemSerializer(), default=dict
    )
    fotos_base64 = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    fotos_paths = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    tecnico = TecnicoSerializer(required=False, allow_null=True)
    status = serializers.CharField(default="rascunho")

    def validate(self, data):
        # Valida sub-serializers aninhados manualmente
        for field_name in ("os_header", "cliente", "veiculo"):
            nested = data.get(field_name)
            if nested is None:
                raise serializers.ValidationError({field_name: "Campo obrigatório"})
        return data

# ── Criptografia de senha ────────────────────────────────────────────────────────────

def pwhash(senha: str):
    return make_password(senha)


def valhash(senha: str, pwhash: str):
    return check_password(senha, pwhash)