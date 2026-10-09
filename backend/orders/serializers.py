import math
import re
from datetime import datetime, timezone
from decimal import Decimal
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


def _validate_cnpj(digits: str) -> None:
    if len(digits) != 14:
        raise serializers.ValidationError("CNPJ deve conter 14 dígitos")
    if len(set(digits)) == 1:
        raise serializers.ValidationError("CNPJ inválido")
    # Primeiro dígito verificador
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(int(digits[i]) * weights1[i] for i in range(12))
    r = 0 if s % 11 < 2 else 11 - (s % 11)
    if r != int(digits[12]):
        raise serializers.ValidationError("CNPJ inválido")
    # Segundo dígito verificador
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(int(digits[i]) * weights2[i] for i in range(13))
    r = 0 if s % 11 < 2 else 11 - (s % 11)
    if r != int(digits[13]):
        raise serializers.ValidationError("CNPJ inválido")


class AdminSerializer(serializers.Serializer):
    nome = serializers.CharField()
    doc = serializers.CharField(default="")
    email = serializers.CharField()
    senha = serializers.CharField(write_only=True)  # pra nao aparecer no json

    def validate_nome(self, value):
        if not value.strip():
            raise serializers.ValidationError("Nome obrigatório")
        return value.strip()

    def validate_doc(self, value):
        digits = normalize_doc(value)
        _validate_cnpj(digits)
        return digits

    def validate_email(self, value):
        v = value.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise serializers.ValidationError("Email inválido")
        return v

    def validate_senha(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Senha deve ter pelo menos 6 caracteres")
        return value


class AdminLoginSerializer(serializers.Serializer):
    doc = serializers.CharField(default="")
    senha = serializers.CharField(write_only=True)

    def validate_doc(self, value):
        digits = normalize_doc(value)
        _validate_cnpj(digits)
        return digits

    def validate_senha(self, value):
        if not value:
            raise serializers.ValidationError("Senha obrigatória")
        return value


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


# ── Financeiro ────────────────────────────────────────────────────────────────
#
# Categorias fixas por código (mesma filosofia do rbac.py: começar simples,
# só virar tabela configurável se um dia isso for pedido de verdade).

CATEGORIAS_ENTRADA = ("servicos", "pecas", "acessorios", "outros")
CATEGORIAS_SAIDA = (
    "aluguel", "energia", "agua", "internet", "salarios", "contabilidade",
    "compra_pecas", "ferramentas", "equipamentos", "manutencao",
    "impostos", "marketing", "taxas", "outros",
)
FORMAS_PAGAMENTO = ("pix", "dinheiro", "debito", "credito", "boleto", "transferencia")


class FinanceiroTransacaoSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=["entrada", "saida"])
    categoria = serializers.CharField()
    descricao = serializers.CharField(required=False, allow_blank=True, default="")
    valor = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    forma_pagamento = serializers.ChoiceField(choices=list(FORMAS_PAGAMENTO), required=False, allow_null=True, default=None)
    # 'vencido' nunca é gravado — é calculado na leitura (status='pendente' + venceu).
    status = serializers.ChoiceField(choices=["pendente", "pago", "cancelado"], default="pendente")
    data_competencia = serializers.DateField()
    data_vencimento = serializers.DateField(required=False, allow_null=True, default=None)
    data_pagamento = serializers.DateTimeField(required=False, allow_null=True, default=None)
    cliente_nome = serializers.CharField(required=False, allow_blank=True, default="")
    # Preparado pra quando a OS gerar a entrada sozinha — ninguém preenche isso ainda.
    ordem_servico_id = serializers.CharField(required=False, allow_null=True, default=None)

    def validate_categoria(self, value):
        v = value.strip().lower()
        tipo = self.initial_data.get("tipo")
        validas = CATEGORIAS_ENTRADA if tipo == "entrada" else CATEGORIAS_SAIDA
        if v not in validas:
            raise serializers.ValidationError(f"Categoria inválida para tipo '{tipo}'")
        return v

    def validate(self, data):
        if data.get("status") == "pago" and not data.get("data_pagamento"):
            from django.utils import timezone
            data["data_pagamento"] = timezone.now()
        return data


