import { tokens } from '../../../constants';
import { useResponsive } from '../../../components/ui';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';

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
      <div style={{ flex: 1, minWidth: 180 }}>
        <Input
          name="busca_servicos"
          type="search"
          value={search}
          onChangeValue={onSearch}
          placeholder="Buscar serviço por nome..."
        />
      </div>

      <div style={{ minWidth: 200 }}>
        <Select
          name="categoria_servico_filtro"
          value={categoria}
          onChangeValue={onCategoria}
          options={['todas', ...categoriasDisponiveis].map(c => ({ value: c, label: c === 'todas' ? 'Todas as categorias' : c }))}
        />
      </div>

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
