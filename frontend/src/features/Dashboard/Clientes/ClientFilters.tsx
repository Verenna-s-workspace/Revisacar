import { tokens } from '../../../constants';
import { ClienteIcons } from './icons';
import { filtrosAtivos } from '../../../utils/clientes_utils';
import type { ClienteFiltros } from '../../../types/cliente';
import { useResponsive } from '../../../components/ui';
import { Input } from '../../../components/inputs/input';

interface ClientFiltersProps {
  search: string;
  filtros: ClienteFiltros;
  onSearch: (v: string) => void;
  onOpenFilters: () => void;
  onClear: () => void;
}

export function ClientFilters({ search, filtros, onSearch, onOpenFilters, onClear }: ClientFiltersProps) {
  const { isMobile } = useResponsive();
  const hasActive = filtrosAtivos(filtros);

  return (
    <div
      style={{
        background: 'white', borderBottom: `1px solid ${tokens.color.border}`,
        padding: isMobile ? '10px 14px' : '12px 28px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Input
          name="busca_clientes"
          type="search"
          value={search}
          onChangeValue={onSearch}
          placeholder="Buscar por nome, CPF, telefone, e-mail, placa ou veículo..."
        />
      </div>

      <button
        onClick={onOpenFilters}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 13px', borderRadius: 9,
          border: `1.5px solid ${hasActive ? tokens.color.ferrari : tokens.color.border}`,
          background: hasActive ? tokens.color.ferrariMid : 'transparent',
          color: hasActive ? tokens.color.ferrari : tokens.color.muted,
          fontSize: '0.8rem', fontWeight: hasActive ? 700 : 400,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: tokens.fontSans,
        }}
      >
        <span style={{ display: 'flex' }}>{ClienteIcons.filter}</span>
        {!isMobile && 'Filtros'}
        {hasActive && <span style={{ fontSize: '0.65rem', opacity: 0.8, marginLeft: 1 }}>●</span>}
      </button>

      {hasActive && (
        <button
          onClick={onClear}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: tokens.color.crit, fontSize: '0.78rem', fontWeight: 600,
            whiteSpace: 'nowrap', flexShrink: 0, fontFamily: tokens.fontSans, padding: '7px 4px',
          }}
        >
          Limpar
        </button>
      )}
    </div>
  );
}
