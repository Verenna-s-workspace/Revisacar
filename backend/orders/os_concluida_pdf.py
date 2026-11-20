"""
PDF do relatório final da OS concluída.

Função pura (como `orcamento_pdf`): recebe um dict já "limpo" e devolve os bytes do PDF — não acessa
banco nem Storage. É um documento do CLIENTE: mostra só o preço cobrado. Custo, margem e vínculos
internos nunca entram.

Layout (referência: relatório em cartões — faixa de status, cliente | veículo, entrada e saída, fotos de
inspeção, parecer, peças e serviços, validação + caixa de totais), com a identidade da RevisaCar:
logo no canto superior esquerdo, vermelho #CC1400 e **somente DM Sans**.

Tipografia: 6 tamanhos e 3 pesos em todo o documento (Regular, Medium, Bold). Cinzas escuros, para
continuarem legíveis na impressão. A placa é a mesma dos componentes do app (ver `placa_pdf`).

SEMPRE uma única página A4: encolhe fontes e espaços aos poucos e, só se nem isso bastar, lista os
primeiros itens de cada seção e abrevia textos muito longos (os totais continuam completos).

dados = {
  oficina: {nome, cnpj, telefone, email, endereco},
  os_num, emitido_em (ISO), concluida_em (ISO|None), concluida_por, obs_conclusao,
  cliente: {nome, doc, tel, email},
  veiculo: {placa, modelo, ano, cor, chassi, combustivel, nivel_combustivel, km_entrada, km_saida},
  tecnico: {nome, registro}, entrada: {data, hora}, saida: {data, hora},
  fotos: [{rotulo, situacao: 'foto'|'pulada'|'pendente', motivo}],   # as 5 obrigatórias, em ordem
  fotos_extras: int,
  parecer,
  itens: [{tipo, descricao, marca, quantidade, preco_unitario, subtotal, motivo}],
  aprovacao: {em, canal, obs, versao} | None,
  assinatura_png: bytes | None,
}
"""
import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Flowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .orcamento_pdf import (
    CANAL_ROTULO, COR_MARCA, F_TXT, F_TXT_B, F_TXT_M, LOGO_PATH, _numero_os, _soma, brl, data_hora_br, doc_txt,
    km_txt, qtd_txt, rotulo_os, tel_txt,
)
from .placa_pdf import PlacaFlowable

# ── Tipografia: 6 tamanhos × 3 pesos ──────────────────────────────────────────
TAMANHOS = {"micro": 7.0, "peq": 8.0, "corpo": 9.0, "forte": 11.0, "titulo": 14.0, "destaque": 24.0}
PESOS = {"r": F_TXT, "m": F_TXT_M, "b": F_TXT_B}

# ── Cores (cinzas escuros: contraste alto, para sair bem na impressão) ────────
TINTA = colors.HexColor("#1A1A1A")
CINZA = colors.HexColor("#4A4A4A")      # texto secundário
ROTULO = colors.HexColor("#595959")     # rótulos dos campos (≈ 7:1 sobre branco)
FIO = colors.HexColor("#B9B6B0")
FUNDO = colors.HexColor("#F4F3F0")
ESCURO = colors.HexColor("#1A1D22")
VERDE = colors.HexColor("#1B6B34")
VERDE_FUNDO = colors.HexColor("#E7F4EA")
VERDE_BORDA = colors.HexColor("#9FD0AD")
ALERTA_FUNDO = colors.HexColor("#FDECE9")
ALERTA_BORDA = colors.HexColor("#EDB0A6")
SOBRE_ESCURO = colors.HexColor("#E3E3E3")

MARGEM = 14 * mm
LARGURA = A4[0] - 2 * MARGEM

# Escalas de fonte e, depois, limites de itens / tamanho dos textos livres (só em último caso).
# (escala da fonte, escala dos espaços): primeiro encolhe tudo um pouco; depois só os espaços, até o mínimo.
ESCALAS = ((1.0, 1.0), (0.96, 0.9), (0.92, 0.8), (0.88, 0.7), (0.88, 0.55), (0.88, 0.4))
ETAPAS_EXTREMAS = ((None, 800), (None, 500), (24, 600), (18, 400), (14, 300), (10, 240), (7, 200), (5, 160), (3, 120), (2, 100), (0, 80), (0, 40))


