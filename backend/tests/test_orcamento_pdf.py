"""PDF do orçamento (Fase 3): conteúdo (só preço cobrado), Storage, assinatura, permissões."""
import base64
import io

import django
import pytest

django.setup()

from PIL import Image, ImageDraw  # noqa: E402

from orders import orcamento_pdf, orcamento_views  # noqa: E402

from .conftest import OFICINA_B  # noqa: E402
from .test_orcamento import (  # noqa: E402,F401
    _cliente, _enviado, _os, _peca, _rascunho, _servico, dono, fake, gerente, hoje,
)


def _png(traco=True, w=300, h=100, modo="RGBA"):
    img = Image.new(modo, (w, h), (0, 0, 0, 0) if modo == "RGBA" else (255, 255, 255))
    if traco:
        ImageDraw.Draw(img).line((10, 80, 150, 20, 290, 90), fill=(0, 0, 0, 255) if modo == "RGBA" else (0, 0, 0), width=4)
    b = io.BytesIO()
    img.save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


def _texto_pdf(conteudo: bytes) -> str:
    from pypdf import PdfReader  # só pra testar; ver requirements-dev
    return "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(conteudo)).pages)


# ── gerador puro ─────────────────────────────────────────────────────────────

def test_brl_e_quantidade():
    assert orcamento_pdf.brl(1234.5) == "R$ 1.234,50"
    assert orcamento_pdf.brl(0) == "R$ 0,00"
    assert orcamento_pdf.brl(1234567.891) == "R$ 1.234.567,89"
    assert orcamento_pdf.qtd_txt(2) == "2" and orcamento_pdf.qtd_txt("1.500") == "1,5"
    assert orcamento_pdf.rotulo_os("OS-77") == "OS-77" and orcamento_pdf.rotulo_os("77") == "OS 77"


def test_data_hora_e_km():
    # 18:35 UTC = 15:35 em Brasília
    assert orcamento_pdf.data_hora_br("2026-11-04T18:35:09+00:00") == "04/11/2026 às 15:35"
    assert orcamento_pdf.data_hora_br("2026-11-04") == "04/11/2026"
    assert orcamento_pdf.data_hora_br(None) == ""
    assert orcamento_pdf.km_txt("87450") == "87.450 km" and orcamento_pdf.km_txt("") == ""


def _dados_pdf(n_pecas=2, n_servicos=2, **extra):
    itens = [{"tipo": "peca", "descricao": f"Peca{i}", "marca": "Bosch", "quantidade": 2,
              "preco_unitario": "100.00", "subtotal": "200.00", "motivo": ""} for i in range(n_pecas)]
    itens += [{"tipo": "servico", "descricao": f"Servico{i}", "marca": "", "quantidade": 1,
               "preco_unitario": "80.00", "subtotal": "80.00", "motivo": ""} for i in range(n_servicos)]
    base = {
        "oficina_nome": "Oficina X", "os_num": "OS-77", "versao": 1, "status": "enviado",
        "emitido_em": "2026-11-04T18:35:09+00:00", "validade_ate": None,
        "cliente": {"nome": "Joao", "tel": "", "doc": ""},
        "veiculo": {"placa": "ABC1D23", "modelo": "Gol", "ano": "2018", "cor": "Prata", "km_saida": "87450"},
        "itens": itens, "total": "0", "observacoes": "", "aprovacao": None, "assinatura_png": None,
    }
    base.update(extra)
    return base


def test_pdf_layout_pecas_servicos_km_e_hora():
    pytest.importorskip("pypdf")
    texto = _texto_pdf(orcamento_pdf.gerar_pdf(_dados_pdf()))
    assert "04/11/2026 às 15:35" in texto
    assert "KM de saída: 87.450 km" in texto
    assert texto.index("PEÇAS") < texto.index("Total de peças R$ 400,00") < texto.index("SERVIÇOS")
    assert texto.index("SERVIÇOS") < texto.index("Total de mão de obra R$ 160,00") < texto.index("TOTAL GERAL")
    assert "R$ 560,00" in texto  # total geral = peças + serviços


