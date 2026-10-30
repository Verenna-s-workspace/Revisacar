// ── Veículos: utilitários e opções ────────────────────

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
