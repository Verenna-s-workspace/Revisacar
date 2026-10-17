export type NavPage =
  | 'dashboard' | 'ordens' | 'agendamentos' | 'clientes'
  | 'veiculos' | 'estoque' | 'servicos' | 'financeiro'
  | 'relatorios' | 'configuracoes' | 'atendimento' | 'alertas' | 'dicas';

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
  /** Cliente já foi avisado de que o serviço terminou (banco; só existe depois do script alertas.sql). */
  cliente_avisado?: boolean;
  cliente_avisado_em?: string | null;
  cliente_avisado_por_nome?: string | null;
  /** Quando o serviço foi concluído (só existe depois de ordens_execucao.sql; senão vale updated_at). */
  concluida_em?: string | null;
}

export interface FaturamentoDia {
  dia: string;
  valor: number;
  ordens: number;
}

export interface Alerta {
  tipo: 'crit' | 'warn' | 'info';
  msg: string;
  detalhe: string;
}
