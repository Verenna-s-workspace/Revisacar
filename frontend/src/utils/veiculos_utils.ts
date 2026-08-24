// ── Veículos: utilitários, opções e dados de demonstração ────────────────────

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

// ── Dados de demonstração ─────────────────────────────────────────────────────
// Usados como fallback enquanto o endpoint `/veiculos` não estiver disponível
// no backend (mesmo padrão adotado em `useAgendamentos`).

interface SeedTemplate {
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  categoria: VeiculoCategoria;
  km: number;
  combustivel: string;
  cambio: VeiculoCadastrado['cambio'];
  portas: number;
  chassi?: string;
  renavam?: string;
  status: VeiculoStatus;
  proprietario?: { nome: string; doc?: string; tel?: string; email?: string };
  diasAtras: number; // usado para gerar createdAt relativo a hoje
}

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    placa: 'ABC1D23', marca: 'Hyundai', modelo: 'HB20 Vision', ano: 2020, cor: 'Branco',
    categoria: 'hatch', km: 45230, combustivel: 'Flex', cambio: 'Manual', portas: 4,
    chassi: '9BWZZZ377VT004251', renavam: '01234567890', status: 'na_oficina',
    proprietario: { nome: 'Lucas Andrelo da Silva', doc: '123.456.789-00', tel: '(11) 99876-5432', email: 'lucas.andrelo@email.com' },
    diasAtras: 340,
  },
  {
    placa: 'QWE4R56', marca: 'Toyota', modelo: 'Corolla Altis', ano: 2022, cor: 'Prata',
    categoria: 'sedan', km: 32100, combustivel: 'Flex', cambio: 'CVT', portas: 4,
    status: 'disponivel',
    diasAtras: 180,
  },
  {
    placa: 'JKP2L40', marca: 'Volkswagen', modelo: 'Golf GTI', ano: 2019, cor: 'Preto',
    categoria: 'esportivo', km: 71800, combustivel: 'Gasolina', cambio: 'Automatizado', portas: 2,
    status: 'aguardando_aprovacao',
    proprietario: { nome: 'Carlos Eduardo Oliveira', doc: '234.567.890-11', tel: '(11) 98765-1234', email: 'carlos.eduardo@email.com' },
    diasAtras: 520,
  },
  {
    placa: 'TRK5G90', marca: 'Toyota', modelo: 'Hilux SRX', ano: 2024, cor: 'Branco',
    categoria: 'picape', km: 4200, combustivel: 'Diesel', cambio: 'Automático', portas: 4,
    status: 'pronto_entrega',
    proprietario: { nome: 'Maria Siqueira Bastos', doc: '345.678.901-22', tel: '(19) 97654-3210', email: 'maria.siqueira@email.com' },
    diasAtras: 60,
  },
  {
    placa: 'VOL6V60', marca: 'Volvo', modelo: 'XC60 Momentum', ano: 2021, cor: 'Azul Marinho',
    categoria: 'suv', km: 28900, combustivel: 'Diesel', cambio: 'Automático', portas: 4,
    status: 'na_oficina',
    proprietario: { nome: 'Roberto Mendes Albuquerque', doc: '456.789.012-33', tel: '(21) 96543-2109', email: 'roberto.mendes@email.com' },
    diasAtras: 410,
  },
  {
    placa: 'HCV9B12', marca: 'Honda', modelo: 'Civic Touring', ano: 2023, cor: 'Cinza Grafite',
    categoria: 'sedan', km: 15600, combustivel: 'Flex', cambio: 'CVT', portas: 4,
    status: 'disponivel',
    proprietario: { nome: 'Mariana Costa Ribeiro', doc: '567.890.123-44', tel: '(11) 95432-1098', email: 'mariana.costa@email.com' },
    diasAtras: 95,
  },
  {
    placa: 'RNG7M12', marca: 'Ford', modelo: 'Ranger XLT', ano: 2018, cor: 'Prata',
    categoria: 'picape', km: 98400, combustivel: 'Diesel', cambio: 'Manual', portas: 4,
    status: 'pronto_entrega',
    proprietario: { nome: 'Bruno Alves Teixeira', doc: '678.901.234-55', tel: '(31) 94321-0987' },
    diasAtras: 730,
  },
  {
    placa: 'VWG3F56', marca: 'Volkswagen', modelo: 'Golf GTI', ano: 2017, cor: 'Vermelho',
    categoria: 'esportivo', km: 112300, combustivel: 'Gasolina', cambio: 'Manual', portas: 2,
    status: 'disponivel',
    diasAtras: 600,
  },
  {
    placa: 'COR4X21', marca: 'Toyota', modelo: 'Corolla XEi', ano: 2020, cor: 'Prata Melfi',
    categoria: 'sedan', km: 54000, combustivel: 'Flex', cambio: 'CVT', portas: 4,
    status: 'aguardando_aprovacao',
    proprietario: { nome: 'Ana Paula Ferreira', doc: '789.012.345-66', tel: '(11) 93210-9876', email: 'ana.ferreira@email.com' },
    diasAtras: 280,
  },
  {
    placa: 'JPC8H45', marca: 'Jeep', modelo: 'Compass Longitude', ano: 2022, cor: 'Preto',
    categoria: 'suv', km: 22400, combustivel: 'Flex', cambio: 'Automático', portas: 4,
    status: 'na_oficina',
    proprietario: { nome: 'Pedro Henrique Souza', doc: '890.123.456-77', tel: '(21) 92109-8765' },
    diasAtras: 150,
  },
  {
    placa: 'KWD9L02', marca: 'Renault', modelo: 'Kwid Intense', ano: 2021, cor: 'Laranja',
    categoria: 'hatch', km: 38700, combustivel: 'Flex', cambio: 'Manual', portas: 4,
    status: 'disponivel',
    proprietario: { nome: 'Diego Santos Moraes', doc: '901.234.567-88' },
    diasAtras: 365,
  },
  {
    placa: 'NSK4P88', marca: 'Nissan', modelo: 'Kicks SV', ano: 2023, cor: 'Branco Pérola',
    categoria: 'suv', km: 9800, combustivel: 'Flex', cambio: 'CVT', portas: 4,
    status: 'pronto_entrega',
    proprietario: { nome: 'Beatriz Lima Fontes', doc: '012.345.678-99', tel: '(11) 91098-7654', email: 'beatriz.lima@email.com' },
    diasAtras: 40,
  },
  {
    placa: 'FUR3N18', marca: 'Fiat', modelo: 'Fiorino Furgão', ano: 2019, cor: 'Branco',
    categoria: 'utilitario', km: 86200, combustivel: 'Flex', cambio: 'Manual', portas: 2,
    status: 'disponivel',
    diasAtras: 480,
  },
  {
    placa: 'SPR7K33', marca: 'Mercedes-Benz', modelo: 'Sprinter Van', ano: 2020, cor: 'Branco',
    categoria: 'van', km: 64500, combustivel: 'Diesel', cambio: 'Manual', portas: 4,
    status: 'na_oficina',
    proprietario: { nome: 'Transportadora Rota Sul Ltda.', doc: '12.345.678/0001-90', tel: '(11) 4002-8922' },
    diasAtras: 210,
  },
  {
    placa: 'ONX5K77', marca: 'Chevrolet', modelo: 'Onix Premier', ano: 2022, cor: 'Vermelho',
    categoria: 'hatch', km: 19200, combustivel: 'Flex', cambio: 'Automático', portas: 4,
    status: 'disponivel',
    proprietario: { nome: 'Marcos Vinícius Pereira', doc: '111.222.333-44' },
    diasAtras: 130,
  },
];

function buildSeedVeiculo(tpl: SeedTemplate, idx: number): VeiculoCadastrado {
  const created = new Date();
  created.setDate(created.getDate() - tpl.diasAtras);
  return {
    id: `seed-${idx + 1}`,
    placa: tpl.placa,
    marca: tpl.marca,
    modelo: tpl.modelo,
    ano: tpl.ano,
    cor: tpl.cor,
    categoria: tpl.categoria,
    quilometragem: tpl.km,
    combustivel: tpl.combustivel,
    cambio: tpl.cambio,
    portas: tpl.portas,
    chassi: tpl.chassi,
    renavam: tpl.renavam,
    fotosAdicionais: [],
    status: tpl.status,
    proprietario: tpl.proprietario
      ? {
          nome: tpl.proprietario.nome,
          docCpfCnpj: tpl.proprietario.doc,
          telefone: tpl.proprietario.tel,
          email: tpl.proprietario.email,
        }
      : null,
    createdAt: created.toISOString(),
  };
}

export function buildSeedVeiculos(): VeiculoCadastrado[] {
  return SEED_TEMPLATES.map(buildSeedVeiculo);
}