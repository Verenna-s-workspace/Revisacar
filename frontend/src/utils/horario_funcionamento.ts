// ── Horário de funcionamento da oficina ──────────────────────────────────────
//
// Fonte única de verdade pro horário de abertura/fechamento configurado em
// Configurações. Guardado dentro do mesmo blob 'oficina_config' já usado
// pros outros dados da oficina (nome, CNPJ, etc.) — mesmo padrão, uma
// entrada só no localStorage.
//
// Qualquer tela que precise do horário (Configurações, e os componentes de
// Agendamento) deve ler por aqui — nunca duplicar o parsing do
// localStorage. Componentes React devem preferir o hook
// `useHorarioFuncionamento` (reativo); código fora de componente (ex.:
// validação dentro de um hook de dados) pode chamar `lerHorarioFuncionamento`
// diretamente.

import { DEFAULT_HORA_ABERTURA, DEFAULT_HORA_FECHAMENTO } from './agenda';

const STORAGE_KEY = 'oficina_config';

/** Disparado no `window` sempre que o horário é salvo em Configurações, pra
 * qualquer tela de Agendamento já montada atualizar sem precisar navegar
 * pra fora e voltar. */
export const HORARIO_ATUALIZADO_EVENTO = 'oficina-horario-atualizado';

export interface HorarioFuncionamento {
  horaAbertura: string;
  horaFechamento: string;
}

function horarioValido(h: unknown): h is string {
  return typeof h === 'string' && /^\d{2}:\d{2}$/.test(h);
}

/** Lê o horário configurado do localStorage, com fallback pro padrão
 * (08:00–19:00, o mesmo comportamento de antes desta configuração existir)
 * quando ainda não foi configurado ou o dado salvo está corrompido. */
export function lerHorarioFuncionamento(): HorarioFuncionamento {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (horarioValido(parsed?.horaAbertura) && horarioValido(parsed?.horaFechamento)) {
        return { horaAbertura: parsed.horaAbertura, horaFechamento: parsed.horaFechamento };
      }
    }
  } catch {
    // localStorage indisponível ou JSON corrompido — cai no padrão abaixo.
  }
  return { horaAbertura: DEFAULT_HORA_ABERTURA, horaFechamento: DEFAULT_HORA_FECHAMENTO };
}

/** Avisa as telas já montadas (nesta mesma aba) que o horário mudou. Chame
 * depois de gravar no localStorage. */
export function notificarHorarioAtualizado() {
  window.dispatchEvent(new Event(HORARIO_ATUALIZADO_EVENTO));
}
