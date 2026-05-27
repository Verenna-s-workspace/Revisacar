
import type { OSHeader, Cliente, Veiculo, Tecnico, ValidationErrors } from '../types';

// ── Date helpers ─────────────────────────────────────────────────────────────

const pad = (v: number) => String(v).padStart(2, '0');

export const nowDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const nowTime = (): string => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const randomOsNum = (): string =>
  String(Math.floor(Math.random() * 900000) + 100000);

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const formatTime = (timeStr: string): string => timeStr || '—';


// ── Validation ────────────────────────────────────────────────────────────────

export const validateStep1 = (
  osHeader: OSHeader,
  cliente: Cliente,
  veiculo: Veiculo
): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!osHeader.os_num?.trim()) errors.os_num = 'Obrigatório';
  if (!osHeader.os_date)        errors.os_date = 'Obrigatório';
  if (!osHeader.os_time)        errors.os_time = 'Obrigatório';
  if (!cliente.nome?.trim())    errors.cli_nome = 'Obrigatório';
  if (!cliente.tel?.trim())     errors.cli_tel = 'Obrigatório';
  if (!veiculo.modelo?.trim())  errors.vei_modelo = 'Obrigatório';
  return errors;
};

export const validateStep5 = (tecnico: Tecnico): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!tecnico.nome?.trim()) errors.tec_nome = 'Obrigatório';
  return errors;
};



// ── HTML escape ───────────────────────────────────────────────────────────────

export const escapeHtml = (str: string): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ── Format placa ──────────────────────────────────────────────────────────────

export const formatPlaca = (v: string): string =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);