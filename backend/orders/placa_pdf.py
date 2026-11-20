"""
Placa do veículo no PDF — mesmas regras e mesmas medidas dos componentes do app
(`frontend/src/features/Dashboard/PlacaCinza.tsx|css` e `PlacaMercosul.tsx|css`).

O app só tem os dois componentes (cada tela escolhe o seu); não há um seletor pronto. A regra de
quem é quem é a de `frontend/src/components/inputs/masks.ts` (`isValidPlaca`) e a do backend
(`carteira.PLACA_RE`):
  ABC1234  → padrão antigo (cinza)      ABC1D23 → Mercosul (branca, faixa azul + bandeira)
Qualquer outro formato cai no Mercosul, que é o componente padrão do app.

Todas as medidas abaixo são as do CSS (em px) multiplicadas por um único fator; assim as proporções
das duas placas ficam idênticas às da tela.
"""
import os
import re

from reportlab.lib import colors
from reportlab.platypus import Flowable

PADRAO_ANTIGO = "antigo"
PADRAO_MERCOSUL = "mercosul"
_ANTIGA_RE = re.compile(r"^[A-Z]{3}\d{4}$")
_MERCOSUL_RE = re.compile(r"^[A-Z]{3}\d[A-Z]\d{2}$")

BANDEIRA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "flag_brasil.png")
_PRETO = colors.HexColor("#1A1D22")
_CINZA = colors.HexColor("#A5A8AA")
_AZUL = colors.HexColor("#003399")
_FURO_BORDA = colors.HexColor("#B8B8B8")

LARGURA_PX, ALTURA_PX = 73, 29  # tamanho da placa nos componentes


def normalizar(placa) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(placa or "").upper())


def padrao_placa(placa) -> str:
    """Seletor do padrão da placa (antigo × Mercosul), pela mesma regra do app."""
    texto = normalizar(placa)
    if _ANTIGA_RE.match(texto):
        return PADRAO_ANTIGO
    return PADRAO_MERCOSUL


class PlacaFlowable(Flowable):
    """Desenha a placa (antiga/cinza ou Mercosul) com as proporções do componente do app.
    `px`: pontos por px do CSS. `fonte_*`: fonte e tamanhos (pt) do texto da placa e do rótulo da faixa."""

    def __init__(self, placa, px, fonte, tam_texto, tam_pais):
        super().__init__()
        self.texto = str(placa or "").strip().upper()
        self.padrao = padrao_placa(self.texto)
        self.px, self.fonte, self.tam_texto, self.tam_pais = px, fonte, tam_texto, tam_pais
        self.hAlign = "RIGHT"

    def wrap(self, largura, altura):
        self.width, self.height = LARGURA_PX * self.px, ALTURA_PX * self.px
        return self.width, self.height

    def draw(self):
        c, p = self.canv, self.px
        w, h = self.width, self.height
        borda = 1.5 * p
        c.saveState()
        c.setLineWidth(borda)
        c.setStrokeColor(_PRETO)
        c.setFillColor(_CINZA if self.padrao == PADRAO_ANTIGO else colors.white)
        c.roundRect(borda / 2, borda / 2, w - borda, h - borda, 4 * p, stroke=1, fill=1)
        interior_topo = h - borda
        faixa_h = 10 * p
        if self.padrao == PADRAO_MERCOSUL:
            # faixa azul de 10px colada no topo, "BRASIL" centrado e bandeira à direita
            c.saveState()
            clip = c.beginPath()
            clip.roundRect(borda, borda, w - 2 * borda, h - 2 * borda, 2.5 * p)
            c.clipPath(clip, stroke=0, fill=0)
            c.setFillColor(_AZUL)
            c.rect(borda, interior_topo - faixa_h, w - 2 * borda, faixa_h, stroke=0, fill=1)
            c.restoreState()
            c.setFillColor(colors.white)
            c.setFont(self.fonte, self.tam_pais)
            c.drawCentredString(w / 2, interior_topo - faixa_h / 2 - self.tam_pais * 0.34, "BRASIL",
                                charSpace=0.3 * p)
            if os.path.exists(BANDEIRA_PATH):
                bh = 5.5 * p
                bw = min(bh * 300 / 210, 10 * p)
                bh = bw * 210 / 300
                c.drawImage(BANDEIRA_PATH, w - borda - 3 * p - bw, interior_topo - faixa_h / 2 - bh / 2,
                            width=bw, height=bh, mask="auto")
            centro_texto = (interior_topo - faixa_h + borda) / 2
        else:
            # faixa cinza com 80% da largura, borda fina e dois furos, "BR-BRASIL" no meio
            fl = (w - 2 * borda) * 0.8
            fx = (w - fl) / 2
            fy = interior_topo - 1 * p - faixa_h
            c.setLineWidth(1 * p)
            c.setStrokeColor(colors.Color(0x3B / 255, 0x3D / 255, 0x40 / 255, alpha=0.4))
            c.setFillColor(_CINZA)
            c.rect(fx, fy, fl, faixa_h, stroke=1, fill=1)
            c.setFillColor(_PRETO)
            c.setFont(self.fonte, self.tam_pais)
            c.drawCentredString(w / 2, fy + faixa_h / 2 - self.tam_pais * 0.34 - 1 * p, "BR-BRASIL",
                                charSpace=0.3 * p)
            for cx in (fx + 8 * p, fx + fl - 8 * p):
                c.setLineWidth(0.5 * p)
                c.setStrokeColor(_FURO_BORDA)
                c.setFillColor(_PRETO)
                c.circle(cx, fy + faixa_h / 2, 1.5 * p, stroke=1, fill=1)
            centro_texto = (fy + borda) / 2
        c.setFillColor(_PRETO)
        c.setFont(self.fonte, self.tam_texto)
        c.drawCentredString(w / 2, centro_texto - self.tam_texto * 0.34, self.texto)
        c.restoreState()