# ── Estoque ───────────────────────────────────────────────────────────────────
#
# O frontend de Estoque usa camelCase (`fotoDataUrl`, `servicoId`) e um objeto
# `quarentena` aninhado; as colunas no banco são snake_case e a quarentena é
# achatada em 3 colunas. Os serializers abaixo fazem essa ponte na ENTRADA
# (camelCase → colunas, via `source=` e `validate()`); a SAÍDA (colunas →
# camelCase) é feita pelos mapeadores em estoque_views.py.

# Manter em sincronia com CATEGORIA_GRUPOS em frontend/src/utils/estoque_utils.ts.
CATEGORIAS_ESTOQUE = (
    "Pneus", "Calotas", "Rodas",
    "Motor", "Lubrificantes", "Filtros", "Correias", "Elétrica",
    "Freios", "Suspensão", "Fluidos",
    "Volante", "Bancos", "Acessórios",
    "Funilaria",
)

# A foto chega comprimida (~480px, JPEG 0.7 ≈ 20–60 KB). O teto é folga pra
# não aceitar um arquivo gigante por engano e engordar a tabela.
MAX_FOTO_DATA_URL_CHARS = 700_000
MAX_QUANTIDADE = 9_999_999


class _NumeroFinito(serializers.FloatField):
    """FloatField que recusa NaN/Infinity. O Postgres aceita 'NaN' em numeric
    e ele passaria pelo CHECK (quantidade >= 0), porque NaN > qualquer número."""

    def to_internal_value(self, data):
        valor = super().to_internal_value(data)
        if not math.isfinite(valor):
            raise serializers.ValidationError("Número inválido")
        return valor


def _validar_foto(value):
    """Aceita data URL de imagem (o que o frontend envia hoje) ou URL https
    (caminho aberto pra Supabase Storage). Vazio vira None = sem foto."""
    v = (value or "").strip()
    if not v:
        return None
    if len(v) > MAX_FOTO_DATA_URL_CHARS:
        raise serializers.ValidationError({"fotoDataUrl": ["Foto grande demais. Escolha uma imagem menor."]})
    if not (v.startswith("data:image/") or v.startswith("https://")):
        raise serializers.ValidationError({"fotoDataUrl": ["Formato de foto inválido."]})
    return v


def _normalizar_data_entrada(value) -> str:
    """O modal manda 'AAAA-MM-DD'; os dados antigos podem vir como ISO completo.
    Sempre devolve ISO com fuso (UTC se não vier nenhum). Vazio = agora."""
    v = (value or "").strip()
    if not v:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise serializers.ValidationError({"quarentena": ["Data de entrada inválida."]})
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


class EstoqueQuarentenaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500)
    fornecedor = serializers.CharField(max_length=200)
    dataEntrada = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class EstoqueItemSerializer(serializers.Serializer):
    """Entrada de criação/edição de um item. `validated_data` sai já no formato
    das colunas de estoque_itens (quarentena achatada, foto em foto_data_url)."""
    nome = serializers.CharField(max_length=200)
    categoria = serializers.ChoiceField(choices=list(CATEGORIAS_ESTOQUE))
    quantidade = _NumeroFinito(min_value=0, max_value=MAX_QUANTIDADE)
    minimo = _NumeroFinito(min_value=0, max_value=MAX_QUANTIDADE, required=False, default=0)
    preco = _NumeroFinito(min_value=0, max_value=99_999_999, required=False, default=0)
    localizacao = serializers.CharField(max_length=200)
    descricao = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=2000)
    aplicacao = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=2000)
    fotoDataUrl = serializers.CharField(
        source="foto_data_url", required=False, allow_blank=True, allow_null=True,
    )
    status = serializers.ChoiceField(choices=["ativo", "quarentena"], required=False, default="ativo")
    quarentena = EstoqueQuarentenaSerializer(required=False, allow_null=True)

    def validate(self, attrs):
        quarentena = attrs.pop("quarentena", None)

        if attrs["status"] == "quarentena":
            if not quarentena:
                raise serializers.ValidationError({"quarentena": ["Informe o motivo e o fornecedor da quarentena."]})
            attrs["quarentena_motivo"] = quarentena["motivo"]
            attrs["quarentena_fornecedor"] = quarentena["fornecedor"]
            attrs["quarentena_data_entrada"] = _normalizar_data_entrada(quarentena.get("dataEntrada"))
        else:
            # Voltou pra ativo: limpa qualquer resquício de quarentena.
            attrs["quarentena_motivo"] = None
            attrs["quarentena_fornecedor"] = None
            attrs["quarentena_data_entrada"] = None

        attrs["foto_data_url"] = _validar_foto(attrs.get("foto_data_url"))
        for campo in ("descricao", "aplicacao"):
            attrs[campo] = (attrs.get(campo) or "").strip() or None
        attrs["preco"] = round(attrs["preco"], 2)
        attrs["quantidade"] = round(attrs["quantidade"], 3)
        attrs["minimo"] = round(attrs["minimo"], 3)
        return attrs


class EstoqueKitReceitaSerializer(serializers.Serializer):
    itemId = serializers.UUIDField()
    quantidade = _NumeroFinito(min_value=0.001, max_value=MAX_QUANTIDADE)


class EstoqueKitSerializer(serializers.Serializer):
    """Entrada de criação/edição de kit. `itens` sai como a lista que a função
    estoque_salvar_kit espera: [{"item_id": "<uuid>", "quantidade": n}, ...]."""
    nome = serializers.CharField(max_length=200)
    descricao = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=2000)
    itens = EstoqueKitReceitaSerializer(many=True, allow_empty=False)
    servicoId = serializers.CharField(
        source="servico_id", required=False, allow_blank=True, allow_null=True, max_length=100,
    )
    fotoDataUrl = serializers.CharField(
        source="foto_data_url", required=False, allow_blank=True, allow_null=True,
    )

    def validate(self, attrs):
        vistos = set()
        itens = []
        for r in attrs["itens"]:
            item_id = str(r["itemId"])
            if item_id in vistos:
                raise serializers.ValidationError({"itens": ["O mesmo item aparece mais de uma vez na receita."]})
            vistos.add(item_id)
            itens.append({"item_id": item_id, "quantidade": round(r["quantidade"], 3)})
        attrs["itens"] = itens

        attrs["foto_data_url"] = _validar_foto(attrs.get("foto_data_url"))
        attrs["descricao"] = (attrs.get("descricao") or "").strip() or None
        attrs["servico_id"] = (attrs.get("servico_id") or "").strip() or None
        return attrs

# ── Catálogo de serviços ──────────────────────────────────────────────────────

class ServicoSerializer(serializers.Serializer):
    """Entrada de criação/edição de serviço. `validated_data` sai no formato das
    colunas de `servicos`. Preço 0 é aceito (ex.: cortesia); o modal do frontend
    já exige preço > 0 pro cadastro normal."""
    nome = serializers.CharField(max_length=200)
    categoria = serializers.CharField(max_length=100)
    preco = _NumeroFinito(min_value=0, max_value=99_999_999)
    duracao = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    descricao = serializers.CharField(max_length=2000, required=False, allow_blank=True, allow_null=True, default="")
    ativo = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        for campo in ("nome", "categoria", "duracao"):
            attrs[campo] = (attrs.get(campo) or "").strip()
        attrs["descricao"] = (attrs.get("descricao") or "").strip()
        attrs["preco"] = round(attrs["preco"], 2)
        return attrs