def test_pdf_sempre_em_uma_pagina():
    from pypdf import PdfReader
    for n_pecas, n_servicos in ((1, 1), (12, 8), (25, 15)):
        pdf = orcamento_pdf.gerar_pdf(_dados_pdf(n_pecas, n_servicos))
        assert len(PdfReader(io.BytesIO(pdf)).pages) == 1, (n_pecas, n_servicos)


def test_pdf_so_pecas_ou_so_servicos():
    pytest.importorskip("pypdf")
    texto = _texto_pdf(orcamento_pdf.gerar_pdf(_dados_pdf(n_pecas=0, n_servicos=1)))
    assert "Nenhuma peça neste orçamento." in texto and "Total de peças R$ 0,00" in texto
    assert "TOTAL GERAL" in texto and "R$ 80,00" in texto


def test_assinatura_valida_e_em_branco():
    png = orcamento_pdf.decodificar_assinatura(_png())
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert orcamento_pdf.decodificar_assinatura(_png(traco=False)) is None


@pytest.mark.parametrize("entrada", [
    "", "texto", "data:image/jpeg;base64,AAAA", "data:image/png;base64,@@@@",
    "data:image/png;base64," + base64.b64encode(b"nao sou png").decode(),
    _png(w=5000, h=100), _png(w=10, h=5),
])
def test_assinatura_invalida(entrada):
    with pytest.raises(ValueError):
        orcamento_pdf.decodificar_assinatura(entrada)


# ── rotas ────────────────────────────────────────────────────────────────────

def test_enviar_gera_e_guarda_pdf(dono, fake):
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("Pastilha", 2, 100, custoUnitario=40), _servico("Alinhamento", 1, 80)])
    assert orc["pdfGerado"] is True and orc["pdfDisponivel"] is True and orc["assinado"] is False
    caminho = f"{oid}/orcamento-v1.pdf"
    assert fake.storage.arquivos[caminho][:5] == b"%PDF-"
    assert fake.storage.opcoes[caminho]["upsert"] == "true"
    r = dono.get(f"/orcamentos/{orc['id']}/pdf")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf"
    assert r.content == fake.storage.arquivos[caminho]
    assert "orcamento-" in r["Content-Disposition"]


def test_pdf_mostra_so_preco_cobrado(dono, fake):
    pytest.importorskip("pypdf")
    oid = _os(dono)
    orc = _enviado(dono, oid, [_peca("Pastilha", 2, 123.45, custoUnitario=77.77, motivo="Desgaste")])
    texto = _texto_pdf(dono.get(f"/orcamentos/{orc['id']}/pdf").content)
    assert "123,45" in texto and "246,90" in texto and "Pastilha" in texto
    assert "77,77" not in texto and "Margem" not in texto and "Custo" not in texto


def test_aprovar_com_assinatura_refaz_pdf(dono, fake):
    pytest.importorskip("pypdf")
    oid = _os(dono)
    orc = _enviado(dono, oid)
    antes = fake.storage.arquivos[f"{oid}/orcamento-v1.pdf"]
    r = dono.post(f"/orcamentos/{orc['id']}/aprovar", {"canal": "presencial", "assinatura": _png()}, format="json")
    assert r.status_code == 200, r.content
    corpo = r.json()
    assert corpo["status"] == "aprovado" and corpo["assinado"] is True and corpo["pdfGerado"] is True
    assert corpo["assinaturaSalva"] is True
    assert fake.storage.arquivos[f"{oid}/orcamento-v1-assinatura.png"][:4] == b"\x89PNG"
    depois = fake.storage.arquivos[f"{oid}/orcamento-v1.pdf"]
    assert depois != antes
    texto = _texto_pdf(depois)
    assert "APROVADO" in texto and "Assinatura do cliente" in texto


def test_aprovar_sem_assinatura_funciona(dono, fake):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    r = dono.post(f"/orcamentos/{orc['id']}/aprovar", {"assinatura": _png(traco=False)}, format="json")
    assert r.status_code == 200
    assert r.json()["assinado"] is False
    assert f"{oid}/orcamento-v1-assinatura.png" not in fake.storage.arquivos


