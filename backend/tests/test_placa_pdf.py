"""Placa no PDF: mesmo seletor de padrão (antiga × Mercosul) do app."""
import pytest

from orders import placa_pdf


@pytest.mark.parametrize("placa,padrao", [
    ("ABC1234", placa_pdf.PADRAO_ANTIGO), ("abc-1234", placa_pdf.PADRAO_ANTIGO),
    ("ABC1D23", placa_pdf.PADRAO_MERCOSUL), ("rvn4p56", placa_pdf.PADRAO_MERCOSUL),
    ("", placa_pdf.PADRAO_MERCOSUL), (None, placa_pdf.PADRAO_MERCOSUL), ("XX", placa_pdf.PADRAO_MERCOSUL),
])
def test_seletor_do_padrao(placa, padrao):
    assert placa_pdf.padrao_placa(placa) == padrao
