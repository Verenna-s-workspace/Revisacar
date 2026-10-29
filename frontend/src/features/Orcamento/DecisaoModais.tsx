import { useState } from 'react';
import { tokens } from '../../constants';
import { btnAccent, btnGhost } from '../../components/ui';
import { AssinaturaPad } from '../../components/AssinaturaPad';
import { CANAIS, ROTULO_CANAL, LIMITES } from '../../utils/orcamento_utils';
import type { CanalAprovacao } from '../../types/orcamento';

const rotulo: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5,
};
const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontFamily: tokens.fontSans, fontSize: '0.88rem',
  color: tokens.color.text, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md, outline: 'none',
};

function Casca({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label={titulo}
      className="sheet-backdrop"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
      }}
    >
      <div className="sheet-panel" style={{
        background: tokens.color.card, borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90dvh',
        border: `1px solid ${tokens.color.border}`, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>{titulo}</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: tokens.color.muted, width: 44, height: 44, margin: '-10px -10px -10px 0' }}>×</button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

interface AprovarProps {
  versao: number;
  total: string;
  ocupado: boolean;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (canal: CanalAprovacao, observacao: string, assinatura: string | null) => void;
}

/** O mecânico registra a resposta que o cliente deu fora do sistema (ex.: WhatsApp). */
export function AprovarModal({ versao, total, ocupado, erro, onFechar, onConfirmar }: AprovarProps) {
  const [canal, setCanal] = useState<CanalAprovacao>('whatsapp');
  const [obs, setObs] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  return (
    <Casca titulo="Registrar aprovação do cliente" onFechar={onFechar}>
      <form
        onSubmit={e => { e.preventDefault(); if (!ocupado) onConfirmar(canal, obs, assinatura); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <p style={{ margin: 0, fontSize: '0.86rem', color: tokens.color.textSecond, lineHeight: 1.5 }}>
          O cliente aprovou o orçamento v{versao} ({total}). Depois disso a OS fica pronta para execução.
        </p>
        <div>
          <label style={rotulo} htmlFor="aprov-canal">COMO O CLIENTE APROVOU</label>
          <select id="aprov-canal" value={canal} onChange={e => setCanal(e.target.value as CanalAprovacao)} style={campo}>
            {CANAIS.map(c => <option key={c} value={c}>{ROTULO_CANAL[c]}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="aprov-obs">OBSERVAÇÃO (OPCIONAL)</label>
          <textarea id="aprov-obs" value={obs} maxLength={500} rows={3} onChange={e => setObs(e.target.value)}
            placeholder="Ex.: respondeu 'pode fazer' às 14h12" style={{ ...campo, resize: 'vertical' }} />
        </div>
        <div>
          <span style={rotulo}>ASSINATURA DO CLIENTE (OPCIONAL)</span>
          <AssinaturaPad onChange={setAssinatura} disabled={ocupado} />
        </div>
        {erro && <div role="alert" style={{ fontSize: '0.82rem', color: tokens.color.crit }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onFechar} style={btnGhost} disabled={ocupado}>Cancelar</button>
          <button type="submit" style={btnAccent} disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar aprovação'}</button>
        </div>
      </form>
    </Casca>
  );
}

interface RecusarProps {
  versao: number;
  aprovado: boolean;
  ocupado: boolean;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}

export function RecusarModal({ versao, aprovado, ocupado, erro, onFechar, onConfirmar }: RecusarProps) {
  const [motivo, setMotivo] = useState('');
  return (
    <Casca titulo={aprovado ? 'Cancelar orçamento aprovado' : 'Registrar recusa do cliente'} onFechar={onFechar}>
      <form
        onSubmit={e => { e.preventDefault(); if (!ocupado) onConfirmar(motivo); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <p style={{ margin: 0, fontSize: '0.86rem', color: tokens.color.textSecond, lineHeight: 1.5 }}>
          O orçamento v{versao} será encerrado e a OS ficará como recusada. Se o cliente quiser refazer,
          é só criar uma nova versão.
        </p>
        <div>
          <label style={rotulo} htmlFor="rec-motivo">MOTIVO (OPCIONAL)</label>
          <textarea id="rec-motivo" value={motivo} maxLength={LIMITES.motivo} rows={3} onChange={e => setMotivo(e.target.value)}
            placeholder="Ex.: achou o valor alto / vai resolver por conta própria" style={{ ...campo, resize: 'vertical' }} />
        </div>
        {erro && <div role="alert" style={{ fontSize: '0.82rem', color: tokens.color.crit }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onFechar} style={btnGhost} disabled={ocupado}>Voltar</button>
          <button type="submit" style={btnAccent} disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar recusa'}</button>
        </div>
      </form>
    </Casca>
  );
}