def test_assinatura_invalida_nao_aprova(dono, fake, db):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    r = dono.post(f"/orcamentos/{orc['id']}/aprovar", {"assinatura": "data:image/png;base64,@@@"}, format="json")
    assert r.status_code == 422 and "assinatura" in r.json()
    assert dono.get(f"/orcamentos/{orc['id']}").json()["status"] == "enviado"


def test_falha_no_storage_nao_desfaz_envio_nem_aprovacao(dono, fake):
    oid = _os(dono)
    fake.storage.falhar_upload = True
    orc = _enviado(dono, oid)
    assert orc["status"] == "enviado" and orc["pdfGerado"] is False and orc["pdfDisponivel"] is False
    r = dono.post(f"/orcamentos/{orc['id']}/aprovar", {"assinatura": _png()}, format="json")
    assert r.status_code == 200
    assert r.json()["status"] == "aprovado" and r.json()["assinaturaSalva"] is False
    # GET /pdf ainda entrega (gerado na hora, sem guardar)
    resp = dono.get(f"/orcamentos/{orc['id']}/pdf")
    assert resp.status_code == 200 and resp.content[:5] == b"%PDF-"
    # Storage volta: GET /pdf guarda
    fake.storage.falhar_upload = False
    assert dono.get(f"/orcamentos/{orc['id']}/pdf").status_code == 200
    assert f"{oid}/orcamento-v1.pdf" in fake.storage.arquivos


def test_pdf_sumiu_do_storage_e_refeito(dono, fake):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    fake.storage.arquivos.clear()
    r = dono.get(f"/orcamentos/{orc['id']}/pdf")
    assert r.status_code == 200 and f"{oid}/orcamento-v1.pdf" in fake.storage.arquivos


def test_rascunho_gera_previa_sem_guardar(dono, fake):
    oid = _os(dono)
    orc = _rascunho(dono, oid, [_peca()])
    r = dono.get(f"/orcamentos/{orc['id']}/pdf")
    assert r.status_code == 200 and r.content[:5] == b"%PDF-"
    assert fake.storage.arquivos == {}
    assert dono.get(f"/orcamentos/{orc['id']}").json()["pdfDisponivel"] is False


def test_pdf_sem_itens_422(dono, fake):
    oid = _os(dono)
    orc = _rascunho(dono, oid)
    r = dono.get(f"/orcamentos/{orc['id']}/pdf")
    assert r.status_code == 422 and r.json()["codigo"] == "sem_itens"


def test_pdf_de_outra_oficina_404_e_id_ruim(dono, fake):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    assert _cliente("dono", OFICINA_B).get(f"/orcamentos/{orc['id']}/pdf").status_code == 404
    assert dono.get("/orcamentos/nao-e-uuid/pdf").status_code == 404


def test_atendente_le_pdf_mas_nao_aprova(dono, fake):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    at = _cliente("atendente")
    assert at.get(f"/orcamentos/{orc['id']}/pdf").status_code == 200
    assert at.post(f"/orcamentos/{orc['id']}/aprovar", {"assinatura": _png()}, format="json").status_code == 403


def test_nova_versao_tem_pdf_proprio(dono, fake):
    oid = _os(dono)
    v1 = _enviado(dono, oid)
    r = dono.post(f"/ordens/{oid}/orcamentos", format="json")
    v2 = dono.patch(f"/orcamentos/{r.json()['id']}", {"itens": [_peca("Outra", 1, 10)]}, format="json").json()
    dono.post(f"/orcamentos/{v2['id']}/enviar", format="json")
    assert f"{oid}/orcamento-v1.pdf" in fake.storage.arquivos and f"{oid}/orcamento-v2.pdf" in fake.storage.arquivos
    assert dono.get(f"/orcamentos/{v1['id']}/pdf").status_code == 200


def test_apagar_os_leva_os_arquivos(dono, fake):
    oid = _os(dono)
    orc = _enviado(dono, oid)
    dono.post(f"/orcamentos/{orc['id']}/aprovar", {"assinatura": _png()}, format="json")
    assert dono.delete(f"/ordens/{oid}").status_code == 200
    assert fake.storage.arquivos == {}
