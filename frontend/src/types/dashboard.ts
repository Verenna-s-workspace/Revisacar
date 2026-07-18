export type NavPage =
  | 'dashboard' | 'ordens' | 'agendamentos' | 'clientes'
  | 'veiculos' | 'estoque' | 'servicos' | 'financeiro'
  | 'relatorios' | 'configuracoes';

export interface OrdemRow {
  id: string;
  os_num: string;
  cliente: string;
  placa: string;
  modelo: string;
  status: string;
  created_at: string;
  updated_at: string;
  fotos_paths?: string[];
  payload?: any;
  /** Ainda não existe no backend (OrdemServicoSerializer / tabela ordens no Supabase).
   *  Quando existir, os relatórios passam a usar o valor real automaticamente
   *  via valorOS() em utils/relatorios.ts. */
  valor_total?: number | null;
}

export interface FaturamentoDia {
  dia: string;
  valor: number;
  ordens: number;
}

export interface TopServico {
  nome: string;
  valor: number;
  heatmap: number[];
}

export interface Alerta {
  tipo: 'crit' | 'warn' | 'info';
  msg: string;
  detalhe: string;
}

export interface DashData {
  ordens: OrdemRow[];
  fatAtual: number;
  fatAnterior: number;
  fatPct: number;
  ordAtual: number;
  ordAnterior: number;
  ordPct: number;
  metaMensal: number;
  metaAlc: number;
  metaPct: number;
  fatDiario: FaturamentoDia[];
  topServicos: TopServico[];
  receitas: number;
  custos: number;
  lucro: number;
  alertas: Alerta[];
  isDemo: boolean;
}
