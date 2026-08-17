import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { useResponsive } from '../../../components/ui';
import { Input } from '../../../components/inputs/input';

interface EstoqueFiltersProps {
  busca: string;
  onBusca: (v: string) => void;
  somenteBaixo?: boolean;
  onSomenteBaixo?: (v: boolean) => void;
  /** Só faz sentido dentro de uma categoria selecionada — a visão "estoque baixo" já é o filtro. */
  mostrarSomenteBaixo?: boolean;
}

export function EstoqueFilters({ busca, onBusca, somenteBaixo, onSomenteBaixo, mostrarSomenteBaixo }: EstoqueFiltersProps) {
  const { isMobile } = useResponsive();

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
          name="busca_estoque"
          type="search"
          value={busca}
          onChangeValue={onBusca}
          placeholder="Buscar por nome ou aplicação..."
        />
      </div>

      {mostrarSomenteBaixo && onSomenteBaixo && (
        <button
          onClick={() => onSomenteBaixo(!somenteBaixo)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
            border: `1px solid ${somenteBaixo ? tokens.color.warn : tokens.color.border}`,
            background: somenteBaixo ? tokens.color.warnBg : 'transparent',
            color: somenteBaixo ? tokens.color.warn : tokens.color.textSecond,
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ display: 'flex' }}>{Icons.alert}</span>
          Só estoque baixo
        </button>
      )}
    </div>
  );
}
