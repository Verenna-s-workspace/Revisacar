// Preenche o cliente/veículo da OS a partir de um cadastro da carteira (mesmas regras de digitação dos campos).
// Usado pela identificação da Entrada; o servidor continua garantindo "sem duplicar" ao salvar (os_vinculo).
import { COMBUSTIVEL_OPTIONS } from '../constants';
import { FILTRO, formatChassi, formatNome, formatPlaca, limparTexto, onlyDigits } from '../components/inputs/masks';
import { LIM } from './campos_checklist';
import type { Cliente, Veiculo } from '../types';
import type { Cliente as ClienteCarteira } from '../types/cliente';
import type { VeiculoCadastrado } from '../types/veiculo';

export function clienteDeCadastro(c: ClienteCarteira): Cliente {
  return {
    id: c.id,
    nome: formatNome(c.nome, LIM.nome).trim(),
    doc: onlyDigits(c.cpfCnpj || '').slice(0, 14),
    tel: onlyDigits(c.telefone || '').slice(0, 11),
    email: limparTexto(c.email || '', FILTRO.espacos, LIM.email),
  };
}

/** Veículo cadastrado → veículo da OS: só completa o que está vazio (não apaga o que já foi digitado). */
export function veiculoDeCadastro(p: Veiculo, v: VeiculoCadastrado): Veiculo {
  return {
    ...p,
    id: v.id,
    placa: formatPlaca(v.placa),
    modelo: p.modelo.trim() ? p.modelo : limparTexto([v.marca, v.modelo].filter(Boolean).join(' '), FILTRO.modelo, LIM.modelo).trim(),
    ano: p.ano.trim() ? p.ano : onlyDigits(String(v.ano || '')).slice(0, 4),
    cor: p.cor.trim() ? p.cor : limparTexto(v.cor || '', FILTRO.cor, LIM.cor).trim(),
    combustivel: p.combustivel || (COMBUSTIVEL_OPTIONS.includes(v.combustivel) ? v.combustivel : ''),
    chassi: p.chassi || formatChassi(v.chassi || ''),
  };
}
