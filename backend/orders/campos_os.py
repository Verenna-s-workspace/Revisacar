"""
Regras dos campos da OS (checklists de entrada, inspeção e encerramento).

Espelho de frontend/src/utils/campos_checklist.ts e dos FILTRO em components/inputs/masks.ts — o
front impede o caractere inválido na digitação, aqui o servidor garante o mesmo (quem chama a API
direto também passa por estas regras). Ao mudar uma regra, mude as duas pontas.

Cada `normalizar_*` recebe o valor cru, devolve o valor limpo ou levanta ValidationError. Valor vazio
passa (campo opcional); "obrigatório" é decidido pelo serializer. Valores antigos em formato
diferente (telefone com máscara, km "87.450") são normalizados para o formato novo (só dígitos).
"""
import re
import unicodedata
from datetime import date

from rest_framework import serializers

# ── Limites ───────────────────────────────────────────────────────────────────

NOME_MAX = 100
EMAIL_MAX = 120
MODELO_MAX = 60
COR_MAX = 30
OBS_LONGA_MAX = 1000
OBS_ITEM_MAX = 500
ITEM_ADICIONAL_MAX = 60
MAX_ITENS_ADICIONAIS = 50
REGISTRO_MAX = 20
PARECER_MAX = 2000
PECA_MAX = 80
PECA_MODELO_MAX = 60
PECA_MARCA_MAX = 60
PECA_CODIGO_MAX = 40
MAX_PECAS = 100
MAX_TROCA = 500
MAX_SERVICOS = 100
OS_NUM_MAX = 20
KM_MAX_DIGITOS = 7
ANO_MIN = 1900
DATA_MIN = date(2000, 1, 1)

COMBUSTIVEIS = ("Gasolina", "Etanol", "Flex", "Diesel", "Elétrico", "Híbrido", "GNV")
NIVEIS_COMBUSTIVEL = ("Reserva", "1/4", "1/2", "3/4", "Cheio")

# ── Padrões ───────────────────────────────────────────────────────────────────
# Letra = \w sem dígito e sem "_": [^\W\d_]  (com acento incluso).

# O formulário só deixa digitar números (até 10); o servidor aceita também o identificador no formato
# antigo ("OS-1"): letras, números, ponto, barra, hífen e sublinhado, até 20 caracteres.
OS_NUM_RE = re.compile(r"^[A-Za-z0-9._/\-]{1,20}$")
NOME_RE = re.compile(r"^[^\W\d_](?:[^\W\d_]|[ '’.\-])*$")
MODELO_RE = re.compile(r"^[\w .,\-/+()'’&]+$")
COR_RE = re.compile(r"^(?:[^\W\d_]|[ /\-])+$")
REGISTRO_RE = re.compile(r"^[A-Za-z0-9 ./\-]+$")
CODIGO_RE = re.compile(r"^[A-Za-z0-9 ./\-_]+$")
ITEM_RE = re.compile(r"""^[\w .,\-/+()'’&%"]+$""")
TEL_RE = re.compile(r"^[1-9][1-9](?:9\d{8}|[2-9]\d{7})$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CHASSI_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
QTD_PECA_RE = re.compile(r"^\d{1,3}$")
DATA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _erro(msg: str):
    return serializers.ValidationError(msg)


def _limpo(valor) -> str:
    """Texto sem espaços nas pontas, espaços repetidos colapsados, forma composta (NFC)."""
    return re.sub(r" {2,}", " ", unicodedata.normalize("NFC", str(valor or "")).strip())


def so_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


# ── Documento ─────────────────────────────────────────────────────────────────

def _cpf_valido(d: str) -> bool:
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        soma = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if int(d[n]) != (soma * 10 % 11) % 10:
            return False
    return True


def _cnpj_valido(d: str) -> bool:
    if len(d) != 14 or d == d[0] * 14:
        return False
    for n, pesos in ((12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]), (13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])):
        resto = sum(int(d[i]) * pesos[i] for i in range(n)) % 11
        if int(d[n]) != (0 if resto < 2 else 11 - resto):
            return False
    return True


# ── Normalizadores (valor cru → valor limpo, ou ValidationError) ──────────────

def os_num(valor) -> str:
    v = str(valor or "").strip()
    if not OS_NUM_RE.match(v):
        raise _erro(f"Número da OS inválido (letras, números, ponto, barra e hífen; até {OS_NUM_MAX} caracteres)")
    return v


def km(valor) -> str:
    """'87.450' (legado) ou '87450' → '87450'. Até 7 dígitos; vazio passa."""
    d = so_digitos(valor)
    if len(d) > KM_MAX_DIGITOS:
        raise _erro("Quilometragem inválida")
    return d


