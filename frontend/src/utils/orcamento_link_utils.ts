// ── Link público do orçamento: funções puras (sem React, sem rede) ────────────

/** URL que o cliente abre. `origem` = window.location.origin (o mesmo site do painel). */
export function urlDoLink(token: string, origem: string): string {
  return `${origem.replace(/\/+$/, '')}/o/${token}`;
}

/** Token da URL `/o/<token>`; null se o caminho não for de link público. */
export function tokenDoCaminho(caminho: string): string | null {
  const m = /^\/o\/([A-Za-z0-9_-]{10,64}\.[A-Za-z0-9_-]{10,64})\/?$/.exec(caminho);
  return m ? m[1] : null;
}

const DDDS_DO_BRASIL = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Telefone → formato do wa.me (só dígitos, com 55). Aceita "(11) 99999-9999", "+55 11 99999-9999"…
 * Devolve null se não parece um telefone brasileiro (DDD existente; 10 dígitos fixo ou 11 celular, com ou sem 55).
 */
export function telefoneParaWhatsApp(tel: string | null | undefined): string | null {
  let d = (tel ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1); // "011 9…": o zero é prefixo de discagem
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (!DDDS_DO_BRASIL.has(Number(d.slice(0, 2)))) return null;
  if (d.length === 11 && d[2] !== '9') return null; // celular com 9º dígito
  return `55${d}`;
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

export function mensagemDoWhatsApp(p: { cliente?: string; veiculo?: string; url: string }): string {
  const nome = primeiroNome(p.cliente);
  const abertura = nome ? `Olá, ${nome}!` : 'Olá!';
  const carro = p.veiculo ? ` do seu ${p.veiculo}` : '';
  return `${abertura} Segue o orçamento${carro}. Por este link você vê os valores e pode aprovar ou recusar:\n${p.url}`;
}

/** Link "abrir conversa" do WhatsApp; sem telefone válido abre o WhatsApp pra escolher o contato. */
export function linkWhatsApp(tel: string | null | undefined, mensagem: string): string {
  const numero = telefoneParaWhatsApp(tel);
  return `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(mensagem)}`;
}

/** "Aberto 3 vezes · 1ª vez em 18/10 às 10:30" / "Ainda não aberto". */
export function resumoAcessos(l: Pick<LinkResumo, 'acessos' | 'primeiroAcessoEm'>, formatar: (iso: string) => string): string {
  if (!l.acessos) return 'O cliente ainda não abriu o link.';
  const vezes = l.acessos === 1 ? 'Aberto 1 vez' : `Aberto ${l.acessos} vezes`;
  return l.primeiroAcessoEm ? `${vezes} · 1ª vez em ${formatar(l.primeiroAcessoEm)}` : vezes;
}

type LinkResumo = { acessos: number; primeiroAcessoEm?: string };

/** Mensagem amigável pro erro de uma chamada pública, por status HTTP / código. */
export function mensagemPublica(status: number, codigo?: string): string {
  if (status === 404) return 'Link não encontrado. Confira se copiou o endereço inteiro ou peça um novo à oficina.';
  if (status === 410) return codigo === 'link_expirado' ? 'Este link expirou. Peça um novo à oficina.' : 'Este link foi substituído. Peça um novo à oficina.';
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (status === 409) return 'Este orçamento já foi respondido ou não pode mais ser respondido.';
  if (status === 422) return 'Confira os dados informados.';
  if (status >= 500) return 'Não foi possível concluir agora. Tente de novo em instantes.';
  return 'Não foi possível carregar o orçamento.';
}
