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
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

COR_MARCA = colors.HexColor("#c8102e")
COR_TEXTO = colors.HexColor("#1a1a1a")
COR_SUAVE = colors.HexColor("#6b6b6b")
COR_LINHA = colors.HexColor("#dcdcdc")

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


def _estilos(k: float = 1.0):
    """Estilos do PDF. `k` (≤ 1) encolhe fontes e espaçamentos — usado quando o conteúdo
    não cabe em uma página (ver gerar_pdf)."""
    base = getSampleStyleSheet()["Normal"]
    base = ParagraphStyle("base", parent=base, fontName="Helvetica", fontSize=9 * k, leading=11.5 * k,
                          textColor=COR_TEXTO)
    return {
        "base": base,
        "suave": ParagraphStyle("suave", parent=base, textColor=COR_SUAVE, fontSize=8 * k, leading=10 * k),
        "negrito": ParagraphStyle("negrito", parent=base, fontName="Helvetica-Bold"),
        "titulo": ParagraphStyle("titulo", parent=base, fontName="Helvetica-Bold", fontSize=16 * k, leading=19 * k),
        "secao": ParagraphStyle("secao", parent=base, fontName="Helvetica-Bold", fontSize=8 * k, leading=10 * k,
                                textColor=COR_SUAVE, spaceBefore=7 * k, spaceAfter=3 * k),
        "direita": ParagraphStyle("direita", parent=base, alignment=TA_RIGHT),
        "subtotal": ParagraphStyle("subtotal", parent=base, fontName="Helvetica-Bold", fontSize=10 * k,
                                   leading=13 * k, alignment=TA_RIGHT),
        "total": ParagraphStyle("total", parent=base, fontName="Helvetica-Bold", fontSize=14 * k, leading=17 * k,
                                alignment=TA_RIGHT),
        "cab": ParagraphStyle("cab", parent=base, fontName="Helvetica-Bold", fontSize=7.5 * k, leading=9.5 * k,
                              textColor=colors.white),
        "cab_dir": ParagraphStyle("cab_dir", parent=base, fontName="Helvetica-Bold", fontSize=7.5 * k,
                                  leading=9.5 * k, textColor=colors.white, alignment=TA_RIGHT),
    }


def _soma(itens) -> Decimal:
    return sum((Decimal(str(i.get("subtotal") or 0)) for i in itens), Decimal("0"))


def _secao_itens(titulo, rotulo_total, vazio, itens, e, largura, k):
    """Uma seção da listagem (Peças ou Serviços): tabela de itens + total logo abaixo."""
    flow = [_p(titulo, e["secao"])]
    if not itens:
        flow.append(_p(vazio, e["suave"]))
    else:
        linhas = [[_p("Descrição", e["cab"]), _p("Qtd", e["cab_dir"]), _p("Valor un.", e["cab_dir"]),
                   _p("Subtotal", e["cab_dir"])]]
        for item in itens:
            celula = [Paragraph(f"<b>{escape(item.get('descricao') or '')}</b>"
                                + (f" <font color='#6b6b6b'>· {escape(item['marca'])}</font>"
                                   if item.get("marca") else ""), e["base"])]
            if item.get("motivo"):
                celula.append(_p(item["motivo"], e["suave"]))
            linhas.append([celula, _p(qtd_txt(item.get("quantidade")), e["direita"]),
                           _p(brl(item.get("preco_unitario")), e["direita"]),
                           _p(brl(item.get("subtotal")), e["direita"])])
        tabela = Table(linhas, colWidths=[largura * 0.52, largura * 0.1, largura * 0.19, largura * 0.19],
                       repeatRows=1)
        tabela.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COR_TEXTO),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 1), (-1, -1), 0.4, COR_LINHA),
            ("TOPPADDING", (0, 0), (-1, -1), 3 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * k),
        ]))
        flow.append(tabela)
    flow += [Spacer(1, 3 * k), _p(f"{rotulo_total}  {brl(_soma(itens))}", e["subtotal"])]
    return flow


