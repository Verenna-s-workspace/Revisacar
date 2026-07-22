import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { useResponsive } from '../../../components/ui';

interface ServicoFiltersProps {
  search: string;
  categoria: string;
  categoriasDisponiveis: string[];
  onSearch: (v: string) => void;
  onCategoria: (v: string) => void;
}

export function ServicoFilters({ search, categoria, categoriasDisponiveis, onSearch, onCategoria }: ServicoFiltersProps) {
  const { isMobile } = useResponsive();
  const hasActive = search !== '' || categoria !== 'todas';

  return (
    <div
      style={{
        background: 'white', borderBottom: `1px solid ${tokens.color.border}`,
        padding: isMobile ? '10px 14px' : '12px 28px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180,
          background: tokens.color.bg, borderRadius: 9,
          border: `1px solid ${tokens.color.border}`, padding: '7px 12px',
        }}
      >
        <span style={{ color: tokens.color.muted, display: 'flex', flexShrink: 0 }}>{Icons.search}</span>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar serviço por nome..."
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: '0.83rem', color: tokens.color.text, width: '100%',
            fontFamily: tokens.fontSans,
          }}
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 2, fontSize: '1.1rem', lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      <select className="dashboard-card__select" value={categoria} onChange={e => onCategoria(e.target.value)}>
        <option value="todas">Todas as categorias</option>
        {categoriasDisponiveis.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {hasActive && (
        <button
          onClick={() => { onSearch(''); onCategoria('todas'); }}
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
