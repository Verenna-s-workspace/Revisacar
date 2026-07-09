import { useState } from 'react';
import { tokens } from '../../../constants';
import { emptyFiltros } from '../../../utils/clientes_utils';
import { CLIENTE_STATUS_ORDER, CLIENTE_STATUS_CONFIG } from './StatusBadge';
import type { ClienteFiltros, ClienteStatusFiltro } from '../../../types/cliente';

interface ClientFilterModalProps {
  filtros: ClienteFiltros;
  onApply: (f: ClienteFiltros) => void;
  onClose: () => void;
}

const STATUS_OPTS: { val: ClienteStatusFiltro; label: string }[] = [
  { val: 'todos', label: 'Todos' },
  ...CLIENTE_STATUS_ORDER.map(s => ({ val: s, label: CLIENTE_STATUS_CONFIG[s].label })),
];

export function ClientFilterModal({ filtros, onApply, onClose }: ClientFilterModalProps) {
  const [f, setF] = useState<ClienteFiltros>(filtros);

  const set = <K extends keyof ClienteFiltros>(key: K, value: ClienteFiltros[K]) =>
    setF(prev => ({ ...prev, [key]: value }));

  const labelStyle: React.CSSProperties = {
    fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 6, display: 'block',
  };

  const handleClear = () => setF(emptyFiltros());

  const handleApply = () => {
    onApply(f);
    onClose();
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">Filtros de Pesquisa</div>
            <div className="dashboard-modal__subtitle">Refine a listagem de clientes</div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        <div className="dashboard-modal__body">
          <div>
            <label style={labelStyle}>Status do Cliente</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {STATUS_OPTS.map(o => {
                const active = f.status === o.val;
                return (
                  <button
                    key={o.val}
                    onClick={() => set('status', o.val)}
                    style={{
                      padding: '9px 12px', borderRadius: 10,
                      border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
                      background: active ? tokens.color.ferrariMid : tokens.color.bg,
                      color: active ? tokens.color.ferrari : tokens.color.text,
                      fontWeight: active ? 700 : 500, fontSize: '0.8rem',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: tokens.fontSans,
                      textAlign: 'left',
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Estrutura de Cadastro</label>
            <button
              onClick={() => set('semVeiculos', !f.semVeiculos)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: 10,
                border: `1.5px solid ${f.semVeiculos ? tokens.color.ferrari : tokens.color.border}`,
                background: f.semVeiculos ? tokens.color.ferrariMid : tokens.color.bg,
                color: f.semVeiculos ? tokens.color.ferrari : tokens.color.text,
                fontWeight: f.semVeiculos ? 700 : 500, fontSize: '0.82rem',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: tokens.fontSans,
              }}
            >
              Somente clientes sem veículos cadastrados
              <span
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `1.5px solid ${f.semVeiculos ? tokens.color.ferrari : tokens.color.border}`,
                  background: f.semVeiculos ? tokens.color.ferrari : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem',
                }}
              >
                {f.semVeiculos && '✓'}
              </span>
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, background: 'white', borderRadius: '0 0 20px 20px' }}>
          <button
            onClick={handleClear}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'transparent', color: tokens.color.ferrari, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700 }}
          >
            Limpar Filtros
          </button>
          <button
            onClick={handleApply}
            style={{ padding: '9px 26px', borderRadius: 10, border: 'none', background: tokens.color.ferrari, color: 'white', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, boxShadow: tokens.shadow.ferrari }}
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
