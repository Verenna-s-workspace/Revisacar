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
    assert "Relatório final" in texto and "Nº 77" in texto
    assert "Relatório emitido em 05/11/2026 às 18:10:33" in texto  # 21:10:33 UTC = 18:10:33 em Brasília
    assert "CNPJ 12.345.678/0001-99" in texto and "(11) 3333-4444" in texto
    assert "Serviço concluído em 05/11/2026 às 16:00 por Carlos" in texto


def test_ficha_de_entrada_e_saida():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    for esperado in ("Joao da Silva", "123.456.789-01", "(11) 99999-9999", "j@e.com", "Gol", "ABC1D23", "Prata", "2018",
                     "9BWZZZ377VT004251", "Flex", "Nível do tanque 1/2", "Hodômetro em 87.000 km",
                     "Hodômetro em 87.012 km", "Carlos Mecanico", "Registro CRM-123", "04/11/2026 às 08:30",
                     "05/11/2026 às 16:45"):
        assert esperado in texto, esperado


def test_fotos_completas_mostram_5_de_5_sem_lista_de_ausentes():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    assert "5/5" in texto and "Todas as 5 fotos obrigatórias foram anexadas" in texto
    assert "Não anexada" not in texto and "Nenhum motivo informado" not in texto


def test_fotos_ausentes_listam_cada_uma_com_o_motivo():
    texto = _texto(relatorio.gerar_pdf(_dados(fotos=_fotos(3))))
    assert "3/5" in texto and texto.count("Não anexada") == 2 and texto.count("Anexada") == 3
    assert "Carro trancado pelo cliente" in texto
    assert "Nenhum motivo informado" in texto  # pendente: sem motivo
    assert "2 de 5 fotos obrigatórias não foram anexadas" in texto
    assert "Nenhuma das 5 fotos obrigatórias foi anexada" in _texto(relatorio.gerar_pdf(_dados(fotos=_fotos(0, ""))))


def test_motivo_da_foto_nao_injeta_marcacao():
    fotos = _fotos(4, motivo="<b>x</b> & <font color='red'>y</font>")
    texto = _texto(relatorio.gerar_pdf(_dados(fotos=fotos)))
    assert "<b>x</b> & <font color='red'>y</font>" in texto


def test_parecer_pecas_servicos_e_total():
    texto = _texto(relatorio.gerar_pdf(_dados()))
    assert "Troca de pastilhas realizada." in texto
    assert texto.index("Peças substituídas") < texto.index("Peca0") < texto.index("Serviços executados") < texto.index(
        "Servico1")
    assert "R$ 200,00" in texto and "R$ 80,00" in texto and "Orçamento v2" in texto
    assert "R$ 400,00" in texto and "R$ 160,00" in texto  # total de peças e de mão de obra
    assert "R$ 560,00" in texto  # total geral = peças + serviços


def test_sem_parecer_e_sem_itens():
    texto = _texto(relatorio.gerar_pdf(_dados(0, 0, parecer="")))
    assert "Nenhum parecer foi registrado." in texto
    assert "Nenhuma peça foi substituída." in texto and "Nenhum serviço registrado." in texto
    assert "R$ 0,00" in texto


def test_validacao_do_cliente_metodo_e_data():
    assert "via WhatsApp em 04/11/2026" in _texto(relatorio.gerar_pdf(_dados()))
    # 02:00 UTC de 05/11 ainda é 04/11 à noite em Brasília: a data não pode vir "adiantada"
    tarde = _dados(aprovacao={"em": "2026-11-05T02:00:00+00:00", "canal": "presencial", "obs": "", "versao": 1})
    assert "via Presencial em 04/11/2026" in _texto(relatorio.gerar_pdf(tarde))
    sem = _texto(relatorio.gerar_pdf(_dados(aprovacao=None)))
    assert "Não há registro de aprovação do cliente para esta OS." in sem


def _fontes_e_tamanhos(conteudo: bytes):
    """Nomes de fonte e tamanhos (pt) de todo texto desenhado na página."""
    achados = []
    PdfReader(io.BytesIO(conteudo)).pages[0].extract_text(
        visitor_text=lambda txt, cm, tm, fd, fs: achados.append((fd["/BaseFont"].split("+")[-1], round(fs, 2)))
        if fd and txt.strip() else None)
    return {f for f, _ in achados}, {t for _, t in achados}


def test_so_dm_sans_com_6_tamanhos_e_3_pesos():
    fontes, tamanhos = _fontes_e_tamanhos(relatorio.gerar_pdf(_dados(fotos=_fotos(2))))
    assert fontes == {"DMSans-Regular", "DMSans-Medium", "DMSans-Bold"}
    assert len(tamanhos) <= 6, sorted(tamanhos)


def test_logo_e_placa_aparecem_no_pdf():
    pdf = PdfReader(io.BytesIO(relatorio.gerar_pdf(_dados())))
    imagens = [i.name for i in pdf.pages[0].images]
    assert len(imagens) >= 2  # logo da RevisaCar + bandeira da placa Mercosul
    antiga = _dados(veiculo={**_dados()["veiculo"], "placa": "ABC1234"})
    assert "ABC1234" in _texto(relatorio.gerar_pdf(antiga)) and "BR-BRASIL" in _texto(relatorio.gerar_pdf(antiga))
    assert "BRASIL" in _texto(relatorio.gerar_pdf(_dados())) and "ABC1D23" in _texto(relatorio.gerar_pdf(_dados()))


@pytest.mark.parametrize("n_pecas,n_servicos", [(0, 0), (1, 1), (8, 6), (20, 15), (40, 30), (150, 100)])
def test_sempre_uma_unica_pagina(n_pecas, n_servicos):
    assert _paginas(relatorio.gerar_pdf(_dados(n_pecas, n_servicos, fotos=_fotos(2),
                                               parecer="Texto do parecer. " * 100))) == 1


def test_excesso_de_itens_corta_a_lista_mas_o_total_continua_completo():
    texto = _texto(relatorio.gerar_pdf(_dados(150, 100)))
    assert "não listado(s) por falta de espaço" in texto
    assert "Total geral R$ 38.000,00" in texto  # 150 × 200 + 100 × 80


def test_assinatura_ilegivel_nao_derruba_o_relatorio():
    assert _paginas(relatorio.gerar_pdf(_dados(assinatura_png=b"isto nao e um png"))) == 1


def test_data_hora_local():
    assert relatorio.data_hora_local("2026-11-04", "08:30") == "04/11/2026 às 08:30"
    assert relatorio.data_hora_local("2026-11-04", "") == "04/11/2026"
    assert relatorio.data_hora_local("", "") == ""
