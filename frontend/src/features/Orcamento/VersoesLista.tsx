import { tokens } from '../../constants';
import { formatBRL } from '../../utils/dashboard';
import { dataBR, ROTULO_STATUS_ORCAMENTO } from '../../utils/orcamento_utils';
import type { Orcamento, StatusOrcamento } from '../../types/orcamento';

const COR: Record<StatusOrcamento, { cor: string; fundo: string }> = {
  rascunho: { cor: tokens.color.textSecond, fundo: tokens.color.surfaceHigh },
  enviado: { cor: tokens.color.warn, fundo: tokens.color.warnBg },
  aprovado: { cor: tokens.color.ok, fundo: tokens.color.okBg },
  recusado: { cor: tokens.color.crit, fundo: tokens.color.critBg },
  substituido: { cor: tokens.color.muted, fundo: tokens.color.surfaceHigh },
};

export function SeloStatusOrcamento({ status, vencido }: { status: StatusOrcamento; vencido?: boolean }) {
  const { cor, fundo } = vencido ? { cor: tokens.color.crit, fundo: tokens.color.critBg } : COR[status];
  return (
    <span style={{
      fontFamily: tokens.fontMono, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase',
      color: cor, background: fundo, borderRadius: tokens.radius.full, padding: '3px 10px', whiteSpace: 'nowrap',
    }}>
      {vencido ? 'Vencido' : ROTULO_STATUS_ORCAMENTO[status]}
    </span>
  );
}

interface Props {
  versoes: Orcamento[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}

/** Histórico: uma linha por versão; clicar mostra a versão (somente leitura, exceto o rascunho). */
export function VersoesLista({ versoes, selecionadaId, onSelecionar }: Props) {
  if (versoes.length < 2) return null;
  return (
    <div style={{ border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.lg, background: tokens.color.card, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontFamily: tokens.fontMono, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.subtle, borderBottom: `1px solid ${tokens.color.border}` }}>
        Versões
      </div>
      {versoes.map(v => {
        const ativa = v.id === selecionadaId;
        return (
          <button
            key={v.id} type="button" onClick={() => onSelecionar(v.id)} aria-current={ativa ? 'true' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px',
              background: ativa ? tokens.color.surfaceHigh : 'transparent', border: 'none',
              borderBottom: `1px solid ${tokens.color.border}`, cursor: 'pointer', fontFamily: tokens.fontSans,
            }}
          >
            <strong style={{ fontSize: '0.86rem', color: tokens.color.text }}>v{v.versao}</strong>
            <SeloStatusOrcamento status={v.status} vencido={v.vencido} />
            <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 700, color: tokens.color.text }}>{formatBRL(v.total)}</span>
            <span style={{ fontSize: '0.75rem', color: tokens.color.subtle }}>{dataBR(v.createdAt)}</span>
          </button>
        );
      })}
    </div>
  );
}