def data_hora_local(data, hora) -> str:
    """('2026-10-12', '08:30') → '12/10/2026 às 08:30'. Só data → só a data. Sem nada → ''. Sem conversão de
    fuso: data e hora da OS já são as do relógio da oficina."""
    data, hora = str(data or "").strip(), str(hora or "").strip()
    try:
        a, m, d = data[:10].split("-")
        data_txt = f"{d}/{m}/{a}"
    except ValueError:
        data_txt = data
    return f"{data_txt} às {hora}" if data_txt and hora else data_txt or hora


def _data_local(iso) -> str:
    """Só a data (dd/mm/aaaa) no fuso de Brasília — não usa a data UTC crua, que pode estar um dia adiantada."""
    return data_hora_br(iso)[:10]


def _titulo_oficina_contatos(oficina: dict) -> str:
    partes = [f"CNPJ {doc_txt(oficina.get('cnpj'))}" if oficina.get("cnpj") else "",
              tel_txt(oficina.get("telefone")), oficina.get("email") or "", oficina.get("endereco") or ""]
    return "  ·  ".join(p for p in partes if p)


class _Ctx:
    """Escala da versão em construção: `fk` (fontes), `sp` (espaços), `corte` (nº máx. de caracteres)."""

    def __init__(self, fk, sp, corte=None):
        self.fk, self.sp, self.corte = fk, sp, corte

    def tam(self, nome):
        return TAMANHOS[nome] * self.fk

    def esp(self, valor):
        return valor * self.sp

    def txt(self, valor, n=None):
        """Texto cru, abreviado (com "…") se passar do limite da etapa."""
        t = str(valor or "").strip()
        limite = min(x for x in (n, self.corte) if x) if (n or self.corte) else None
        return t if not limite or len(t) <= limite else t[: max(limite - 1, 1)].rstrip() + "…"

    def estilo(self, tam, peso="r", cor=TINTA, align=None, folga=1.28):
        t = self.tam(tam)
        return ParagraphStyle(f"{tam}{peso}{cor.hexval()}{align}", fontName=PESOS[peso], fontSize=t,
                              leading=t * folga, textColor=cor, alignment=align if align is not None else 0)

    def p(self, texto, tam="corpo", peso="r", cor=TINTA, align=None):
        return Paragraph(escape(str(texto or "")).replace("\n", "<br/>"), self.estilo(tam, peso, cor, align))

    def rico(self, marcado, tam="corpo", peso="r", cor=TINTA, align=None):
        """Parágrafo com marcação própria (<b>…</b>); o chamador escapa o que vem do banco."""
        return Paragraph(marcado, self.estilo(tam, peso, cor, align))


def _sem_margem(extra=()):
    return TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                       ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), *extra])


class _IconeOk(Flowable):
    """Bolinha verde com "check" (faixa de OS concluída)."""

    def __init__(self, d):
        super().__init__()
        self.d = d

    def wrap(self, w, h):
        return self.d, self.d

    def draw(self):
        c, d = self.canv, self.d
        c.setFillColor(VERDE)
        c.circle(d / 2, d / 2, d / 2, stroke=0, fill=1)
        c.setStrokeColor(colors.white)
        c.setLineWidth(d * 0.12)
        c.setLineCap(1)
        c.setLineJoin(1)
        c.lines([(d * 0.28, d * 0.5, d * 0.44, d * 0.34), (d * 0.44, d * 0.34, d * 0.73, d * 0.66)])


