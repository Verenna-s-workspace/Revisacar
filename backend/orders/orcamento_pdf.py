"""
PDF do orçamento (Fase 3).

Função pura: recebe um dict já "limpo" e devolve os bytes do PDF. Não acessa o
banco nem o Storage — quem monta o dict (orcamento_views) escolhe o que entra.
O PDF é o documento que o CLIENTE vê, então mostra SÓ o preço cobrado: custo,
margem e vínculos internos (estoque/catálogo) nunca chegam aqui.

dados = {
  oficina_nome, os_num, versao, status, emitido_em (str), validade_ate (str|None),
  cliente: {nome, tel, doc}, veiculo: {placa, modelo, ano, cor, km_saida},
  itens: [{tipo, descricao, marca, quantidade, preco_unitario, subtotal, motivo}],
  total, observacoes,
  aprovacao: {em, canal, nome, obs} | None,
  assinatura_png: bytes | None,
}
"""
import base64
import binascii
import io
import os
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable, Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# Cores e fontes do site / do PDF do checklist (RevisaCar: vermelho #CC1400, DM Sans + DM Mono).
COR_MARCA = colors.HexColor("#CC1400")
COR_TEXTO = colors.HexColor("#1a1a1a")
COR_SUAVE = colors.HexColor("#6b6b6b")
COR_LINHA = colors.HexColor("#dcdcdc")
COR_ROTULO = colors.HexColor("#a09c95")          # rótulo dos campos
COR_ROTULO_SECAO = colors.HexColor("#9a958c")    # título de seção, cabeçalho de tabela, textos de apoio
COR_META = colors.HexColor("#6b6760")            # dados da OS no cabeçalho
COR_FIO = colors.HexColor("#f0eeea")             # fio entre campos / linhas
COR_FIO_RODAPE = colors.HexColor("#e5e3de")
LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "logo_revisacar.png")
PASTA_FONTES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "fonts")


def _registrar_fontes():
    """Usa DM Sans / DM Mono (as do site) se os .ttf estiverem em assets/fonts; senão cai em
    Helvetica / Courier, que vêm com o reportlab. Devolve os nomes das fontes a usar."""
    arquivos = {
        "DMSans": "DMSans-Regular.ttf", "DMSans-Medium": "DMSans-Medium.ttf", "DMSans-Bold": "DMSans-Bold.ttf",
        "DMMono": "DMMono-Regular.ttf", "DMMono-Medium": "DMMono-Medium.ttf",
    }
    caminhos = {nome: os.path.join(PASTA_FONTES, arq) for nome, arq in arquivos.items()}
    if all(os.path.exists(c) for c in caminhos.values()):
        try:
            for nome, caminho in caminhos.items():
                pdfmetrics.registerFont(TTFont(nome, caminho))
            pdfmetrics.registerFontFamily("DMSans", normal="DMSans", bold="DMSans-Bold",
                                          italic="DMSans", boldItalic="DMSans-Bold")
            return "DMSans", "DMSans-Medium", "DMSans-Bold", "DMMono", "DMMono-Medium"
        except Exception:  # noqa: BLE001 — fonte corrompida não pode impedir o PDF
            pass
    return "Helvetica", "Helvetica", "Helvetica-Bold", "Courier", "Courier-Bold"


F_TXT, F_TXT_M, F_TXT_B, F_MONO, F_MONO_M = _registrar_fontes()

STATUS_ROTULO = {
    "rascunho": "RASCUNHO — ainda não enviado ao cliente",
    "enviado": "Aguardando aprovação do cliente",
    "aprovado": "APROVADO",
    "recusado": "Recusado pelo cliente",
    "substituido": "Substituído por uma versão mais recente",
}
CANAL_ROTULO = {
    "whatsapp": "WhatsApp", "presencial": "Presencial", "telefone": "Telefone",
    "app": "Aplicativo", "link": "Link do orçamento", "outro": "Outro",
}


