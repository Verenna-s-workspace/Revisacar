import { Icons } from '../Icons';
import { tokens } from '../../../constants';
import { formatDuracaoDesde } from '../../../utils/atendimento_utils';
import type { Agendamento } from '../../../types/agendamento';
import type { ItemKanban, OSAtendimento } from '../../../types/atendimento';

interface OSKanbanCardProps {
  item: ItemKanban;
  /** Preenchido pela AtendimentoPage (Fase 6/8) — nº de itens de peças vinculadas via Kit. */
  qtdPecas?: number;
  /** Preenchido pela AtendimentoPage (Fase 6/8) — true se o Histórico Express indicar um possível retorno. */
  possivelRetorno?: boolean;
  onAbrir: (ordem: OSAtendimento) => void;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
}

const PRIORIDADE_CFG = {
  vip: { label: 'VIP', color: tokens.color.warn, bg: tokens.color.warnBg, border: tokens.color.warnBorder },
  garantia: { label: 'Garantia', color: tokens.color.ok, bg: tokens.color.okBg, border: tokens.color.okBorder },
} as const;

function Pill({ label, icon, color, bg, border }: { label: string; icon?: JSX.Element; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 99,
        fontSize: '0.68rem',
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function CardShell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="dashboard-card"
      style={{
        padding: '12px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  );
}

export function OSKanbanCard({ item, qtdPecas, possivelRetorno, onAbrir, onIniciarAtendimento }: OSKanbanCardProps) {
  // ── Item ainda sem OS: agendamento de hoje aguardando início ────────────────
  if (item.tipo === 'agendamento') {
    const { agendamento } = item;
    return (
      <CardShell>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: tokens.color.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agendamento.cliente}
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.7rem',
              fontWeight: 700,
              color: tokens.color.muted,
              background: tokens.color.surfaceHigh,
              padding: '2px 7px',
              borderRadius: 99,
            }}
          >
            {agendamento.horaInicio}
          </span>
        </div>
        <div style={{ fontSize: '0.76rem', color: tokens.color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agendamento.veiculo} · {agendamento.placa}
        </div>
        <button
          onClick={() => onIniciarAtendimento(agendamento)}
          style={{
            marginTop: 2,
            padding: '7px 10px',
            background: tokens.color.ferrari,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.76rem',
            fontWeight: 700,
          }}
        >
          Iniciar Atendimento
        </button>
      </CardShell>
    );
  }

  // ── Item com OS de verdade ───────────────────────────────────────────────────
  const { ordem } = item;
  const prioridadeCfg = ordem.prioridade ? PRIORIDADE_CFG[ordem.prioridade] : null;
  const emExecucao = ordem.status === 'rascunho' && !!ordem.iniciadoEm;

  return (
    <CardShell onClick={() => onAbrir(ordem)}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: tokens.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ordem.cliente}
      </div>
      <div style={{ fontSize: '0.76rem', color: tokens.color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ordem.modelo} · {ordem.placa}
      </div>

      {(prioridadeCfg || possivelRetorno || !!qtdPecas) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {prioridadeCfg && <Pill label={prioridadeCfg.label} color={prioridadeCfg.color} bg={prioridadeCfg.bg} border={prioridadeCfg.border} />}
          {possivelRetorno && (
            <Pill label="Possível retorno" color={tokens.color.crit} bg={tokens.color.critBg} border={tokens.color.critBorder} />
          )}
          {!!qtdPecas && (
            <Pill
              label={`${qtdPecas} ${qtdPecas === 1 ? 'item' : 'itens'}`}
              icon={<span style={{ fontSize: '0.7rem' }}>📦</span>}
              color={tokens.color.textSecond}
              bg={tokens.color.surfaceHigh}
              border={tokens.color.border}
            />
          )}
        </div>
      )}

      {emExecucao && ordem.iniciadoEm && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: tokens.color.muted, marginTop: 1 }}>
          <span style={{ display: 'flex' }}>{Icons.clock}</span>
          {formatDuracaoDesde(ordem.iniciadoEm)}
        </div>
      )}
    </CardShell>
  );
}