def _construir(dados: dict, k: float):
    """Monta o PDF com a escala `k`. Devolve (bytes, nº de páginas)."""
    e = _estilos(k)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=12 * mm * k + 2 * mm,
        bottomMargin=16 * mm,
        title=f"Orçamento {dados.get('os_num', '')} v{dados.get('versao', '')}",
        author=dados.get("oficina_nome") or "RevisaCar",
    )
    largura = A4[0] - 32 * mm
    flow = []

    # Cabeçalho
    cab = Table([[
        [_p(dados.get("oficina_nome") or "Oficina", e["titulo"]), _p("Orçamento de serviços", e["suave"])],
        [_p(rotulo_os(dados.get("os_num")), e["total"]),
         _p(f"Versão {dados.get('versao', 1)} · emitido em {data_hora_br(dados.get('emitido_em'))}",
            e["direita"])],
    ]], colWidths=[largura * 0.5, largura * 0.5])
    cab.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, 0), 1.2, COR_MARCA),
                             ("BOTTOMPADDING", (0, 0), (-1, 0), 6 * k), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                             ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    flow += [cab, Spacer(1, 4 * k)]

    status = dados.get("status") or ""
    flow.append(_p(STATUS_ROTULO.get(status, status), e["negrito"]))
    if dados.get("validade_ate") and status in ("enviado", "aprovado"):
        flow.append(_p(f"Válido até {data_br(dados['validade_ate'])}", e["suave"]))

    # Cliente e veículo
    c, v = dados.get("cliente") or {}, dados.get("veiculo") or {}
    linhas_cli = [_p(c.get("nome", ""), e["negrito"])]
    for rot, chave in (("Telefone", "tel"), ("CPF/CNPJ", "doc")):
        if c.get(chave):
            linhas_cli.append(_p(f"{rot}: {c[chave]}", e["base"]))
    detalhe_v = " · ".join(x for x in (v.get("modelo"), v.get("ano"), v.get("cor")) if x)
    linhas_vei = [_p(v.get("placa", ""), e["negrito"]), _p(detalhe_v, e["base"])]
    if v.get("km_saida"):
        linhas_vei.append(_p(f"KM de saída: {km_txt(v['km_saida'])}", e["base"]))
    flow.append(_p("CLIENTE E VEÍCULO", e["secao"]))
    dados_t = Table([[linhas_cli, linhas_vei]], colWidths=[largura / 2, largura / 2])
    dados_t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    flow.append(dados_t)

    # Itens: Peças e Serviços em seções separadas, cada uma com o seu total
    itens = dados.get("itens") or []
    pecas = [i for i in itens if i.get("tipo") == "peca"]
    servicos = [i for i in itens if i.get("tipo") != "peca"]
    flow += _secao_itens("PEÇAS", "Total de peças", "Nenhuma peça neste orçamento.", pecas, e, largura, k)
    flow += _secao_itens("SERVIÇOS", "Total de mão de obra", "Nenhum serviço neste orçamento.",
                         servicos, e, largura, k)

    # Total geral = peças + serviços
    total_geral = _soma(pecas) + _soma(servicos)
    linha_total = Table([[_p("TOTAL GERAL", e["negrito"]), _p(brl(total_geral), e["total"])]],
                        colWidths=[largura * 0.5, largura * 0.5])
    linha_total.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 1.2, COR_MARCA), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                     ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                     ("TOPPADDING", (0, 0), (-1, -1), 4 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow += [Spacer(1, 6 * k), linha_total]

    if dados.get("observacoes"):
        flow += [_p("OBSERVAÇÕES", e["secao"]), _p(dados["observacoes"], e["base"])]

    # Aprovação / assinatura
    apr = dados.get("aprovacao")
    assinatura = dados.get("assinatura_png")
    bloco = []
    if apr or assinatura:
        bloco.append(_p("APROVAÇÃO", e["secao"]))
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
        w = min(55 * mm * k, img.imageWidth)
        img.drawWidth, img.drawHeight = w, min(w * proporcao, 22 * mm * k)
        img.hAlign = "LEFT"
        bloco += [Spacer(1, 3 * k), img, _p("______________________________", e["base"]),
                  _p("Assinatura do cliente", e["suave"])]
    if bloco:
        flow.append(KeepTogether(bloco))

    def rodape(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(COR_SUAVE)
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
