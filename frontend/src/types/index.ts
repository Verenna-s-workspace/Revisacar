// ── RevisaCar — Types ─────────────────────────────────────────────────────────

export interface OSHeader {
  os_num: string;
  os_date: string;
  os_time: string;
  os_km: string;
}

export interface Cliente {
  nome: string;
  doc: string;
  tel: string;
  email: string;
}

export interface Veiculo {
  placa: string;
  modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  nivel_combustivel: string;
  chassi: string;
  obs_entrada: string;
  obs_cliente: string;
}

export interface ChecklistItemData {
  status: ChecklistStatus | null;
  obs: string;
}

export type ChecklistStatus = 'ok' | 'warn' | 'crit' | 'na';

export interface Tecnico {
  nome: string;
  registro: string;
  data_saida: string;
  hora_saida: string;
  km_saida: string;
  parecer_geral: string;
}

export interface Photo {
  src: string;
  name: string;
  path?: string;
}

export interface Section {
  id: string;
  label: string;
  icon: string;
  items: string[];
  isDynamic?: boolean;
}

export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}

export interface ChecklistStats {
  activeKeys: string[];
  total: number;
  ok: number;
  warn: number;
  crit: number;
  na: number;
  done: number;
}

export interface CritItem {
  sec: string;
  name: string;
  obs: string;
}

export type SaveStatus = '' | 'saving' | 'saved' | 'error';

export interface OrdemServico {
  os_header: OSHeader;
  cliente: Cliente;
  veiculo: Veiculo;
  servicos_selecionados: string[];
  checklist: Record<string, ChecklistItemData>;
  itens_adicionais: string[];
  fotos_base64: string[];
  fotos_paths: string[];
  tecnico?: Tecnico;
  status: string;
}

export type ValidationErrors = Record<string, string>;
