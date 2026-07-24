import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { useResponsive } from '../../../components/ui';

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
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180,
          background: tokens.color.bg, borderRadius: 9,
          border: `1px solid ${tokens.color.border}`, padding: '7px 12px',
        }}
      >
        <span style={{ color: tokens.color.muted, display: 'flex', flexShrink: 0 }}>{Icons.search}</span>
        <input
          value={busca}
          onChange={e => onBusca(e.target.value)}
          placeholder="Buscar por nome ou aplicação..."
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: '0.83rem', color: tokens.color.text, width: '100%',
            fontFamily: tokens.fontSans,
          }}
        />
        {busca && (
          <button
            onClick={() => onBusca('')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 2, fontSize: '1.1rem', lineHeight: 1 }}
          >
            ×
          </button>
        )}
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