def brl(valor) -> str:
    """1234.5 → 'R$ 1.234,50'."""
    n = Decimal(str(valor)).quantize(Decimal("0.01"))
    inteiro, _, frac = f"{n:.2f}".partition(".")
    sinal = "-" if inteiro.startswith("-") else ""
    inteiro = inteiro.lstrip("-")
    grupos = []
    while len(inteiro) > 3:
        grupos.insert(0, inteiro[-3:])
        inteiro = inteiro[:-3]
    grupos.insert(0, inteiro)
    return f"{sinal}R$ {'.'.join(grupos)},{frac}"


def qtd_txt(valor) -> str:
    n = Decimal(str(valor)).normalize()
    texto = f"{n:f}"
    return texto.replace(".", ",")


def rotulo_os(os_num) -> str:
    """'OS-77' fica 'OS-77'; '77' vira 'OS 77'."""
    n = str(os_num or "").strip()
    return n if n.upper().startswith("OS") else f"OS {n}"


def data_br(iso) -> str:
    """'2026-10-12' ou '2026-10-12T13:00:00+00:00' → '12/10/2026' (só a parte da data)."""
    if not iso:
        return ""
    d = str(iso)[:10]
    try:
        a, m, dia = d.split("-")
        return f"{dia}/{m}/{a}"
    except ValueError:
        return str(iso)


FUSO_PADRAO = ZoneInfo("America/Sao_Paulo")


def data_hora_br(iso) -> str:
    """'2026-10-12T16:05:09+00:00' → '12/10/2026 às 13:05' (hora de Brasília, fuso padrão do app).
    Sem hora no valor (só a data), devolve só a data; valor ilegível volta como veio."""
    if not iso:
        return ""
    texto = str(iso).strip()
    try:
        dt = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        return data_br(texto)
    if len(texto) <= 10:
        return dt.strftime("%d/%m/%Y")
    if dt.tzinfo is None:  # sem fuso no valor: já está no horário local
        dt = dt.replace(tzinfo=FUSO_PADRAO)
    return dt.astimezone(FUSO_PADRAO).strftime("%d/%m/%Y às %H:%M")


def km_txt(valor) -> str:
    """'87450' (ou '87.450') → '87.450 km'. Vazio/ilegível → ''."""
    d = "".join(ch for ch in str(valor or "") if ch.isdigit())
    if not d:
        return ""
    return f"{int(d):,}".replace(",", ".") + " km"


def _p(texto, estilo):
    return Paragraph(escape(str(texto or "")).replace("\n", "<br/>"), estilo)


def so_digitos(valor) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def _numero_os(os_num) -> str:
    """'OS-77' / 'OS 77' / '77' → '77'."""
    n = str(os_num or "").strip()
    if n.upper().startswith("OS"):
        n = n[2:].lstrip(" -·")
    return n


def doc_txt(valor) -> str:
    """CPF/CNPJ só com dígitos → com máscara. Formato desconhecido volta como veio."""
    d = so_digitos(valor)
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return str(valor or "")


def tel_txt(valor) -> str:
    d = so_digitos(valor)
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return str(valor or "")


class TituloSecao(Flowable):
    """Título de seção no estilo do PDF do checklist: tracinho vermelho + rótulo em mono, caixa alta."""

    def __init__(self, texto, k=1.0):
        super().__init__()
        self.texto, self.k = str(texto).upper(), k

    def wrap(self, largura, altura):
        self.largura = largura
        return largura, 9 * self.k

    def draw(self):
        c, k = self.canv, self.k
        c.setFillColor(COR_MARCA)
        c.rect(0, 3.2 * k, 7 * k, 1.1 * k, stroke=0, fill=1)
        c.setFillColor(COR_ROTULO_SECAO)
        c.setFont(F_MONO_M, 6.2 * k)
        c.drawString(11 * k, 2.6 * k, self.texto, charSpace=0.9 * k)


