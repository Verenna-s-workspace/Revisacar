// ── Veículos: utilitários e opções ────────────────────

import { COMBUSTIVEL_OPTIONS } from '../constants';
import { formatPhoneBR, onlyDigits } from '../components/inputs/masks';
import type { OSPrefillInput } from '../types/atendimento';
import type {
  VeiculoCadastrado,
  VeiculoCategoria,
  VeiculoFiltros,
  VeiculoStatus,
} from '../types/veiculo';

// ── Opções de formulário ──────────────────────────────────────────────────────

export const CATEGORIA_OPTIONS: { value: VeiculoCategoria; label: string }[] = [
  { value: 'sedan',      label: 'Sedan' },
  { value: 'hatch',      label: 'Hatch' },
  { value: 'suv',        label: 'SUV' },
  { value: 'picape',     label: 'Picape' },
  { value: 'van',        label: 'Van' },
  { value: 'utilitario', label: 'Utilitário' },
  { value: 'esportivo',  label: 'Esportivo' },
];

export const CATEGORIA_LABEL: Record<VeiculoCategoria, string> =
  CATEGORIA_OPTIONS.reduce((acc, c) => ({ ...acc, [c.value]: c.label }), {} as Record<VeiculoCategoria, string>);

export const CAMBIO_OPTIONS = ['Manual', 'Automático', 'CVT', 'Automatizado'] as const;

export const PORTAS_OPTIONS = [2, 3, 4, 5] as const;

export const MARCAS_SUGERIDAS = [
  'Chevrolet', 'Fiat', 'Volkswagen', 'Toyota', 'Honda', 'Hyundai', 'Renault',
  'Jeep', 'Ford', 'Nissan', 'Peugeot', 'Citroën', 'BMW', 'Mercedes-Benz', 'Audi', 'Volvo',
];

// ── Formatadores ───────────────────────────────────────────────────────────────

export function formatKm(km: number): string {
  return `${km.toLocaleString('pt-BR')} km`;
}

export function formatPlaca(placa: string): string {
  return placa.trim().toUpperCase();
}

export function ownerInitial(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || '?';
}

export function emptyFiltros(): VeiculoFiltros {
  return {
    marca: '',
    modelo: '',
    categoria: 'todas',
    anoDe: '',
    anoAte: '',
    cor: '',
    proprietario: '',
    status: 'todos',
    vinculo: 'todos',
  };
}

export function filtrosAtivos(f: VeiculoFiltros): boolean {
  return (
    f.marca !== '' ||
    f.modelo !== '' ||
    f.categoria !== 'todas' ||
    f.anoDe !== '' ||
    f.anoAte !== '' ||
    f.cor !== '' ||
    f.proprietario !== '' ||
    f.status !== 'todos' ||
    f.vinculo !== 'todos'
  );
}

// ── "Nova OS" a partir do veículo ─────────────────────────────────────────────

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Casa o combustível do cadastro ("flex", "Gasolina") com uma opção do checklist; sem casar, vazio. */
function combustivelDoChecklist(valor: string | undefined): string {
  const alvo = semAcento(valor ?? '');
  return COMBUSTIVEL_OPTIONS.find(o => semAcento(o) === alvo) ?? '';
}

/**
 * Monta o pré-preenchimento do checklist inicial a partir de um veículo da frota.
 *  • Com proprietário vinculado: dados do cliente (nome, CPF/CNPJ, telefone, e-mail) + dados do veículo.
 *  • Sem proprietário: só os dados do veículo — o bloco do cliente fica em branco.
 * Só preenche (`apenasPreencher`): a OS só é criada quando o mecânico salvar. Não leva a quilometragem
 * cadastrada: o "Km atual" da entrada é o que o hodômetro marca agora.
 */
export function veiculoParaPrefill(v: VeiculoCadastrado): OSPrefillInput {
  const dono = v.proprietario && v.proprietario.nome.trim() ? v.proprietario : null;
  return {
    clienteNome: dono?.nome.trim() ?? '',
    clienteDoc: dono?.docCpfCnpj ? onlyDigits(dono.docCpfCnpj) || undefined : undefined,
    clienteTel: dono?.telefone ? formatPhoneBR(dono.telefone) || undefined : undefined,
    clienteEmail: dono?.email || undefined,
    veiculoModelo: `${v.marca} ${v.modelo}`.trim(),
    veiculoPlaca: v.placa,
    veiculoAno: v.ano ? String(v.ano) : undefined,
    veiculoCor: v.cor || undefined,
    veiculoCombustivel: combustivelDoChecklist(v.combustivel) || undefined,
    veiculoChassi: v.chassi ? v.chassi.toUpperCase().slice(0, 17) : undefined,
    apenasPreencher: true,
  };
}