def nome(valor, obrigatorio: bool = False) -> str:
    v = _limpo(valor)
    if not v:
        if obrigatorio:
            raise _erro("Campo obrigatório")
        return ""
    if len(v) > NOME_MAX:
        raise _erro(f"No máximo {NOME_MAX} caracteres")
    if not NOME_RE.match(v) or sum(c.isalpha() for c in v) < 2:
        raise _erro("Nome inválido — use só letras, espaço, apóstrofo, ponto e hífen")
    return v


def documento(valor) -> str:
    d = so_digitos(valor)
    if not d:
        return ""
    if len(d) not in (11, 14) or not (_cpf_valido(d) if len(d) == 11 else _cnpj_valido(d)):
        raise _erro("CPF/CNPJ inválido")
    return d


def telefone(valor) -> str:
    d = so_digitos(valor)
    if not d:
        raise _erro("Campo obrigatório")
    if not TEL_RE.match(d):
        raise _erro("Telefone inválido — use DDD + número")
    return d


def email(valor) -> str:
    v = str(valor or "").strip()
    if not v:
        return ""
    if len(v) > EMAIL_MAX:
        raise _erro(f"No máximo {EMAIL_MAX} caracteres")
    if not EMAIL_RE.match(v):
        raise _erro("E-mail inválido")
    return v


def modelo(valor, maximo: int = MODELO_MAX, obrigatorio: bool = False) -> str:
    v = _limpo(valor)
    if not v:
        if obrigatorio:
            raise _erro("Campo obrigatório")
        return ""
    if len(v) > maximo:
        raise _erro(f"No máximo {maximo} caracteres")
    if not MODELO_RE.match(v):
        raise _erro("Caracteres inválidos")
    return v


def cor(valor) -> str:
    v = _limpo(valor)
    if not v:
        return ""
    if len(v) > COR_MAX:
        raise _erro(f"No máximo {COR_MAX} caracteres")
    if not COR_RE.match(v):
        raise _erro("Use só letras na cor")
    return v


def ano(valor, hoje: date | None = None) -> str:
    v = str(valor or "").strip()
    if not v:
        return ""
    maximo = (hoje or date.today()).year + 1
    if not re.match(r"^\d{4}$", v) or not ANO_MIN <= int(v) <= maximo:
        raise _erro(f"Ano entre {ANO_MIN} e {maximo}")
    return v


def chassi(valor) -> str:
    v = str(valor or "").strip().upper()
    if not v:
        return ""
    if not CHASSI_RE.match(v):
        raise _erro("Chassi com 17 caracteres (sem I, O, Q)")
    return v


def opcao(valor, opcoes) -> str:
    v = str(valor or "").strip()
    if v and v not in opcoes:
        raise _erro("Opção inválida")
    return v


def texto_livre(valor, maximo: int) -> str:
    v = unicodedata.normalize("NFC", str(valor or ""))
    if len(v) > maximo:
        raise _erro(f"No máximo {maximo} caracteres")
    return v


def registro(valor) -> str:
    v = _limpo(valor)
    if not v:
        return ""
    if len(v) > REGISTRO_MAX or not REGISTRO_RE.match(v):
        raise _erro("Registro inválido")
    return v


def data_iso(valor) -> str:
    """AAAA-MM-DD de verdade (não 2024-02-31), de 2000 em diante. Vazio passa."""
    v = str(valor or "").strip()
    if not v:
        return ""
    if not DATA_RE.match(v):
        raise _erro("Data inválida (esperado AAAA-MM-DD)")
    try:
        d = date.fromisoformat(v)
    except ValueError:
        raise _erro("Data inválida")
    if d < DATA_MIN:
        raise _erro("Data muito antiga")
    return v


def hora(valor) -> str:
    v = str(valor or "").strip()
    if v and not HORA_RE.match(v):
        raise _erro("Hora inválida (esperado HH:MM)")
    return v


def item_adicional(valor) -> str:
    v = _limpo(valor)
    if not v:
        raise _erro("Item vazio")
    if len(v) > ITEM_ADICIONAL_MAX:
        raise _erro(f"No máximo {ITEM_ADICIONAL_MAX} caracteres")
    if not ITEM_RE.match(v):
        raise _erro("Caracteres inválidos")
    return v


def campo_peca(campo: str, valor) -> str:
    """Uma célula da tabela de peças (modelo/marca/código/quantidade/peça)."""
    v = _limpo(valor)
    if campo == "quantidade":
        if v and not QTD_PECA_RE.match(v):
            raise _erro("Quantidade de 1 a 999")
        return v
    maximo, padrao = {
        "peca": (PECA_MAX, ITEM_RE),
        "modelo": (PECA_MODELO_MAX, MODELO_RE),
        "marca": (PECA_MARCA_MAX, MODELO_RE),
        "codigo": (PECA_CODIGO_MAX, CODIGO_RE),
    }[campo]
    if not v:
        return ""
    if len(v) > maximo:
        raise _erro(f"No máximo {maximo} caracteres")
    if not padrao.match(v):
        raise _erro("Caracteres inválidos")
    return v
