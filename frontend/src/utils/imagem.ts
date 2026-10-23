// Compressão de foto no navegador, ANTES de enviar: o celular entrega fotos de 3–6 MB e o servidor
// recusa acima de 5 MB (e a internet do pátio da oficina nem sempre aguenta). Reduz o lado maior e
// regrava como JPEG. Fotos já pequenas só são regravadas (nunca ampliadas).

/** Lado maior, em pixels. 1600 mantém legível o número do hodômetro e a placa. */
export const MAX_LADO_PADRAO = 1600;
/** Qualidade JPEG (0–1). ~0,75 costuma dar 150–300 KB por foto, sem perda visível. */
export const QUALIDADE_PADRAO = 0.75;

/** Dimensões finais mantendo a proporção. Nunca amplia; lado inválido volta como veio. */
export function dimensoesReduzidas(largura: number, altura: number, maxLado: number = MAX_LADO_PADRAO) {
  const maior = Math.max(largura, altura);
  if (!(maior > 0) || maior <= maxLado) return { largura, altura };
  const fator = maxLado / maior;
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
}

/** Tamanho aproximado, em bytes, de um data URL base64. */
export function bytesDoDataUrl(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const preenchimento = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - preenchimento);
}

export interface OpcoesCompressao {
  maxLado?: number;
  qualidade?: number;
}

export interface ImagemComprimida {
  blob: Blob;
  dataUrl: string;
  largura: number;
  altura: number;
  bytesAntes: number;
  bytesDepois: number;
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.readAsDataURL(blob);
  });
}

/** Reduz e regrava como JPEG. Aceita um arquivo/Blob ou um data URL. */
export async function comprimirImagem(
  origem: Blob | string,
  { maxLado = MAX_LADO_PADRAO, qualidade = QUALIDADE_PADRAO }: OpcoesCompressao = {},
): Promise<ImagemComprimida> {
  const url = typeof origem === 'string' ? origem : URL.createObjectURL(origem);
  const bytesAntes = typeof origem === 'string' ? bytesDoDataUrl(origem) : origem.size;
  try {
    const img = await carregarImagem(url);
    const { largura, altura } = dimensoesReduzidas(img.naturalWidth, img.naturalHeight, maxLado);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a imagem.');
    ctx.fillStyle = '#fff';                       // PNG com transparência não vira preto no JPEG
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);    // os navegadores atuais já respeitam a rotação EXIF

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível comprimir a imagem.'))), 'image/jpeg', qualidade),
    );
    return { blob, dataUrl: await blobParaDataUrl(blob), largura, altura, bytesAntes, bytesDepois: blob.size };
  } finally {
    if (typeof origem !== 'string') URL.revokeObjectURL(url);
  }
}
