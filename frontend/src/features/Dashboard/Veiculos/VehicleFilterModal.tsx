import { useState } from 'react';
import { tokens } from '../../../constants';
import { CATEGORIA_OPTIONS, MARCAS_SUGERIDAS, emptyFiltros } from '../../../utils/veiculos_utils';
import { VEICULO_STATUS_ORDER, VEICULO_STATUS_CONFIG } from './StatusBadge';
import type { VeiculoFiltros, VeiculoStatus, VeiculoVinculo, VeiculoCategoria } from '../../../types/veiculo';

interface VehicleFilterModalProps {
  filtros: VeiculoFiltros;
  onApply: (f: VeiculoFiltros) => void;
  onClose: () => void;
}

const VINCULO_OPTS: { val: VeiculoVinculo; label: string }[] = [
  { val: 'todos', label: 'Todos' },
  { val: 'com',   label: 'Com Proprietário' },
  { val: 'sem',   label: 'Sem Proprietário' },
];

const CATEGORIA_FILTER_OPTS: { val: VeiculoCategoria | 'todas'; label: string }[] = [
  { val: 'todas', label: 'Todas' },
  ...CATEGORIA_OPTIONS.map(c => ({ val: c.value, label: c.label })),
];

export function VehicleFilterModal({ filtros, onApply, onClose }: VehicleFilterModalProps) {
  const [f, setF] = useState<VeiculoFiltros>(filtros);

  const set = <K extends keyof VeiculoFiltros>(key: K, value: VeiculoFiltros[K]) =>
    setF(prev => ({ ...prev, [key]: value }));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: `1px solid ${tokens.color.border}`, background: tokens.color.bg,
    fontSize: '0.85rem', color: tokens.color.text, outline: 'none',
    fontFamily: tokens.fontSans, boxSizing: 'border-box',
  };
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
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">Filtros de Pesquisa</div>
            <div className="dashboard-modal__subtitle">Refine a listagem de veículos da frota</div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        <div className="dashboard-modal__body">
          {/* Vínculo com proprietário */}
          <div>
            <label style={labelStyle}>Vínculo com Proprietário</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {VINCULO_OPTS.map(o => {
                const active = f.vinculo === o.val;
                return (
                  <button
                    key={o.val}
                    onClick={() => set('vinculo', o.val)}
                    style={{
                      flex: '1 1 140px', padding: '9px 14px', borderRadius: 10,
                      border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
                      background: active ? tokens.color.ferrariMid : tokens.color.bg,
                      color: active ? tokens.color.ferrari : tokens.color.text,
                      fontWeight: active ? 700 : 500, fontSize: '0.82rem',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: tokens.fontSans,
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <div>
              <label style={labelStyle}>Marca</label>
              <select
                value={f.marca}
                onChange={e => set('marca', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Todas as marcas</option>
                {MARCAS_SUGERIDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Modelo</label>
              <input
                style={inputStyle}
                placeholder="Ex: Corolla, HB20..."
                value={f.modelo}
                onChange={e => set('modelo', e.target.value)}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Categoria</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                {CATEGORIA_FILTER_OPTS.map(cat => {
                  const active = f.categoria === cat.val;
                  return (
                    <button
                      key={cat.val}
                      onClick={() => set('categoria', cat.val)}
                      style={{
                        padding: '8px 6px', borderRadius: 9,
                        border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
                        background: active ? tokens.color.ferrariMid : 'transparent',
                        color: active ? tokens.color.ferrari : tokens.color.muted,
                        fontWeight: active ? 700 : 500, fontSize: '0.74rem',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: tokens.fontSans,
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Ano de Fabricação</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} placeholder="De" type="number" value={f.anoDe} onChange={e => set('anoDe', e.target.value)} />
                <input style={inputStyle} placeholder="Até" type="number" value={f.anoAte} onChange={e => set('anoAte', e.target.value)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Cor</label>
              <input style={inputStyle} placeholder="Ex: Branco, Prata..." value={f.cor} onChange={e => set('cor', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Proprietário</label>
              <input style={inputStyle} placeholder="Nome ou CPF/CNPJ..." value={f.proprietario} onChange={e => set('proprietario', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Status do Veículo</label>
              <select
                value={f.status}
                onChange={e => set('status', e.target.value as VeiculoStatus | 'todos')}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="todos">Todos os status</option>
                {VEICULO_STATUS_ORDER.map(s => (
                  <option key={s} value={s}>{VEICULO_STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
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