def _estilos(k: float = 1.0):
    """Estilos do PDF (fontes e cores do PDF do checklist). `k` (≤ 1) encolhe fontes e espaçamentos —
    usado quando o conteúdo não cabe em uma página (ver gerar_pdf)."""
    base = getSampleStyleSheet()["Normal"]
    base = ParagraphStyle("base", parent=base, fontName=F_TXT, fontSize=8.6 * k, leading=11 * k,
                          textColor=COR_TEXTO)
    return {
        "base": base,
        "suave": ParagraphStyle("suave", parent=base, textColor=COR_ROTULO_SECAO, fontSize=7.4 * k, leading=9.5 * k),
        "negrito": ParagraphStyle("negrito", parent=base, fontName=F_TXT_B),
        "marca": ParagraphStyle("marca", parent=base, fontName=F_TXT_B, fontSize=13 * k, leading=15 * k),
        "marca_sub": ParagraphStyle("marca_sub", parent=base, fontName=F_MONO, fontSize=5.6 * k, leading=7.5 * k,
                                    textColor=COR_ROTULO),
        "meta": ParagraphStyle("meta", parent=base, fontName=F_MONO, fontSize=6.8 * k, leading=10 * k,
                               textColor=COR_META, alignment=TA_RIGHT),
        "os": ParagraphStyle("os", parent=base, fontName=F_TXT_B, fontSize=11 * k, leading=14 * k,
                             alignment=TA_RIGHT),
        "rotulo": ParagraphStyle("rotulo", parent=base, fontName=F_MONO, fontSize=5.4 * k, leading=7 * k,
                                 textColor=COR_ROTULO),
        "valor": ParagraphStyle("valor", parent=base, fontName=F_TXT_M, fontSize=8.8 * k, leading=10.6 * k),
        "direita": ParagraphStyle("direita", parent=base, alignment=TA_RIGHT),
        "texto_livre": ParagraphStyle("texto_livre", parent=base, fontSize=8.8 * k, leading=13 * k),
        "subtotal": ParagraphStyle("subtotal", parent=base, fontName=F_TXT_B, fontSize=9.6 * k, leading=12.5 * k,
                                   alignment=TA_RIGHT),
        "total_rot": ParagraphStyle("total_rot", parent=base, fontName=F_MONO_M, fontSize=7 * k, leading=9 * k,
                                    textColor=COR_TEXTO),
        "total": ParagraphStyle("total", parent=base, fontName=F_TXT_B, fontSize=15 * k, leading=18 * k,
                                alignment=TA_RIGHT, textColor=COR_MARCA),
        "cab": ParagraphStyle("cab", parent=base, fontName=F_MONO_M, fontSize=5.8 * k, leading=7.5 * k,
                              textColor=COR_ROTULO_SECAO),
        "cab_dir": ParagraphStyle("cab_dir", parent=base, fontName=F_MONO_M, fontSize=5.8 * k, leading=7.5 * k,
                                  textColor=COR_ROTULO_SECAO, alignment=TA_RIGHT),
    }


def _soma(itens) -> Decimal:
    return sum((Decimal(str(i.get("subtotal") or 0)) for i in itens), Decimal("0"))


def _bloco_campos(linhas, largura, e, k):
    """Campos "rótulo em cima, valor embaixo" com fio fino entre eles, como no checklist.
    `linhas`: lista de linhas; cada linha tem 1 campo (largura toda) ou 2 (lado a lado)."""
    meia = largura / 2
    dados, estilo = [], [
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * k),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, COR_FIO),
    ]
    for r, linha in enumerate(linhas):
        celulas = [[_p(rot.upper(), e["rotulo"]), _p(val or "—", e["valor"])] for rot, val in linha]
        if len(celulas) == 1:
            dados.append([celulas[0], ""])
            estilo.append(("SPAN", (0, r), (1, r)))
        else:
            dados.append(celulas)
            estilo.append(("RIGHTPADDING", (0, r), (0, r), 6 * k))
    tabela = Table(dados, colWidths=[meia, meia])
    tabela.setStyle(TableStyle(estilo))
    return tabela


