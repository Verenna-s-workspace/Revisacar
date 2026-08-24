import re

def normalize_cpf_cnpj(value: str) -> str:
    """
    Remove todos os caracteres não numéricos de um CPF ou CNPJ.
    """
    if not value:
        return ""
    return re.sub(r'\D', '', value)

def validate_cpf_cnpj(value: str) -> bool:
    """
    Valida se um CPF ou CNPJ é válido.
    Retorna True se válido, False caso contrário.
    """
    if not value:
        return False

    # Normaliza Remover todos os caracteres não numéricos
    cpf_cnpj = normalize_cpf_cnpj(value)

    # Verifica o tamanho
    if len(cpf_cnpj) == 11:
        return _validate_cpf(cpf_cnpj)
    elif len(cpf_cnpj) == 14:
        return _validate_cnpj(cpf_cnpj)
    else:
        return False

def _validate_cpf(cpf: str) -> bool:
    """Valida CPF usando o algoritmo dos dígitos verificadores."""
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False

    # Calcula o primeiro dígito verificador
    soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto

    if int(cpf[9]) != digito1:
        return False

    # Calcula o segundo dígito verificador
    soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto

    return int(cpf[10]) == digito2

def _validate_cnpj(cnpj: str) -> bool:
    """Valida CNPJ usando o algoritmo dos dígitos verificadores."""
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False

    # Primeiro dígito verificador
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj[i]) * weights1[i] for i in range(12))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto

    if int(cnpj[12]) != digito1:
        return False

    # Segundo dígito verificador
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj[i]) * weights2[i] for i in range(13))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto

    return int(cnpj[13]) == digito2

def normalize_phone(value: str) -> str:
    """
    Normaliza um número de telefone removendo caracteres não numéricos.
    """
    if not value:
        return ""
    return re.sub(r'\D', '', value)

def validate_phone(value: str) -> bool:
    """
    Valida se um telefone tem um formato básico válido.
    Aceita formatos como: (11) 99999-9999, 11999999999, etc.
    """
    if not value:
        return False

    # Remove todos os caracteres não numéricos
    phone = normalize_phone(value)

    # Verifica se tem entre 10 e 11 digits (com ou без 9 do celular)
    if len(phone) not in [10, 11]:
        return False

    # Verifica se começa com um DDD válido (11-99)
    ddd = int(phone[:2])
    if ddd < 11 or ddd > 99:
        return False

    return True