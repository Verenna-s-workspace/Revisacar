import { SECTIONS } from '../constants';
import type { OSHeader, Cliente, Veiculo, Tecnico, ChecklistStats, CritItem, ValidationErrors } from '../types';

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

// ── Checklist ─────────────────────────────────────────────────────────────────

export const initChecklist = (): Record<string, { status: string | null; obs: string }> => {
  const c: Record<string, { status: string | null; obs: string }> = {};
  SECTIONS.forEach((s) =>
    s.items.forEach((name) => {
      c[`${s.id}:${name}`] = { status: null, obs: '' };
    })
  );
  return c;
};

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

// ── Checklist stats ───────────────────────────────────────────────────────────

export const getChecklistStats = (
  selected: Set<string>,
  checklist: Record<string, { status: string | null; obs: string }>,
  itensAdicionais: string[] = [],
): ChecklistStats => {
  // Gera as keys das seções estáticas normalmente
  const staticKeys = SECTIONS
    .filter((s) => selected.has(s.id) && !s.isDynamic)
    .flatMap((s) => s.items.map((n) => `${s.id}:${n}`));

  // Para a seção dinâmica, usa os itens reais adicionados pelo usuário
  const dynamicKeys = selected.has('adicionais') && itensAdicionais.length > 0
    ? itensAdicionais.map((n) => `adicionais:${n}`)
    : [];

  const activeKeys = [...staticKeys, ...dynamicKeys];
  const statuses   = activeKeys.map((k) => checklist[k]?.status ?? null);

  return {
    activeKeys,
    total: activeKeys.length,
    ok:    statuses.filter((v) => v === 'ok').length,
    warn:  statuses.filter((v) => v === 'warn').length,
    crit:  statuses.filter((v) => v === 'crit').length,
    na:    statuses.filter((v) => v === 'na').length,
    done:  statuses.filter(Boolean).length,
  };
};

export const getCritItems = (
  selected: Set<string>,
  checklist: Record<string, { status: string | null; obs: string }>,
  itensAdicionais: string[] = [],
): CritItem[] => {
  const result: CritItem[] = [];

  SECTIONS
    .filter((s) => selected.has(s.id))
    .forEach((s) => {
      // Itens reais da seção: estáticas usam s.items, dinâmica usa itensAdicionais
      const items = s.isDynamic ? itensAdicionais : s.items;

      items
        .filter((n) => checklist[`${s.id}:${n}`]?.status === 'crit')
        .forEach((n) =>
          result.push({
            sec:  s.label,
            name: n,
            obs:  checklist[`${s.id}:${n}`]?.obs ?? '',
          })
        );
    });

  return result;
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