def _secao_itens(titulo, rotulo_total, vazio, itens, e, largura, k):
    """Uma seção da listagem (Peças ou Serviços): tabela de itens + total logo abaixo."""
    flow = [Spacer(1, 10 * k), TituloSecao(titulo, k), Spacer(1, 3 * k)]
    if not itens:
        flow.append(_p(vazio, e["suave"]))
    else:
        linhas = [[_p("Descrição", e["cab"]), _p("Qtd", e["cab_dir"]), _p("Valor un.", e["cab_dir"]),
                   _p("Subtotal", e["cab_dir"])]]
        for item in itens:
            celula = [Paragraph(f"<font name='{F_TXT_M}'>{escape(item.get('descricao') or '')}</font>"
                                + (f" <font color='#9a958c'>· {escape(item['marca'])}</font>"
                                   if item.get("marca") else ""), e["base"])]
            if item.get("motivo"):
                celula.append(_p(item["motivo"], e["suave"]))
            linhas.append([celula, _p(qtd_txt(item.get("quantidade")), e["direita"]),
                           _p(brl(item.get("preco_unitario")), e["direita"]),
                           _p(brl(item.get("subtotal")), e["direita"])])
        tabela = Table(linhas, colWidths=[largura * 0.52, largura * 0.1, largura * 0.19, largura * 0.19],
                       repeatRows=1)
        tabela.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("LINEBELOW", (0, 0), (-1, 0), 0.7, COR_TEXTO),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, COR_FIO),
            ("TOPPADDING", (0, 0), (-1, -1), 2.6 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6 * k),
        ]))
        flow.append(tabela)
    rot = f"<font name='{F_MONO}' size='{6.4 * k:.2f}' color='#9a958c'>{escape(rotulo_total)}</font>"
    flow += [Spacer(1, 3 * k), Paragraph(f"{rot}&nbsp;&nbsp;{escape(brl(_soma(itens)))}", e["subtotal"])]
    return flow


