"""PDF do relatório final da OS concluída: gerador puro (sem banco). A rota é testada em test_fechamento.py."""
import io

import pytest

pytest.importorskip("pypdf")
from pypdf import PdfReader  # noqa: E402

from orders import os_concluida_pdf as relatorio  # noqa: E402

SLOTS = ("Hodômetro", "Frente", "Traseira", "Lateral direita", "Lateral esquerda")


def _fotos(anexadas=5, motivo="Carro trancado pelo cliente"):
    """As primeiras `anexadas` têm foto; a seguinte foi pulada com motivo; as demais ficaram pendentes."""
    out = []
    for i, rotulo in enumerate(SLOTS):
        situacao = "foto" if i < anexadas else ("pulada" if i == anexadas else "pendente")
        out.append({"rotulo": rotulo, "situacao": situacao, "motivo": motivo if situacao == "pulada" else ""})
    return out


def _dados(n_pecas=2, n_servicos=2, **extra):
    itens = [{"tipo": "peca", "descricao": f"Peca{i}", "marca": "Bosch", "quantidade": 2,
              "preco_unitario": "100.00", "subtotal": "200.00", "motivo": ""} for i in range(n_pecas)]
    itens += [{"tipo": "servico", "descricao": f"Servico{i}", "marca": "", "quantidade": 1,
               "preco_unitario": "80.00", "subtotal": "80.00", "motivo": ""} for i in range(n_servicos)]
    base = {
        "oficina": {"nome": "Auto Center Silva", "cnpj": "12345678000199", "telefone": "1133334444",
                    "email": "contato@silva.com", "endereco": "Rua das Flores, 100"},
        "os_num": "77", "emitido_em": "2026-11-05T21:10:33+00:00",
        "concluida_em": "2026-11-05T19:00:00+00:00", "concluida_por": "Carlos", "obs_conclusao": "",
        "cliente": {"nome": "Joao da Silva", "doc": "12345678901", "tel": "11999999999", "email": "j@e.com"},
        "veiculo": {"placa": "ABC1D23", "modelo": "Gol", "ano": "2018", "cor": "Prata",
                    "chassi": "9BWZZZ377VT004251", "combustivel": "Flex", "nivel_combustivel": "1/2",
                    "km_entrada": "87000", "km_saida": "87012"},
        "tecnico": {"nome": "Carlos Mecanico", "registro": "CRM-123"},
        "entrada": {"data": "2026-11-04", "hora": "08:30"}, "saida": {"data": "2026-11-05", "hora": "16:45"},
        "fotos": _fotos(5), "fotos_extras": 0, "parecer": "Troca de pastilhas realizada.", "itens": itens,
        "aprovacao": {"em": "2026-11-04T18:35:09+00:00", "canal": "whatsapp", "obs": "", "versao": 2},
        "assinatura_png": None,
    }
    base.update(extra)
    return base


def _texto(conteudo: bytes) -> str:
    return " ".join("\n".join(p.extract_text() for p in PdfReader(io.BytesIO(conteudo)).pages).split())


def _paginas(conteudo: bytes) -> int:
    return len(PdfReader(io.BytesIO(conteudo)).pages)


def test_cabecalho_com_os_e_hora_exata_de_emissao():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    assert "RELATÓRIO FINAL DA OS" in texto and "OS Nº 77" in texto
    assert "Emitido em 05/11/2026 às 18:10:33" in texto  # 21:10:33 UTC = 18:10:33 em Brasília
    assert "CNPJ 12.345.678/0001-99" in texto and "(11) 3333-4444" in texto


def test_ficha_de_entrada_e_saida():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    assert "CLIENTE NOME Joao da Silva CPF / CNPJ 123.456.789-01 TELEFONE (11) 99999-9999" in texto
    for esperado in ("CHASSI 9BWZZZ377VT004251", "COMBUSTÍVEL Flex", "NÍVEL DO TANQUE 1/2",
                     "KM DE ENTRADA 87.000 km", "KM DE SAÍDA 87.012 km",
                     "Carlos Mecanico · Reg. CRM-123", "04/11/2026 às 08:30", "05/11/2026 às 16:45"):
        assert esperado in texto, esperado


