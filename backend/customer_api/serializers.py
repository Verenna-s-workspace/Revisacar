import re
import uuid
from datetime import datetime
from rest_framework import serializers
from django.contrib.auth.hashers import make_password, check_password


# ── Auth ──────────────────────────────────────────────────────────────────────

class CustomerRegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(min_length=6, write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_name(self, v):
        if not v.strip():
            raise serializers.ValidationError("Nome obrigatório")
        return v.strip()

    def validate_email(self, v):
        return v.lower().strip()

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Senhas não coincidem"})
        return data


class CustomerLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_email(self, v):
        return v.lower().strip()


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=6, write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Senhas não coincidem"})
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


# ── Customer Profile ──────────────────────────────────────────────────────────

class CustomerProfileSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(read_only=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    cpf = serializers.CharField(max_length=14, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    avatar_url = serializers.CharField(read_only=True, required=False)
    created_at = serializers.CharField(read_only=True)

    def validate_cpf(self, v):
        digits = re.sub(r"\D", "", v or "")
        if digits and len(digits) != 11:
            raise serializers.ValidationError("CPF deve ter 11 dígitos")
        return digits


# ── Vehicle ───────────────────────────────────────────────────────────────────

class VehicleSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    customer_id = serializers.CharField(read_only=True)
    brand = serializers.CharField(max_length=60)
    model = serializers.CharField(max_length=80)
    year = serializers.IntegerField(min_value=1950, max_value=2030)
    plate = serializers.CharField(max_length=10)
    color = serializers.CharField(max_length=40, required=False, allow_blank=True)
    fuel_type = serializers.ChoiceField(
        choices=["flex", "gasolina", "etanol", "diesel", "eletrico", "gnv", "hibrido"],
        default="flex"
    )
    mileage = serializers.IntegerField(min_value=0, default=0)
    vin = serializers.CharField(max_length=17, required=False, allow_blank=True)
    renavam = serializers.CharField(max_length=11, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def validate_plate(self, v):
        v = re.sub(r"[-\s]", "", v).upper()
        if not re.match(r"^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$", v):
            raise serializers.ValidationError("Placa inválida")
        return v


class VehicleUpdateSerializer(VehicleSerializer):
    brand = serializers.CharField(max_length=60, required=False)
    model = serializers.CharField(max_length=80, required=False)
    year = serializers.IntegerField(min_value=1950, max_value=2030, required=False)
    plate = serializers.CharField(max_length=10, required=False)


# ── Appointment ───────────────────────────────────────────────────────────────

class AppointmentCreateSerializer(serializers.Serializer):
    vehicle_id = serializers.CharField()
    service_type = serializers.CharField(max_length=100)
    service_description = serializers.CharField(required=False, allow_blank=True)
    date = serializers.DateField()
    time_slot = serializers.TimeField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_date(self, v):
        if v < datetime.today().date():
            raise serializers.ValidationError("Data não pode ser no passado")
        return v


class AppointmentSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    customer_id = serializers.CharField(read_only=True)
    vehicle_id = serializers.CharField()
    vehicle_label = serializers.CharField(read_only=True)
    service_type = serializers.CharField()
    service_description = serializers.CharField(required=False, allow_blank=True)
    date = serializers.DateField()
    time_slot = serializers.TimeField()
    status = serializers.ChoiceField(
        choices=["pendente", "confirmado", "rejeitado", "concluido", "cancelado"],
        read_only=True
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    rejection_reason = serializers.CharField(read_only=True, required=False)
    created_at = serializers.CharField(read_only=True)


# ── Availability ──────────────────────────────────────────────────────────────

class AvailabilitySlotSerializer(serializers.Serializer):
    date = serializers.DateField()
    time_slot = serializers.TimeField()
    is_available = serializers.BooleanField()


class AvailableMonthSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField(min_value=1, max_value=12)


# ── Estimate ──────────────────────────────────────────────────────────────────

class EstimateItemSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    description = serializers.CharField()
    quantity = serializers.FloatField(default=1)
    unit_price = serializers.FloatField()
    item_type = serializers.ChoiceField(choices=["peca", "mao_de_obra", "outro"], default="peca")
    subtotal = serializers.FloatField(read_only=True)


class EstimateSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    number = serializers.CharField(read_only=True)
    customer_id = serializers.CharField(read_only=True)
    vehicle_id = serializers.CharField()
    vehicle_label = serializers.CharField(read_only=True)
    appointment_id = serializers.CharField(read_only=True, required=False)
    items = EstimateItemSerializer(many=True, read_only=True)
    subtotal = serializers.FloatField(read_only=True)
    discount = serializers.FloatField(read_only=True, default=0)
    total = serializers.FloatField(read_only=True)
    status = serializers.ChoiceField(
        choices=["pendente", "aprovado", "rejeitado", "expirado"],
        read_only=True
    )
    notes = serializers.CharField(read_only=True, required=False)
    valid_until = serializers.DateField(read_only=True)
    created_at = serializers.CharField(read_only=True)


class EstimateActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["aprovar", "rejeitar"])
    comment = serializers.CharField(required=False, allow_blank=True)


# ── Service History ───────────────────────────────────────────────────────────

class ServiceHistoryItemSerializer(serializers.Serializer):
    description = serializers.CharField()
    part_replaced = serializers.BooleanField(default=False)
    part_name = serializers.CharField(required=False, allow_blank=True)


class ServiceHistorySerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    vehicle_id = serializers.CharField()
    vehicle_label = serializers.CharField(read_only=True)
    service_date = serializers.DateField()
    mileage_at_service = serializers.IntegerField()
    service_type = serializers.CharField()
    items = ServiceHistoryItemSerializer(many=True, read_only=True)
    total_cost = serializers.FloatField(read_only=True)
    mechanic_notes = serializers.CharField(read_only=True, required=False)
    estimate_id = serializers.CharField(read_only=True, required=False)
    created_at = serializers.CharField(read_only=True)


# ── Notification ─────────────────────────────────────────────────────────────

class NotificationSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    title = serializers.CharField()
    message = serializers.CharField()
    type = serializers.ChoiceField(
        choices=["agendamento", "orcamento", "servico", "lembrete", "sistema"]
    )
    is_read = serializers.BooleanField(default=False)
    action_url = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.CharField(read_only=True)


# ── Maintenance Reminder ──────────────────────────────────────────────────────

class MaintenanceReminderSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    vehicle_id = serializers.CharField()
    vehicle_label = serializers.CharField(read_only=True)
    service_name = serializers.CharField()
    interval_km = serializers.IntegerField(required=False)
    interval_months = serializers.IntegerField(required=False)
    last_service_km = serializers.IntegerField(required=False)
    last_service_date = serializers.DateField(required=False, allow_null=True)
    next_service_km = serializers.IntegerField(read_only=True, required=False)
    next_service_date = serializers.DateField(read_only=True, required=False, allow_null=True)
    current_mileage = serializers.IntegerField(read_only=True)
    km_remaining = serializers.IntegerField(read_only=True, required=False)
    urgency = serializers.ChoiceField(choices=["ok", "atencao", "urgente"], read_only=True)
    progress_pct = serializers.FloatField(read_only=True)


# ── PIN Auth ────────────────────────────────────────────────────────────────

class CustomerPinLoginSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=14)
    pincode = serializers.CharField(min_length=6, max_length=6, write_only=True)

    def validate_documento(self, value):
        # Remove non-digits and validate length
        digits = re.sub(r"\D", "", value or "")
        if len(digits) not in [11, 14]:  # CPF (11) or CNPJ (14)
            raise serializers.ValidationError("Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)")
        return digits

    def validate_pincode(self, value):
        if not value.isdigit() or len(value) != 6:
            raise serializers.ValidationError("PIN deve ter exatamente 6 dígitos")
        return value


class MechanicClientCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    document = serializers.CharField(max_length=20)  # CPF/CNPJ
    pincode = serializers.CharField(min_length=6, max_length=6, write_only=True)

    def validate_email(self, v):
        return v.lower().strip()

    def validate_document(self, v):
        # Remove non-digits and validate length
        digits = re.sub(r"\D", "", v or "")
        if digits and len(digits) not in [11, 14]:  # CPF (11) or CNPJ (14)
            raise serializers.ValidationError("Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)")
        return digits

    def validate_pincode(self, v):
        if not v.isdigit():
            raise serializers.ValidationError("PIN deve conter apenas números")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

def pw_hash(password: str) -> str:
    return make_password(password)


def pw_check(password: str, hashed: str) -> bool:
    return check_password(password, hashed)


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"