def _construir(dados: dict, k: float):
    """Monta o PDF com a escala `k`. Devolve (bytes, nº de páginas)."""
    e = _estilos(k)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        # o Frame do reportlab tem 6 pt de padding: compensa para texto e tabelas alinharem em 16 mm
        buf, pagesize=A4, leftMargin=16 * mm - 6, rightMargin=16 * mm - 6, topMargin=12 * mm * k + 2 * mm,
        bottomMargin=16 * mm,
        title=f"Orçamento {dados.get('os_num', '')} v{dados.get('versao', '')}",
        author=dados.get("oficina_nome") or "RevisaCar",
    )
    largura = A4[0] - 32 * mm
    flow = []

    # Cabeçalho (igual ao do checklist): logo pequeno + barrinha vermelha e nome à esquerda,
    # dados da OS à direita, fio escuro embaixo.
    nome = [_p(dados.get("oficina_nome") or "Oficina", e["marca"]), _p("ORÇAMENTO DE SERVIÇOS", e["marca_sub"])]
    barra_nome = Table([["", "", nome]], colWidths=[2.2 * k + 0.3, 6 * k, largura * 0.55 - 8.5 * k])
    barra_nome.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), COR_MARCA), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    esquerda = []
    if os.path.exists(LOGO_PATH):
        alt = 7 * mm * k
        logo = Image(LOGO_PATH, width=alt * 600 / 496, height=alt)
        logo.hAlign = "LEFT"
        esquerda += [logo, Spacer(1, 2.5 * k)]
    esquerda.append(barra_nome)
    direita = [
        _p(f"OS Nº {_numero_os(dados.get('os_num'))}", e["os"]),
        _p(f"Versão {dados.get('versao', 1)}", e["meta"]),
        _p(f"Emitido em {data_hora_br(dados.get('emitido_em'))}", e["meta"]),
    ]
    cab = Table([[esquerda, direita]], colWidths=[largura * 0.55, largura * 0.45])
    cab.setStyle(TableStyle([
        ("VALIGN", (0, 0), (0, 0), "BOTTOM"), ("VALIGN", (1, 0), (1, 0), "BOTTOM"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, COR_TEXTO),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7 * k), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    flow += [cab, Spacer(1, 6 * k)]

    status = dados.get("status") or ""
    validade = (f"Válido até {data_br(dados['validade_ate'])}"
                if dados.get("validade_ate") and status in ("enviado", "aprovado") else "")
    faixa = Table([[_p(STATUS_ROTULO.get(status, status), e["negrito"]), _p(validade, e["direita"])]],
                  colWidths=[largura * 0.65, largura * 0.35])
    faixa.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                               ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow += [faixa, Spacer(1, 7 * k)]

    # Cliente e veículo: duas colunas separadas, cada uma com seu título e seus campos
    c, v = dados.get("cliente") or {}, dados.get("veiculo") or {}
    folga = 20 * k
    col = (largura - folga) / 2
    col_cli = [TituloSecao("Cliente", k), Spacer(1, 3 * k), _bloco_campos([
        [("Nome", c.get("nome"))],
        [("CPF / CNPJ", doc_txt(c.get("doc")))],
        [("Telefone", tel_txt(c.get("tel")))],
        [("E-mail", c.get("email"))],
    ], col, e, k)]
    col_vei = [TituloSecao("Veículo", k), Spacer(1, 3 * k), _bloco_campos([
        [("Placa", v.get("placa")), ("Ano", v.get("ano"))],
        [("Modelo", v.get("modelo"))],
        [("Cor", v.get("cor")), ("KM de saída", km_txt(v.get("km_saida")))],
    ], col, e, k)]
    dados_t = Table([[col_cli, "", col_vei]], colWidths=[col, folga, col])
    dados_t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                 ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                                 ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow.append(dados_t)

    # Itens: Peças e Serviços em seções separadas, cada uma com o seu total
    itens = dados.get("itens") or []
    pecas = [i for i in itens if i.get("tipo") == "peca"]
    servicos = [i for i in itens if i.get("tipo") != "peca"]
    flow += _secao_itens("Peças", "Total de peças", "Nenhuma peça neste orçamento.", pecas, e, largura, k)
    flow += _secao_itens("Serviços", "Total de mão de obra", "Nenhum serviço neste orçamento.",
                         servicos, e, largura, k)

    # Total geral = peças + serviços
    total_geral = _soma(pecas) + _soma(servicos)
    linha_total = Table([[_p("TOTAL GERAL", e["total_rot"]), _p(brl(total_geral), e["total"])]],
                        colWidths=[largura * 0.5, largura * 0.5])
    linha_total.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.8, COR_TEXTO), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow += [Spacer(1, 9 * k), linha_total]

    if dados.get("observacoes"):
        flow += [Spacer(1, 7 * k), TituloSecao("Observações", k), Spacer(1, 3 * k),
                 _p(dados["observacoes"], e["texto_livre"])]

    # Aprovação / assinatura
    apr = dados.get("aprovacao")
    assinatura = dados.get("assinatura_png")
    bloco = []
    if apr or assinatura:
        bloco += [Spacer(1, 7 * k), TituloSecao("Aprovação", k), Spacer(1, 3 * k)]
    if apr:
        txt = f"Aprovado em {data_br(apr.get('em'))}"
        if apr.get("canal"):
            txt += f" · {CANAL_ROTULO.get(apr['canal'], apr['canal'])}"
        bloco.append(_p(txt, e["base"]))
        if apr.get("obs"):
            bloco.append(_p(apr["obs"], e["suave"]))
    if assinatura:
        img = Image(io.BytesIO(assinatura))
        proporcao = img.imageHeight / float(img.imageWidth or 1)
        w = min(50 * mm * k, img.imageWidth)
        img.drawWidth, img.drawHeight = w, min(w * proporcao, 18 * mm * k)
        img.hAlign = "RIGHT"
        legenda = Table([[_p("Assinatura do cliente", e["marca_sub"])]], colWidths=[52 * mm * k], hAlign="RIGHT")
        legenda.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 0.7, COR_TEXTO), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                     ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                     ("TOPPADDING", (0, 0), (-1, -1), 2 * k)]))
        bloco += [Spacer(1, 3 * k), img, legenda]
    if bloco:
        flow.append(KeepTogether(bloco))

    def rodape(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(COR_FIO_RODAPE)
        canvas.setLineWidth(0.5)
        canvas.line(16 * mm, 12.5 * mm, A4[0] - 16 * mm, 12.5 * mm)
        canvas.setFont(F_MONO, 6.4)
        canvas.setFillColor(COR_ROTULO_SECAO)
        canvas.drawString(16 * mm, 9 * mm, f"{dados.get('oficina_nome') or ''} · {rotulo_os(dados.get('os_num'))} · "
                                           f"orçamento v{dados.get('versao', 1)}")
        canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Página {doc_.page}")
        if status == "rascunho":
            canvas.setFont("Helvetica-Bold", 60)
            canvas.setFillColor(colors.Color(0.8, 0.8, 0.8, alpha=0.35))
            canvas.translate(A4[0] / 2, A4[1] / 2)
            canvas.rotate(35)
            canvas.drawCentredString(0, 0, "RASCUNHO")
        canvas.restoreState()

    doc.build(flow, onFirstPage=rodape, onLaterPages=rodape)
    return buf.getvalue(), doc.page


# Escalas tentadas até caber em uma página (1.0 = tamanho normal).
ESCALAS_PAGINA_UNICA = (1.0, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6)


def gerar_pdf(dados: dict) -> bytes:
    """PDF em página única: tenta o tamanho normal e, se passar de uma página, encolhe fontes e
    espaçamentos aos poucos. Só se nem a menor escala couber (centenas de itens) ele continua
    na página seguinte, em vez de cortar conteúdo."""
    conteudo = b""
    for k in ESCALAS_PAGINA_UNICA:
        conteudo, paginas = _construir(dados, k)
        if paginas <= 1:
            break
    return conteudo


# ── Assinatura desenhada ──────────────────────────────────────────────────────

MAX_ASSINATURA_BYTES = 400_000
MAX_ASSINATURA_LARGURA = 1600
MAX_ASSINATURA_ALTURA = 800
_PREFIXO_PNG = "data:image/png;base64,"


def decodificar_assinatura(data_url: str):
    """'data:image/png;base64,...' (canvas.toDataURL) → bytes de um PNG limpo (fundo branco),
    ou None se o traço está em branco. Levanta ValueError se não for um PNG aceitável.
    O arquivo é reencodado: nada do que o cliente mandou é guardado como veio."""
    from PIL import Image as PILImage

    if not isinstance(data_url, str) or not data_url.startswith(_PREFIXO_PNG):
        raise ValueError("A assinatura precisa ser uma imagem PNG.")
    try:
        bruto = base64.b64decode(data_url[len(_PREFIXO_PNG):], validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("Assinatura inválida.")
    if len(bruto) > MAX_ASSINATURA_BYTES:
        raise ValueError("Assinatura muito grande.")
    try:
        img = PILImage.open(io.BytesIO(bruto))
        img.load()
    except Exception:
        raise ValueError("Assinatura inválida.")
    if img.format != "PNG":
        raise ValueError("A assinatura precisa ser uma imagem PNG.")
    if img.width > MAX_ASSINATURA_LARGURA or img.height > MAX_ASSINATURA_ALTURA or img.width < 20 or img.height < 10:
        raise ValueError("Tamanho de assinatura não aceito.")
    rgba = img.convert("RGBA")
    fundo = PILImage.new("RGBA", rgba.size, (255, 255, 255, 255))
    fundo.alpha_composite(rgba)
    rgb = fundo.convert("RGB")
    # Em branco = nenhum pixel com tinta.
    if rgb.convert("L").point(lambda v: 255 if v < 250 else 0).getbbox() is None:
        return None
    saida = io.BytesIO()
    rgb.save(saida, "PNG", optimize=True)
    return saida.getvalue()
