import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { useResponsive } from '../../../components/ui';
import { lerHorarioFuncionamento } from '../../../utils/horario_funcionamento';
import {
  toISODate,
  timeToMinutes,
  minutesToTime,
  duracaoEmMinutos,
  acharConflito,
  formatDuracao,
  formatDateBR,
  DEFAULT_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
} from '../../../utils/agenda';
import { DuracaoSelector } from './DuracaoSelector';
import type { Agendamento } from '../../../types/agendamento';

interface AjustarHorarioModalProps {
  agendamento: Agendamento;
  /** 'confirmar': pedido pendente (ex.: vindo do app do cliente) — a oficina define a duração e confirma. */
  modo: 'ajustar' | 'confirmar';
  getOcupados: (data: string, excludeId?: string) => { horaInicio: string; horaFim: string; id: string }[];
  onSave: (changes: Partial<Agendamento>) => Promise<void> | void;
  onClose: () => void;
}

/** Ajuste de data, início e duração de um agendamento existente. Quem define o tempo de
 * trabalho é sempre a oficina; o pedido do cliente só traz o horário de chegada. */
export function AjustarHorarioModal({ agendamento: ag, modo, getOcupados, onSave, onClose }: AjustarHorarioModalProps) {
  const { isMobile } = useResponsive();
  const [data, setData] = useState(ag.data);
  const [inicio, setInicio] = useState(ag.horaInicio);
  const [duracao, setDuracao] = useState(() => {
    const d = duracaoEmMinutos(ag.horaInicio, ag.horaFim);
    return d > 0 ? d : DEFAULT_DURATION_MINUTES;
  });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const hoje = toISODate(new Date());
  const { horaAbertura, horaFechamento } = lerHorarioFuncionamento();

  const duracaoOk = duracao >= MIN_DURATION_MINUTES && duracao <= MAX_DURATION_MINUTES;
  const inicioOk = /^\d{2}:\d{2}$/.test(inicio);
  const fim = inicioOk ? minutesToTime(timeToMinutes(inicio) + duracao) : '';

  const ocupados = useMemo(() => getOcupados(data, ag.id), [getOcupados, data, ag.id]);
  const conflito = inicioOk && duracaoOk ? acharConflito(inicio, fim, ocupados) : undefined;
  const foraDoExpediente = inicioOk && duracaoOk
    && (timeToMinutes(inicio) < timeToMinutes(horaAbertura) || timeToMinutes(fim) > timeToMinutes(horaFechamento));
  const dataPassada = !data || data < hoje;

  const erro = !duracaoOk ? 'Informe uma duração válida.'
    : !inicioOk ? 'Informe o horário de início.'
    : foraDoExpediente ? `O serviço precisa caber no expediente (${horaAbertura} – ${horaFechamento}).`
    : conflito ? `Conflita com outro agendamento (${conflito.horaInicio} – ${conflito.horaFim}).`
    : dataPassada && data !== ag.data ? 'Escolha uma data de hoje em diante.'
    : null;

  const handleSalvar = async () => {
    if (erro || salvando) return;
    const changes: Partial<Agendamento> = {};
    if (data !== ag.data) changes.data = data;
    if (inicio !== ag.horaInicio) changes.horaInicio = inicio;
    if (fim !== ag.horaFim) changes.horaFim = fim;
    if (modo === 'confirmar') changes.status = 'agendado';
    setSalvando(true);
    setErroSalvar(null);
    try {
      await onSave(changes);
      onClose();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setSalvando(false);
    }
  };

  const rotulo: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: tokens.color.muted, marginBottom: 6,
  };
  const campo: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${tokens.color.border}`,
    fontSize: '0.9rem', boxSizing: 'border-box',
  };
  const confirmar = modo === 'confirmar';

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{confirmar ? 'Confirmar pedido' : 'Ajustar horário'}</div>
            <div className="dashboard-modal__subtitle">{ag.cliente} · {ag.veiculo}</div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        <div className="dashboard-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {confirmar && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}`, fontSize: '0.82rem', color: tokens.color.textSecond }}>
              O cliente pediu {formatDateBR(ag.data)} às {ag.horaInicio}. Defina quanto tempo o serviço vai levar
              e confirme — o cliente será avisado.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            <div>
              <div style={rotulo}>Data</div>
              <input type="date" value={data} min={hoje} onChange={e => setData(e.target.value)} style={campo} />
            </div>
            <div>
              <div style={rotulo}>Início</div>
              <input type="time" step={900} value={inicio} onChange={e => setInicio(e.target.value)} style={campo} />
            </div>
          </div>

          <div>
            <div style={rotulo}>Duração do serviço</div>
            <DuracaoSelector value={duracao} onChange={setDuracao} />
          </div>

          {inicioOk && duracaoOk && (
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: tokens.color.text }}>
              Termina às <span style={{ fontFamily: tokens.fontMono }}>{fim}</span> ({formatDuracao(duracao)})
            </div>
          )}

          {(erro || erroSalvar) && (
            <div style={{ padding: '9px 12px', borderRadius: 9, background: tokens.color.critBg, border: `1px solid ${tokens.color.critBorder}`, color: tokens.color.crit, fontSize: '0.8rem', fontWeight: 600 }}>
              {erroSalvar ?? erro}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, background: 'var(--color-surface)', borderRadius: '0 0 20px 20px' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.muted, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!!erro || salvando}
            style={{
              padding: '9px 22px', borderRadius: 10, border: 'none',
              background: erro ? tokens.color.border : tokens.color.ferrari,
              color: erro ? tokens.color.muted : 'white',
              cursor: erro ? 'not-allowed' : 'pointer', fontSize: '0.84rem', fontWeight: 700,
            }}
          >
            {salvando ? 'Salvando…' : confirmar ? 'Confirmar pedido' : 'Salvar horário'}
          </button>
        </div>
      </div>
    </div>
  );
}
