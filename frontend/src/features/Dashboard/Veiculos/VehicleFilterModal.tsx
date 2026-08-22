import { useState } from 'react';
import { tokens } from '../../../constants';
import { CATEGORIA_OPTIONS, MARCAS_SUGERIDAS, emptyFiltros } from '../../../utils/veiculos_utils';
import { VEICULO_STATUS_ORDER, VEICULO_STATUS_CONFIG } from './StatusBadge';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
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

const STATUS_SELECT_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  ...VEICULO_STATUS_ORDER.map(s => ({ value: s, label: VEICULO_STATUS_CONFIG[s].label })),
];

export function VehicleFilterModal({ filtros, onApply, onClose }: VehicleFilterModalProps) {
  const [f, setF] = useState<VeiculoFiltros>(filtros);

  const set = <K extends keyof VeiculoFiltros>(key: K, value: VeiculoFiltros[K]) =>
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

          <div className="dashboard-form-grid-2col" style={{ gap: '14px 20px' }}>
            <Select name="marca_filtro" label="Marca" value={f.marca} placeholder="Todas as marcas" options={MARCAS_SUGERIDAS} onChangeValue={v => set('marca', v)} />
            <Input name="modelo_filtro" label="Modelo" placeholder="Ex: Corolla, HB20..." value={f.modelo} onChangeValue={v => set('modelo', v)} />

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
                <Input name="ano_de" placeholder="De" type="number" value={f.anoDe} onChangeValue={v => set('anoDe', v)} />
                <Input name="ano_ate" placeholder="Até" type="number" value={f.anoAte} onChangeValue={v => set('anoAte', v)} />
              </div>
            </div>
            <Input name="cor_filtro" label="Cor" placeholder="Ex: Branco, Prata..." value={f.cor} onChangeValue={v => set('cor', v)} />

            <Input name="proprietario_filtro" label="Proprietário" placeholder="Nome ou CPF/CNPJ..." value={f.proprietario} onChangeValue={v => set('proprietario', v)} />
            <Select
              name="status_filtro"
              label="Status do Veículo"
              value={f.status}
              options={STATUS_SELECT_OPTIONS}
              onChangeValue={v => set('status', v as VeiculoStatus | 'todos')}
            />
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
