
import { nowDate, escapeHtml } from "./index";
import type {
  OSHeader,
  Cliente,
  Veiculo,
  Tecnico,
  Photo,
  Section,
} from "../types";

/**
 * Gera a janela de impressão/PDF da OS.
 * Todos os valores interpolados são sanitizados com escapeHtml.
 */
export const exportPDF = (
  osHeader: OSHeader,
  cliente: Cliente,
  veiculo: Veiculo,
  tecnico: Tecnico,
  photos: Photo[],
  sigImage: string | null = null,
) => {





  


 
  // ── Fotos HTML ─────────────────────────────────────────────────────────────
  const photosHTML =
    photos.length > 0
      ? `
    <hr class="divider">
    <div class="section-title" style="margin-bottom:10px">Registro fotográfico (${photos.length})</div>
    <div class="photos-grid">
      ${photos.map((p: Photo) => `<img src="${p.src}" alt="${escapeHtml(p.name)}">`).join("")}
    </div>`
      : "";

  
  // ── HTML completo ──────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OS ${escapeHtml(osHeader.os_num)} — RevisaCar</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;font-size:9.5px;color:#1a1a1a;background:#fff}
@media print{
  body{padding:0}
  .no-print{display:none}
  @page{margin:8mm 10mm;size:A4}
  .sig-section{page-break-inside:avoid}
  .photos-grid{page-break-inside:avoid}
}
.page{max-width:780px;margin:0 auto;padding:18px 20px}
.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1.5px solid #1a1a1a;padding-bottom:10px;margin-bottom:12px}
.brand-wrap{display:flex;align-items:center;gap:7px}
.brand-bar{width:2.5px;height:22px;background:#CC1400;border-radius:1px;flex-shrink:0}
.brand{font-size:.9rem;font-weight:600;letter-spacing:-.02em;color:#1a1a1a;line-height:1}
.brand span{color:#CC1400}
.brand-sub{font-family:'DM Mono',monospace;font-size:.42rem;color:#a8a5a0;letter-spacing:.14em;text-transform:uppercase;margin-top:2px}
.os-meta{text-align:right;font-family:'DM Mono',monospace;font-size:.58rem;color:#6b6760;line-height:1.6}
.os-meta strong{color:#1a1a1a;font-size:.75rem;font-family:'DM Sans',sans-serif;font-weight:600;display:block;margin-bottom:1px}
.section{margin-bottom:10px;min-width:0}
.section-title{font-family:'DM Mono',monospace;font-size:.48rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#9a958c;margin-bottom:4px;display:flex;align-items:center;gap:6px}
.section-title::before{content:'';display:block;width:9px;height:1.5px;background:#CC1400;border-radius:1px;flex-shrink:0}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.field{display:flex;flex-direction:column;gap:0;padding:3px 0;border-bottom:1px solid #f0eeea;min-width:0}
.field-label{font-family:'DM Mono',monospace;font-size:.44rem;letter-spacing:.08em;text-transform:uppercase;color:#b8b5b0}
.field-value{font-size:.72rem;font-weight:500;color:#1a1a1a;line-height:1.3;word-break:break-word;overflow-wrap:break-word}
.parecer-text{font-size:.72rem;line-height:1.65;color:#1a1a1a;padding-top:4px;word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap;min-width:0}
.photos-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:8px 0}
.photos-grid img{width:100%;height:60px;object-fit:cover;border-radius:2px;border:1px solid #e5e3de}
.sig-section{border-top:1px solid #e5e3de;padding-top:10px;margin-top:10px;display:flex;justify-content:flex-end}
.sig-box{text-align:center;width:200px}
.sig-img{width:100%;height:36px;object-fit:contain;object-position:center bottom;display:block;margin-bottom:4px}
.sig-line{height:36px;border-bottom:1px solid #1a1a1a;margin-bottom:4px}
.sig-name{font-family:'DM Mono',monospace;font-size:.5rem;color:#9a958c}
.divider{border:none;border-top:1px solid #e5e3de;margin:8px 0}
.print-btn{position:fixed;bottom:20px;right:20px;background:#1a1a1a;color:#fff;border:none;padding:9px 18px;font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;border-radius:4px;transition:.15s}
.print-btn:hover{background:#CC1400}
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="brand-wrap">
      <div class="brand-bar"></div>
      <div>
        <div class="brand">Revisa<span>Car</span></div>
        <div class="brand-sub">Inspeção Veicular</div>
      </div>
    </div>
    <div class="os-meta">
      <strong>OS Nº ${escapeHtml(osHeader.os_num)}</strong>
      Entrada: ${escapeHtml(osHeader.os_date)} às ${escapeHtml(osHeader.os_time)}<br>
      Quilometragem: ${escapeHtml(osHeader.os_km) || "—"}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:8px">

    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="field"><span class="field-label">Nome</span><span class="field-value">${escapeHtml(cliente.nome) || "—"}</span></div>
      <div class="field"><span class="field-label">CPF / CNPJ</span><span class="field-value">${escapeHtml(cliente.doc) || "—"}</span></div>
      <div class="field"><span class="field-label">Telefone</span><span class="field-value">${escapeHtml(cliente.tel) || "—"}</span></div>
      <div class="field"><span class="field-label">E-mail</span><span class="field-value">${escapeHtml(cliente.email) || "—"}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Veículo</div>
      <div class="grid-2">
        <div class="field"><span class="field-label">Placa</span><span class="field-value">${escapeHtml(veiculo.placa) || "—"}</span></div>
        <div class="field"><span class="field-label">Ano</span><span class="field-value">${escapeHtml(veiculo.ano) || "—"}</span></div>
      </div>
      <div class="field"><span class="field-label">Modelo</span><span class="field-value">${escapeHtml(veiculo.modelo) || "—"}</span></div>
      <div class="grid-2">
        <div class="field"><span class="field-label">Cor</span><span class="field-value">${escapeHtml(veiculo.cor) || "—"}</span></div>
        <div class="field"><span class="field-label">Combustível / Nível</span><span class="field-value">${escapeHtml(veiculo.combustivel) || "—"} ${escapeHtml(veiculo.nivel_combustivel) || "—"}</span></div>
      </div>
      <div class="field"><span class="field-label">Chassi</span><span class="field-value">${escapeHtml(veiculo.chassi) || "—"}</span></div>
      ${veiculo.obs_entrada ? `<div class="field"><span class="field-label">Obs. entrada</span><span class="field-value">${escapeHtml(veiculo.obs_entrada)}</span></div>` : ""}
    </div>

  </div>

  ${photosHTML}
      
  <hr class="divider">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:8px">
    <div class="section">
      <div  style="color:#CC1400; class="section-title">Técnico responsável</div>
      <div class="field"><span class="field-label">Nome</span><span class="field-value">${escapeHtml(tecnico.nome) || "—"}</span></div>
      <div class="field"><span class="field-label">Registro / CREA</span><span class="field-value">${escapeHtml(tecnico.registro) || "—"}</span></div>
      <div class="grid-2">
        <div class="field"><span class="field-label">Data saída</span><span class="field-value">${escapeHtml(tecnico.data_saida) || "—"}</span></div>
        <div class="field"><span class="field-label">Hora saída</span><span class="field-value">${escapeHtml(tecnico.hora_saida) || "—"}</span></div>
      </div>
      <div class="field"><span class="field-label">Km saída</span><span class="field-value">${escapeHtml(tecnico.km_saida) || "—"}</span></div>
    </div>



    ${tecnico.parecer_geral ? `
    <div class="section">
      <div class="section-title">Parecer geral</div>
      <div class="parecer-text">${escapeHtml(tecnico.parecer_geral)}</div>
    </div>` : ""}

  </div>

  <div class="sig-section">
    <div class="sig-box">
      ${sigImage
        ? `<img src="${sigImage}" alt="Assinatura" class="sig-img">`
        : `<div style="height:36px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:.44rem;letter-spacing:.08em;text-transform:uppercase;color:#b8b5b0;">Sem assinatura</span></div>`
      }
      <div class="sig-line"></div>
      <div class="sig-name">${escapeHtml(tecnico.nome) || "Técnico responsável"} &nbsp;·&nbsp; ${escapeHtml(tecnico.data_saida) || nowDate()}</div>
    </div>
  </div>

</div>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
</body>
</html>`;


  const win = window.open("", "_blank");
  if (!win) {
    alert("Bloqueador de pop-ups ativo. Permita pop-ups para gerar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
};