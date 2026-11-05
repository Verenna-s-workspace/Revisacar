"""
PDF do relatório final da OS concluída.

Função pura (como `orcamento_pdf`): recebe um dict já "limpo" e devolve os bytes do PDF — não acessa
banco nem Storage. Reaproveita o visual do PDF do orçamento (cores, fontes, logo, cabeçalho, rodapé,
tabelas de itens) e SEMPRE cabe em uma única página A4: encolhe fontes/espaços aos poucos e, só se
nem a menor escala couber, lista só os primeiros itens de cada seção (os totais continuam completos).

É um documento do CLIENTE: mostra só o preço cobrado. Custo, margem e vínculos internos nunca entram.

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

from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .orcamento_pdf import (
    CANAL_ROTULO, COR_FIO, COR_MARCA, COR_TEXTO, F_MONO_M, F_TXT_B,
    TituloSecao, _bloco_campos, _estilos, _numero_os, _p, _secao_itens, _soma, brl, cabecalho_pdf, data_hora_br,
    doc_txt, km_txt, rodape_pdf, rotulo_os, tel_txt,
)

# Escalas tentadas até caber em uma página (1.0 = tamanho normal) e, depois, os limites de itens por seção.
ESCALAS = (1.0, 0.94, 0.88, 0.82, 0.76, 0.7)
LIMITES_DE_ITENS = (30, 22, 16, 12, 8)
ESCALA_MINIMA = ESCALAS[-1]


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


def _grade(campos, colunas, largura, e, k, folga=0.0):
    """Campos "rótulo em cima, valor embaixo" em `colunas` colunas, com fio fino entre as linhas.
    `folga`: espaço vazio entre uma coluna e a próxima."""
    col = (largura - folga * (colunas - 1)) / colunas
    larguras = []
    for c in range(colunas):
        larguras.append(col)
        if c < colunas - 1:
            larguras.append(folga)
    dados = []
    for i in range(0, len(campos), colunas):
        linha = campos[i:i + colunas]
        celulas = []
        for c in range(colunas):
            rot, val = linha[c] if c < len(linha) else ("", "")
            celulas.append([_p(rot.upper(), e["rotulo"]), _p((val or "—") if rot else "", e["valor"])])
            if c < colunas - 1:
                celulas.append("")
        dados.append(celulas)
    tabela = Table(dados, colWidths=larguras)
    tabela.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * k),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.5, COR_FIO),
    ]))
    return tabela


def _bloco_fotos(fotos, extras, largura, e, k):
    """Contador 3/5 + um quadrinho por foto obrigatória (anexada / ausente) + motivo de cada ausente."""
    anexadas = sum(1 for f in fotos if f.get("situacao") == "foto")
    total = len(fotos)
    completo = anexadas == total
    estilo_n = ParagraphStyle("contador", parent=e["base"], fontName=F_TXT_B, fontSize=17 * k, leading=19 * k,
                              textColor=COR_TEXTO if completo else COR_MARCA)
    estilo_chip = ParagraphStyle("chip", parent=e["rotulo"], fontName=F_MONO_M, fontSize=6.2 * k, leading=8 * k,
                                 textColor=COR_TEXTO)
    estilo_ok = ParagraphStyle("chip_ok", parent=e["rotulo"], fontSize=5.6 * k, leading=7.4 * k)
    estilo_falta = ParagraphStyle("chip_falta", parent=estilo_ok, textColor=COR_MARCA, fontName=F_MONO_M)

    contador = Table([[_p(f"{anexadas}/{total}", estilo_n)], [_p("FOTOS OBRIGATÓRIAS ANEXADAS", e["rotulo"])]],
                     colWidths=[largura * 0.2])
    contador.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                                  ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    chips, estilo_tabela = [contador], [
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    larg_chip = (largura * 0.8) / max(total, 1)
    for i, f in enumerate(fotos, start=1):
        ok = f.get("situacao") == "foto"
        chips.append([_p(f["rotulo"].upper(), estilo_chip), _p("ANEXADA" if ok else "AUSENTE",
                                                              estilo_ok if ok else estilo_falta)])
        estilo_tabela += [("LINEABOVE", (i, 0), (i, 0), 1.6, COR_TEXTO if ok else COR_MARCA),
                          ("LEFTPADDING", (i, 0), (i, 0), 0), ("RIGHTPADDING", (i, 0), (i, 0), 5 * k),
                          ("TOPPADDING", (i, 0), (i, 0), 2.5 * k)]
    linha = Table([chips], colWidths=[largura * 0.2] + [larg_chip] * total)
    linha.setStyle(TableStyle(estilo_tabela))

    flow = [linha]
    ausentes = [f for f in fotos if f.get("situacao") != "foto"]
    if ausentes:
        flow.append(Spacer(1, 4 * k))
        for f in ausentes:
            motivo = (f.get("motivo") or "").strip()
            texto = (f"<font name='{F_TXT_B}'>{escape(f['rotulo'])}</font> — não anexada. "
                     + (f"Motivo informado pelo mecânico: “{escape(motivo)}”." if motivo
                        else "Nenhum motivo foi informado."))
            flow.append(Paragraph(texto, e["base"]))
    elif total:
        flow += [Spacer(1, 3 * k), _p(f"Todas as {total} fotos obrigatórias foram anexadas.", e["suave"])]
    if extras:
        flow += [Spacer(1, 2 * k), _p(f"Fotos adicionais registradas na OS: {extras}.", e["suave"])]
    return flow


def _construir(dados: dict, k: float, limite):
    e = _estilos(k)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=16 * mm - 6, rightMargin=16 * mm - 6, topMargin=12 * mm * k + 2 * mm,
        bottomMargin=16 * mm, title=f"Relatório final da OS {dados.get('os_num', '')}",
        author=(dados.get("oficina") or {}).get("nome") or "RevisaCar",
    )
    largura = A4[0] - 32 * mm
    oficina = dados.get("oficina") or {}
    flow = []

    flow += [cabecalho_pdf(oficina.get("nome") or "Oficina", "RELATÓRIO FINAL DA OS", [
        _p(f"OS Nº {_numero_os(dados.get('os_num'))}", e["os"]),
        _p(f"Orçamento aprovado v{(dados.get('aprovacao') or {}).get('versao')}"
           if (dados.get("aprovacao") or {}).get("versao") else "Relatório de encerramento", e["meta"]),
        _p(f"Emitido em {data_hora_br(dados.get('emitido_em'), segundos=True)}", e["meta"]),
    ], largura, e, k), Spacer(1, 4 * k)]

    contatos = _titulo_oficina_contatos(oficina)
    if contatos:
        flow.append(_p(contatos, e["suave"]))
    concluida = data_hora_br(dados.get("concluida_em"))
    quem = f" · por {dados['concluida_por']}" if dados.get("concluida_por") else ""
    faixa = Table([[_p("OS CONCLUÍDA", e["negrito"]),
                    _p(f"Concluída em {concluida}{quem}" if concluida else "", e["direita"])]],
                  colWidths=[largura * 0.3, largura * 0.7])
    faixa.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                               ("TOPPADDING", (0, 0), (-1, -1), 4 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow += [faixa, Spacer(1, 7 * k)]

    # ── Ficha de entrada e saída ──────────────────────────────────────────────
    c, v = dados.get("cliente") or {}, dados.get("veiculo") or {}
    t, ent, sai = dados.get("tecnico") or {}, dados.get("entrada") or {}, dados.get("saida") or {}
    folga = 20 * k
    col = (largura - folga) / 2
    col_cli = [TituloSecao("Cliente", k), Spacer(1, 3 * k), _bloco_campos([
        [("Nome", c.get("nome"))],
        [("CPF / CNPJ", doc_txt(c.get("doc"))), ("Telefone", tel_txt(c.get("tel")))],
        [("E-mail", c.get("email"))],
    ], col, e, k)]
    col_vei = [TituloSecao("Veículo", k), Spacer(1, 3 * k), _bloco_campos([
        [("Placa", v.get("placa")), ("Ano", v.get("ano"))],
        [("Modelo", v.get("modelo")), ("Cor", v.get("cor"))],
        [("Chassi", v.get("chassi"))],
        [("Combustível", v.get("combustivel")), ("Nível do tanque", v.get("nivel_combustivel"))],
    ], col, e, k)]
    dados_t = Table([[col_cli, "", col_vei]], colWidths=[col, folga, col])
    dados_t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                 ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                                 ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow.append(dados_t)

    tecnico = " · ".join(x for x in (t.get("nome"), f"Reg. {t['registro']}" if t.get("registro") else "") if x)
    flow += [Spacer(1, 8 * k), TituloSecao("Entrada e saída", k), Spacer(1, 3 * k), _grade([
        ("Técnico responsável", tecnico), ("KM de entrada", km_txt(v.get("km_entrada"))),
        ("Entrada do veículo", data_hora_local(ent.get("data"), ent.get("hora"))),
        ("Concluída em", concluida), ("KM de saída", km_txt(v.get("km_saida"))),
        ("Saída do veículo", data_hora_local(sai.get("data"), sai.get("hora"))),
    ], 3, largura, e, k, folga=14 * k)]

    # ── Inspeção fotográfica ──────────────────────────────────────────────────
    flow += [Spacer(1, 8 * k), TituloSecao("Inspeção fotográfica obrigatória", k), Spacer(1, 4 * k)]
    flow += _bloco_fotos(dados.get("fotos") or [], dados.get("fotos_extras") or 0, largura, e, k)

    # ── Parecer ───────────────────────────────────────────────────────────────
    flow += [Spacer(1, 8 * k), TituloSecao("Parecer geral do mecânico", k), Spacer(1, 3 * k),
             _p(dados.get("parecer") or "Nenhum parecer foi registrado.", e["texto_livre"] if dados.get("parecer")
                else e["suave"])]
    if dados.get("obs_conclusao"):
        flow += [Spacer(1, 2 * k), _p(f"Observação na conclusão: {dados['obs_conclusao']}", e["suave"])]

    # ── Peças e serviços ──────────────────────────────────────────────────────
    itens = dados.get("itens") or []
    pecas = [i for i in itens if i.get("tipo") == "peca"]
    servicos = [i for i in itens if i.get("tipo") != "peca"]
    flow += _secao_itens("Peças substituídas", "Total de peças", "Nenhuma peça foi substituída.",
                         pecas, e, largura, k, limite)
    flow += _secao_itens("Serviços executados", "Total de mão de obra", "Nenhum serviço registrado.",
                         servicos, e, largura, k, limite)
    total_geral = _soma(pecas) + _soma(servicos)
    linha_total = Table([[_p("TOTAL GERAL", e["total_rot"]), _p(brl(total_geral), e["total"])]],
                        colWidths=[largura * 0.5, largura * 0.5])
    linha_total.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.8, COR_TEXTO), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * k), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    flow += [Spacer(1, 9 * k), linha_total]

    # ── Validação do cliente ──────────────────────────────────────────────────
    apr = dados.get("aprovacao")
    flow += [Spacer(1, 8 * k), TituloSecao("Validação do cliente", k), Spacer(1, 3 * k)]
    if apr and apr.get("em"):
        canal = CANAL_ROTULO.get(apr.get("canal"), apr.get("canal") or "")
        texto = f"Aprovado {'via ' + canal + ' ' if canal else ''}em {_data_local(apr['em'])}"
        textos = [_p(texto, e["negrito"]),
                  _p(f"Orçamento v{apr['versao']} · registrado em {data_hora_br(apr['em'])}"
                     if apr.get("versao") else f"Registrado em {data_hora_br(apr['em'])}", e["suave"])]
        if apr.get("obs"):
            textos.append(_p(apr["obs"], e["suave"]))
    else:
        textos = [_p("Não há registro de aprovação do cliente para esta OS.", e["suave"])]
    assinatura = dados.get("assinatura_png")
    if assinatura and apr:
        try:
            img = Image(io.BytesIO(assinatura))
            prop = img.imageHeight / float(img.imageWidth or 1)
            w = min(42 * mm * k, img.imageWidth)
            img.drawWidth, img.drawHeight = w, min(w * prop, 14 * mm * k)
            img.hAlign = "RIGHT"
            legenda = _p("ASSINATURA DO CLIENTE", ParagraphStyle("leg", parent=e["rotulo"], alignment=TA_RIGHT))
            validacao = Table([[textos, [img, legenda]]], colWidths=[largura * 0.6, largura * 0.4])
        except Exception:  # noqa: BLE001 — assinatura ilegível não pode derrubar o relatório
            validacao = Table([[textos]], colWidths=[largura])
    else:
        validacao = Table([[textos]], colWidths=[largura])
    validacao.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                   ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    flow.append(KeepTogether([validacao]))

    rodape = rodape_pdf(f"{oficina.get('nome') or ''} · {rotulo_os(dados.get('os_num'))} · relatório final")
    doc.build(flow, onFirstPage=rodape, onLaterPages=rodape)
    return buf.getvalue(), doc.page


def gerar_pdf(dados: dict) -> bytes:
    """Relatório final em UMA página A4: tenta o tamanho normal, depois encolhe fontes e espaços e, em
    último caso (OS com dezenas de itens), lista só os primeiros itens de cada seção."""
    conteudo = b""
    for k in ESCALAS:
        conteudo, paginas = _construir(dados, k, None)
        if paginas <= 1:
            return conteudo
    for limite in LIMITES_DE_ITENS:
        conteudo, paginas = _construir(dados, ESCALA_MINIMA, limite)
        if paginas <= 1:
            break
    return conteudo