def test_fotos_completas_mostram_5_de_5_sem_lista_de_ausentes():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    assert "5/5" in texto and "Todas as 5 fotos obrigatórias foram anexadas." in texto
    assert "AUSENTE" not in texto and "não anexada" not in texto


def test_fotos_ausentes_listam_cada_uma_com_o_motivo():
    texto = _texto(relatorio.gerar_pdf(_dados(fotos=_fotos(3))))
    assert "3/5" in texto and texto.count("AUSENTE") == 2
    assert "Lateral direita — não anexada. Motivo informado pelo mecânico: “Carro trancado pelo cliente”." in texto
    assert "Lateral esquerda — não anexada. Nenhum motivo foi informado." in texto  # pendente: sem motivo


def test_motivo_da_foto_nao_injeta_marcacao():
    fotos = _fotos(4, motivo="<b>x</b> & <font color='red'>y</font>")
    texto = _texto(relatorio.gerar_pdf(_dados(fotos=fotos)))
    assert "<b>x</b> & <font color='red'>y</font>" in texto


def test_parecer_pecas_servicos_e_total():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    assert "Troca de pastilhas realizada." in texto
    assert texto.index("PEÇAS SUBSTITUÍDAS") < texto.index("Total de peças R$ 400,00") < texto.index(
        "SERVIÇOS EXECUTADOS") < texto.index("Total de mão de obra R$ 160,00") < texto.index("TOTAL GERAL R$ 560,00")
    assert "Peca0" in texto and "Servico1" in texto


def test_sem_parecer_e_sem_itens():
    texto = _texto(relatorio.gerar_pdf(_dados(0, 0, parecer="")))
    assert "Nenhum parecer foi registrado." in texto
    assert "Nenhuma peça foi substituída." in texto and "Nenhum serviço registrado." in texto
    assert "TOTAL GERAL R$ 0,00" in texto


def test_validacao_do_cliente_metodo_e_data():
    assert "Aprovado via WhatsApp em 04/11/2026" in _texto(relatorio.gerar_pdf(_dados()))
    # 02:00 UTC de 05/11 ainda é 04/11 à noite em Brasília: a data não pode vir "adiantada"
    tarde = _dados(aprovacao={"em": "2026-11-05T02:00:00+00:00", "canal": "presencial", "obs": "", "versao": 1})
    assert "Aprovado via Presencial em 04/11/2026" in _texto(relatorio.gerar_pdf(tarde))
    sem = _texto(relatorio.gerar_pdf(_dados(aprovacao=None)))
    assert "Não há registro de aprovação do cliente para esta OS." in sem


@pytest.mark.parametrize("n_pecas,n_servicos", [(0, 0), (1, 1), (8, 6), (20, 15), (40, 30), (150, 100)])
def test_sempre_uma_unica_pagina(n_pecas, n_servicos):
    assert _paginas(relatorio.gerar_pdf(_dados(n_pecas, n_servicos, fotos=_fotos(2),
                                               parecer="Texto do parecer. " * 100))) == 1


def test_excesso_de_itens_corta_a_lista_mas_o_total_continua_completo():
    texto = _texto(relatorio.gerar_pdf(_dados(150, 100)))
    assert "não listado(s) por falta de espaço" in texto
    assert "TOTAL GERAL R$ 38.000,00" in texto  # 150 × 200 + 100 × 80


def test_assinatura_ilegivel_nao_derruba_o_relatorio():
    assert _paginas(relatorio.gerar_pdf(_dados(assinatura_png=b"isto nao e um png"))) == 1


def test_data_hora_local():
    assert relatorio.data_hora_local("2026-11-04", "08:30") == "04/11/2026 às 08:30"
    assert relatorio.data_hora_local("2026-11-04", "") == "04/11/2026"
    assert relatorio.data_hora_local("", "") == ""
