export type NavPage =
  | 'dashboard' | 'ordens' | 'agendamentos' | 'clientes'
  | 'veiculos' | 'estoque' | 'servicos' | 'financeiro'
  | 'relatorios' | 'configuracoes' | 'atendimento' | 'alertas' | 'dicas' | 'mais';

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
  /** Total do orçamento que vale hoje, calculado pelo GET /ordens (não é coluna).
   *  null = OS sem orçamento enviado; a tela mostra "—". */
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