def _cartao(ctx, conteudo, largura, fundo=colors.white, borda=FIO, pad=7, altura=None):
    """Cartão de cantos arredondados em volta de `conteudo` (lista de flowables)."""
    p = ctx.esp(pad)
    t = Table([[conteudo]], colWidths=[largura], rowHeights=[altura] if altura else None)
    t.setStyle(TableStyle([
        ("ROUNDEDCORNERS", [4, 4, 4, 4]), ("BACKGROUND", (0, 0), (-1, -1), fundo),
        ("BOX", (0, 0), (-1, -1), 0.6, borda) if borda else ("BOX", (0, 0), (-1, -1), 0, fundo),
        ("LEFTPADDING", (0, 0), (-1, -1), p), ("RIGHTPADDING", (0, 0), (-1, -1), p),
        ("TOPPADDING", (0, 0), (-1, -1), p * 0.85), ("BOTTOMPADDING", (0, 0), (-1, -1), p * 0.85),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _campos(ctx, linhas, largura, colunas):
    """Grade de campos "rótulo em cima, valor embaixo". Linha com 1 campo ocupa a largura toda;
    `linhas`: [[(rótulo, valor, colspan?)...]]."""
    col = largura / colunas
    dados, estilo = [], [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                         ("RIGHTPADDING", (0, 0), (-1, -1), ctx.esp(6)), ("TOPPADDING", (0, 0), (-1, -1), 0),
                         ("BOTTOMPADDING", (0, 0), (-1, -1), ctx.esp(4))]
    for r, linha in enumerate(linhas):
        celulas, c = [], 0
        for campo in linha:
            rot, val = campo[0], campo[1]
            span = campo[2] if len(campo) > 2 else 1
            celulas.append([ctx.p(rot, "micro", "r", ROTULO), ctx.p(val or "—", "corpo", "m")])
            celulas += [""] * (span - 1)
            if span > 1:
                estilo.append(("SPAN", (c, r), (c + span - 1, r)))
            c += span
        celulas += [""] * (colunas - len(celulas))
        dados.append(celulas)
    t = Table(dados, colWidths=[col] * colunas)
    t.setStyle(TableStyle(estilo))
    return t


def _titulo(ctx, texto, direita=None):
    """Título de seção (Bold, tamanho "forte"); `direita`: texto de apoio alinhado à direita."""
    esq = ctx.p(texto, "forte", "b")
    if direita is None:
        return esq
    t = Table([[esq, direita]], colWidths=[LARGURA * 0.45, LARGURA * 0.55])
    t.setStyle(_sem_margem([("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))
    return t


def _cabecalho(ctx, dados, oficina):
    nome = Table([["", "", [ctx.p(ctx.txt(oficina.get("nome") or "Oficina", 60), "titulo", "b"),
                           ctx.p(f"CNPJ {doc_txt(oficina['cnpj'])}" if oficina.get("cnpj") else "Relatório final da OS",
                                 "micro", "m", CINZA)]]],
                 colWidths=[ctx.esp(2.6), ctx.esp(6), LARGURA * 0.58 - ctx.esp(8.6)])
    nome.setStyle(_sem_margem([("BACKGROUND", (0, 0), (0, 0), COR_MARCA), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    esquerda = []
    try:
        alt = 4.3 * mm * max(ctx.sp, 0.8)  # logo pequena, no canto superior esquerdo (mesmo lugar de sempre)
        logo = Image(LOGO_PATH, width=alt * 600 / 496, height=alt)
        logo.hAlign = "LEFT"
        esquerda += [logo, Spacer(1, ctx.esp(3))]
    except Exception:  # noqa: BLE001 — sem a logo o PDF sai do mesmo jeito
        pass
    esquerda.append(nome)
    num = ctx.txt(_numero_os(dados.get("os_num")), 20)
    direita = [ctx.p("Relatório final · Ordem de serviço", "peq", "m", CINZA, TA_RIGHT),
               ctx.rico(f"<font name='{F_TXT_B}' size='{ctx.tam('forte'):.2f}'>Nº</font> {escape(num)}",
                        "destaque", "b", TINTA, TA_RIGHT)]
    cab = Table([[esquerda, direita]], colWidths=[LARGURA * 0.58, LARGURA * 0.42])
    cab.setStyle(_sem_margem([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LINEBELOW", (0, 0), (-1, 0), 0.8, TINTA),
                              ("BOTTOMPADDING", (0, 0), (-1, 0), ctx.esp(6))]))
    flow = [cab]
    contatos = _titulo_oficina_contatos({**oficina, "cnpj": None})
    if contatos:
        flow += [Spacer(1, ctx.esp(3)), ctx.p(ctx.txt(contatos, 160), "micro", "r", CINZA)]
    return flow


def _faixa_status(ctx, dados):
    concluida = data_hora_br(dados.get("concluida_em"))
    quem = f" por {ctx.txt(dados['concluida_por'], 40)}" if dados.get("concluida_por") else ""
    esq = (f"<b>Serviço concluído</b>{' em ' + escape(concluida) if concluida else ''}{escape(quem)}")
    emitido = data_hora_br(dados.get("emitido_em"), segundos=True)
    t = Table([[_IconeOk(ctx.esp(11)), ctx.rico(esq, "peq", "r", TINTA),
                ctx.p(f"Relatório emitido em {emitido}" if emitido else "", "peq", "r", TINTA, TA_RIGHT)]],
              colWidths=[ctx.esp(9) + ctx.esp(11) + ctx.esp(6), LARGURA * 0.58 - ctx.esp(26), LARGURA * 0.42 + ctx.esp(26) - ctx.esp(26)])
    t.setStyle(TableStyle([
        ("ROUNDEDCORNERS", [4, 4, 4, 4]), ("BACKGROUND", (0, 0), (-1, -1), VERDE_FUNDO),
        ("BOX", (0, 0), (-1, -1), 0.6, VERDE_BORDA), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), ctx.esp(9)), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (-1, -1), 0), ("RIGHTPADDING", (-1, 0), (-1, 0), ctx.esp(9)),
        ("TOPPADDING", (0, 0), (-1, -1), ctx.esp(6)), ("BOTTOMPADDING", (0, 0), (-1, -1), ctx.esp(6)),
    ]))
    return t


def _cliente_veiculo(ctx, dados):
    c, v = dados.get("cliente") or {}, dados.get("veiculo") or {}
    gap = ctx.esp(9)
    col = (LARGURA - gap) / 2
    interno = col - 2 * ctx.esp(7)
    cartao_cli = _cartao(ctx, [
        ctx.p("Cliente", "peq", "m", ROTULO), Spacer(1, ctx.esp(1)),
        ctx.p(ctx.txt(c.get("nome"), 60) or "—", "titulo", "b"), Spacer(1, ctx.esp(5)),
        _campos(ctx, [[("CPF / CNPJ", doc_txt(c.get("doc"))), ("Telefone", tel_txt(c.get("tel")))],
                      [("E-mail", ctx.txt(c.get("email"), 60), 2)]], interno, 2),
    ], col)
    placa = str(v.get("placa") or "").strip()
    if placa:
        px = ctx.fk * 0.9
        # os tamanhos de texto da placa são os da escala do documento: "forte" no número e "micro" na faixa
        sel = PlacaFlowable(placa, px, F_TXT_M, ctx.tam("forte"), ctx.tam("micro"))
    else:
        sel = ctx.p("Placa —", "peq", "m", ROTULO, TA_RIGHT)
    larg_placa = 73 * ctx.fk * 0.9 + 2
    topo = Table([[[ctx.p("Veículo", "peq", "m", ROTULO), Spacer(1, ctx.esp(1)),
                    ctx.p(ctx.txt(v.get("modelo"), 50) or "—", "titulo", "b")], sel]],
                 colWidths=[interno - larg_placa - 4, larg_placa + 4])
    topo.setStyle(_sem_margem([("VALIGN", (0, 0), (0, 0), "TOP"), ("VALIGN", (1, 0), (1, 0), "TOP"),
                               ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
    cartao_vei = _cartao(ctx, [
        topo, Spacer(1, ctx.esp(5)),
        _campos(ctx, [[("Ano", v.get("ano")), ("Cor", ctx.txt(v.get("cor"), 20)),
                       ("Combustível", ctx.txt(v.get("combustivel"), 20))],
                      [("Chassi", ctx.txt(v.get("chassi"), 24), 2), ("Nível do tanque", v.get("nivel_combustivel"))]],
                interno, 3),
    ], col)
    t = Table([[cartao_cli, "", cartao_vei]], colWidths=[col, gap, col])
    t.setStyle(_sem_margem([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return t


def _entrada_saida(ctx, dados):
    v, t = dados.get("veiculo") or {}, dados.get("tecnico") or {}
    ent, sai = dados.get("entrada") or {}, dados.get("saida") or {}
    larg = LARGURA / 3

    def celula(rot, valor, apoio):
        return [ctx.p(rot, "micro", "r", ROTULO), Spacer(1, ctx.esp(1.5)),
                ctx.p(valor or "—", "forte", "b"), Spacer(1, ctx.esp(1.5)), ctx.p(apoio, "peq", "r", CINZA)]
    km_e, km_s = km_txt(v.get("km_entrada")), km_txt(v.get("km_saida"))
    reg = f"Registro {ctx.txt(t['registro'], 20)}" if t.get("registro") else " "
    tab = Table([[celula("Entrada do veículo", data_hora_local(ent.get("data"), ent.get("hora")),
                         f"Hodômetro em {km_e}" if km_e else "Hodômetro não informado"),
                  celula("Técnico responsável", ctx.txt(t.get("nome"), 40), reg),
                  celula("Saída do veículo", data_hora_local(sai.get("data"), sai.get("hora")),
                         f"Hodômetro em {km_s}" if km_s else "Hodômetro não informado")]],
                colWidths=[larg] * 3)
    p = ctx.esp(8)
    tab.setStyle(TableStyle([
        ("ROUNDEDCORNERS", [4, 4, 4, 4]), ("BOX", (0, 0), (-1, -1), 0.6, FIO),
        ("LINEAFTER", (0, 0), (1, 0), 0.6, FIO), ("BACKGROUND", (1, 0), (1, 0), FUNDO),
        ("LEFTPADDING", (0, 0), (-1, -1), p), ("RIGHTPADDING", (0, 0), (-1, -1), p),
        ("TOPPADDING", (0, 0), (-1, -1), p * 0.8), ("BOTTOMPADDING", (0, 0), (-1, -1), p * 0.8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return tab


def _fotos(ctx, dados):
    fotos = dados.get("fotos") or []
    total = len(fotos)
    anexadas = sum(1 for f in fotos if f.get("situacao") == "foto")
    if not total:
        resumo, cor = "Nenhuma foto obrigatória configurada", CINZA
    elif anexadas == total:
        resumo, cor = f"Todas as {total} fotos obrigatórias foram anexadas", VERDE
    elif anexadas == 0:
        resumo, cor = f"Nenhuma das {total} fotos obrigatórias foi anexada", COR_MARCA
    else:
        resumo, cor = f"{total - anexadas} de {total} fotos obrigatórias não foram anexadas", COR_MARCA
    contador = f"<font name='{F_TXT_B}'>{anexadas}/{total}</font>  ·  {escape(resumo)}" if total else escape(resumo)
    flow = [_titulo(ctx, "Fotos de inspeção", ctx.rico(contador, "peq", "m", cor, TA_RIGHT)), Spacer(1, ctx.esp(4))]
    if total:
        gap = ctx.esp(5)
        larg = (LARGURA - gap * (total - 1)) / total
        interno = larg - 2 * ctx.esp(6)
        conteudos = []
        for f in fotos:
            ok = f.get("situacao") == "foto"
            c = [ctx.p(ctx.txt(f.get("rotulo"), 30), "corpo", "b"), Spacer(1, ctx.esp(1)),
                 ctx.p("Anexada" if ok else "Não anexada", "peq", "b", VERDE if ok else COR_MARCA)]
            if not ok:
                motivo = ctx.txt(f.get("motivo"), 120)
                t = Table([[""], [ctx.p(motivo or "Nenhum motivo informado", "peq", "r", TINTA if motivo else CINZA)]],
                          colWidths=[interno])
                t.setStyle(_sem_margem([("LINEBELOW", (0, 0), (0, 0), 0.5, ALERTA_BORDA),
                                        ("TOPPADDING", (0, 1), (0, 1), ctx.esp(3)),
                                        ("TOPPADDING", (0, 0), (0, 0), ctx.esp(2))]))
                c += [t]
            conteudos.append((ok, c))
        # mesma altura em todos os cartões
        alturas = [_cartao(ctx, c, larg, pad=6).wrap(larg, 10_000)[1] for _, c in conteudos]
        cartoes, linha = [], []
        for i, (ok, c) in enumerate(conteudos):
            cartoes.append(_cartao(ctx, c, larg, fundo=colors.white if ok else ALERTA_FUNDO,
                                   borda=FIO if ok else ALERTA_BORDA, pad=6, altura=max(alturas)))
        for i, cart in enumerate(cartoes):
            linha.append(cart)
            if i < total - 1:
                linha.append("")
        tab = Table([linha], colWidths=[x for i in range(total) for x in ([larg] + ([gap] if i < total - 1 else []))])
        tab.setStyle(_sem_margem([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        flow.append(tab)
    if dados.get("fotos_extras"):
        flow += [Spacer(1, ctx.esp(3)), ctx.p(f"Fotos adicionais registradas na OS: {dados['fotos_extras']}.",
                                              "micro", "r", CINZA)]
    return flow


def _parecer(ctx, dados):
    parecer = ctx.txt(dados.get("parecer"))
    corpo = [ctx.p(parecer, "corpo", "r", TINTA) if parecer else
             ctx.p("Nenhum parecer foi registrado.", "corpo", "r", CINZA)]
    if dados.get("obs_conclusao"):
        corpo += [Spacer(1, ctx.esp(3)),
                  ctx.p(f"Observação na conclusão: {ctx.txt(dados['obs_conclusao'])}", "peq", "r", CINZA)]
    return [_titulo(ctx, "Parecer do mecânico"), Spacer(1, ctx.esp(4)),
            _cartao(ctx, corpo, LARGURA, fundo=FUNDO, borda=None, pad=8)]


def _tabela_itens(ctx, pecas, servicos, versao, limite):
    colw = [LARGURA * 0.56, LARGURA * 0.08, LARGURA * 0.18, LARGURA * 0.18]
    cab_estilo = lambda al: ctx.estilo("micro", "m", ROTULO, al)  # noqa: E731
    linhas = [[Paragraph("Descrição", cab_estilo(0)), Paragraph("Qtd", cab_estilo(TA_CENTER)),
               Paragraph("Valor unit.", cab_estilo(TA_RIGHT)), Paragraph("Subtotal", cab_estilo(TA_RIGHT))]]
    estilo = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
              ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), ctx.esp(3)),
              ("BOTTOMPADDING", (0, 0), (-1, -1), ctx.esp(3)), ("LINEBELOW", (0, 0), (-1, 0), 0.8, TINTA)]

    def grupo(titulo, itens, vazio):
        nonlocal linhas
        linhas.append([ctx.p(titulo, "peq", "b", CINZA), "", "", ""])
        estilo.append(("SPAN", (0, len(linhas) - 1), (-1, len(linhas) - 1)))
        estilo.append(("BACKGROUND", (0, len(linhas) - 1), (-1, len(linhas) - 1), FUNDO))
        if not itens:
            linhas.append([ctx.p(vazio, "peq", "r", CINZA), "", "", ""])
            estilo.append(("SPAN", (0, len(linhas) - 1), (-1, len(linhas) - 1)))
            return
        mostrados = itens if limite is None else itens[:limite]
        for item in mostrados:
            desc = f"<font name='{F_TXT_M}'>{escape(ctx.txt(item.get('descricao'), 120))}</font>"
            if item.get("marca"):
                desc += f" <font color='#4A4A4A'>· {escape(ctx.txt(item['marca'], 30))}</font>"
            celula = [ctx.rico(desc, "corpo")]
            if item.get("motivo"):
                celula.append(ctx.p(f"Obs.: {ctx.txt(item['motivo'], 140)}", "peq", "r", CINZA))
            linhas.append([celula, ctx.p(qtd_txt(item.get("quantidade")), "corpo", "r", TINTA, TA_CENTER),
                           ctx.p(brl(item.get("preco_unitario")), "corpo", "r", TINTA, TA_RIGHT),
                           ctx.p(brl(item.get("subtotal")), "corpo", "m", TINTA, TA_RIGHT)])
            estilo.append(("LINEBELOW", (0, len(linhas) - 1), (-1, len(linhas) - 1), 0.4, FIO))
        ocultos = len(itens) - len(mostrados)
        if ocultos:
            linhas.append([ctx.p(f"+ {ocultos} item(ns) não listado(s) por falta de espaço — veja o orçamento aprovado.",
                                 "peq", "r", CINZA), "", "", ""])
            estilo.append(("SPAN", (0, len(linhas) - 1), (-1, len(linhas) - 1)))

    grupo("Peças substituídas", pecas, "Nenhuma peça foi substituída.")
    grupo("Serviços executados", servicos, "Nenhum serviço registrado.")
    t = Table(linhas, colWidths=colw)
    t.setStyle(TableStyle(estilo))
    return [_titulo(ctx, "Peças e serviços",
                    ctx.p(f"Orçamento v{versao}" if versao else "", "peq", "m", CINZA, TA_RIGHT)),
            Spacer(1, ctx.esp(3)), t]


def _assinaturas(ctx, dados, largura):
    c, t = dados.get("cliente") or {}, dados.get("tecnico") or {}
    gap = ctx.esp(14)
    col = (largura - gap) / 2
    alt = ctx.esp(26)
    topo_cli = ""
    png = dados.get("assinatura_png")
    if png and dados.get("aprovacao"):
        try:
            img = Image(io.BytesIO(png))
            prop = img.imageHeight / float(img.imageWidth or 1)
            w = min(col * 0.8, img.imageWidth, (alt - 2) / (prop or 1))
            img.drawWidth, img.drawHeight = w, w * prop
            img.hAlign = "CENTER"
            topo_cli = img
        except Exception:  # noqa: BLE001 — assinatura ilegível não pode derrubar o relatório
            topo_cli = ""
    tab = Table([["", "", topo_cli],
                 [[ctx.p(ctx.txt(t.get("nome"), 40) or "—", "peq", "b"), ctx.p("Técnico responsável", "micro", "r", ROTULO)],
                  "", [ctx.p(ctx.txt(c.get("nome"), 40) or "—", "peq", "b"), ctx.p("Cliente", "micro", "r", ROTULO)]]],
                colWidths=[col, gap, col], rowHeights=[alt, None])
    tab.setStyle(_sem_margem([("VALIGN", (0, 0), (-1, 0), "BOTTOM"), ("VALIGN", (0, 1), (-1, 1), "TOP"),
                              ("LINEABOVE", (0, 1), (0, 1), 0.7, TINTA), ("LINEABOVE", (2, 1), (2, 1), 0.7, TINTA),
                              ("TOPPADDING", (0, 1), (-1, 1), ctx.esp(2.5))]))
    return tab


def _rodape_da_pagina(oficina, os_num):
    def desenhar(canvas, doc_):
        canvas.saveState()
        canvas.setFillColor(COR_MARCA)  # fio vermelho no topo, como no cabeçalho de referência
        canvas.rect(0, A4[1] - 3, A4[0], 3, stroke=0, fill=1)
        canvas.setStrokeColor(FIO)
        canvas.setLineWidth(0.5)
        canvas.line(MARGEM, 12.5 * mm, A4[0] - MARGEM, 12.5 * mm)
        canvas.setFillColor(CINZA)
        canvas.setFont(F_TXT_M, TAMANHOS["micro"])
        canvas.drawString(MARGEM, 8.8 * mm, f"{oficina.get('nome') or ''} · {rotulo_os(os_num)} · relatório final")
        canvas.drawRightString(A4[0] - MARGEM, 8.8 * mm, f"Página {doc_.page} de 1")
        canvas.restoreState()
    return desenhar


def _construir(dados: dict, fk: float, sp: float, limite, corte):
    """Monta o PDF com fontes na escala `fk` e espaços na escala `sp`. Devolve (bytes, nº de páginas)."""
    ctx = _Ctx(fk, sp, corte)
    oficina = dados.get("oficina") or {}
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        # o Frame do reportlab tem 6 pt de padding: compensa para tudo alinhar em MARGEM
        buf, pagesize=A4, leftMargin=MARGEM - 6, rightMargin=MARGEM - 6, topMargin=9 * mm * ctx.sp + 3,
        bottomMargin=16 * mm, title=f"Relatório final da OS {dados.get('os_num', '')}",
        author=oficina.get("nome") or "RevisaCar",
    )
    entre = ctx.esp(10)
    flow = [*_cabecalho(ctx, dados, oficina), Spacer(1, ctx.esp(7)), _faixa_status(ctx, dados), Spacer(1, ctx.esp(8)),
            _cliente_veiculo(ctx, dados), Spacer(1, entre),
            _titulo(ctx, "Entrada e saída"), Spacer(1, ctx.esp(4)), _entrada_saida(ctx, dados), Spacer(1, entre),
            *_fotos(ctx, dados), Spacer(1, entre), *_parecer(ctx, dados), Spacer(1, entre)]

    itens = dados.get("itens") or []
    pecas = [i for i in itens if i.get("tipo") == "peca"]
    servicos = [i for i in itens if i.get("tipo") != "peca"]
    apr = dados.get("aprovacao") or {}
    flow += _tabela_itens(ctx, pecas, servicos, apr.get("versao"), limite)
    flow.append(Spacer(1, ctx.esp(10)))

    # Validação do cliente + assinaturas (esquerda) | totais (direita)
    gap = ctx.esp(14)
    larg_dir = LARGURA * 0.38
    larg_esq = LARGURA - larg_dir - gap
    if apr.get("em"):
        canal = CANAL_ROTULO.get(apr.get("canal"), apr.get("canal") or "")
        esq = [ctx.rico(f"<font name='{F_TXT_B}'>Orçamento aprovado pelo cliente</font> "
                        f"{'via ' + escape(canal) + ' ' if canal else ''}em {_data_local(apr['em'])}.", "peq", "r", TINTA)]
        esq.append(ctx.p((f"Versão {apr['versao']}, registrada em " if apr.get("versao") else "Registrada em ")
                          + data_hora_br(apr["em"]) + ".", "peq", "r", CINZA))
        if apr.get("obs"):
            esq.append(ctx.p(ctx.txt(apr["obs"]), "peq", "r", CINZA))
    else:
        esq = [ctx.p("Não há registro de aprovação do cliente para esta OS.", "peq", "r", CINZA)]
    esq += [Spacer(1, ctx.esp(4)), _assinaturas(ctx, dados, larg_esq)]

    total_pecas, total_mao = _soma(pecas), _soma(servicos)
    interno_dir = larg_dir - 2 * ctx.esp(10)
    linhas_totais = [
        [ctx.p("Peças", "peq", "r", SOBRE_ESCURO), ctx.p(brl(total_pecas), "peq", "m", colors.white, TA_RIGHT)],
        [ctx.p("Mão de obra", "peq", "r", SOBRE_ESCURO), ctx.p(brl(total_mao), "peq", "m", colors.white, TA_RIGHT)],
        [ctx.p("Total geral", "peq", "m", SOBRE_ESCURO), ""],
        [ctx.p(brl(total_pecas + total_mao), "destaque", "b", colors.white, TA_RIGHT), ""],
    ]
    caixa = Table(linhas_totais, colWidths=[larg_dir * 0.45, larg_dir * 0.55])
    pad = ctx.esp(10)
    caixa.setStyle(TableStyle([
        ("ROUNDEDCORNERS", [4, 4, 4, 4]), ("BACKGROUND", (0, 0), (-1, -1), ESCURO),
        ("LEFTPADDING", (0, 0), (-1, -1), pad), ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), ctx.esp(2.5)), ("BOTTOMPADDING", (0, 0), (-1, -1), ctx.esp(2.5)),
        ("TOPPADDING", (0, 0), (-1, 0), pad), ("BOTTOMPADDING", (0, -1), (-1, -1), pad),
        ("SPAN", (0, 2), (1, 2)), ("SPAN", (0, 3), (1, 3)), ("TOPPADDING", (0, 2), (-1, 2), ctx.esp(8)),
        ("BOTTOMPADDING", (0, 2), (-1, 2), 0), ("TOPPADDING", (0, 3), (-1, 3), 0),
        ("LINEABOVE", (0, 2), (-1, 2), 0.5, colors.Color(1, 1, 1, 0.35)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    inferior = Table([[esq, "", caixa]], colWidths=[larg_esq, gap, larg_dir])
    inferior.setStyle(_sem_margem([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    flow.append(inferior)

    rodape = _rodape_da_pagina(oficina, dados.get("os_num"))
    # fonte inicial do canvas = DM Sans (senão o reportlab deixa uma referência à Helvetica no arquivo)
    def canvas(*args, **kw):
        kw.update(initialFontName=F_TXT, initialFontSize=TAMANHOS["corpo"])
        return Canvas(*args, **kw)

    doc.build(flow, onFirstPage=rodape, onLaterPages=rodape, canvasmaker=canvas)
    return buf.getvalue(), doc.page


def gerar_pdf(dados: dict) -> bytes:
    """Relatório final em UMA página A4: tenta o tamanho normal, depois encolhe fontes e espaços e, em
    último caso (OS com dezenas de itens ou textos enormes), lista só os primeiros itens de cada seção e
    abrevia os textos livres. Os totais são sempre os de TODOS os itens."""
    conteudo = b""
    for fk, sp in ESCALAS:
        conteudo, paginas = _construir(dados, fk, sp, None, None)
        if paginas <= 1:
            return conteudo
    for limite, corte in ETAPAS_EXTREMAS:
        conteudo, paginas = _construir(dados, *ESCALAS[-1], limite, corte)
        if paginas <= 1:
            break
    return conteudo
