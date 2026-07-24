import { tokens } from '../../../constants';
import { Icons, CATEGORIA_ICON } from '../Icons';
import { CATEGORIA_GRUPOS } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';

interface CategoriaGridProps {
  itens: EstoqueItem[];
  onSelecionar: (categoria: string) => void;
}

export function CategoriaGrid({ itens, onSelecionar }: CategoriaGridProps) {
  const contagem = new Map<string, number>();
  itens.forEach(i => {
    if (i.status !== 'ativo') return;
    contagem.set(i.categoria, (contagem.get(i.categoria) ?? 0) + 1);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {CATEGORIA_GRUPOS.map(({ grupo, categorias }) => (
        <div key={grupo}>
          <div
            style={{
              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: tokens.color.muted, marginBottom: 8,
            }}
          >
            {grupo}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 10 }}>
            {categorias.map(categoria => (
              <button
                key={categoria}
                onClick={() => onSelecionar(categoria)}
                className="dashboard-card"
                style={{
                  padding: '14px 10px', cursor: 'pointer', border: 'none', font: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: tokens.color.ferrariMid, color: tokens.color.ferrari,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {CATEGORIA_ICON[categoria] ?? Icons.box}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: tokens.color.text }}>{categoria}</div>
                <div style={{ fontSize: '0.66rem', color: tokens.color.muted }}>
                  {contagem.get(categoria) ?? 0} {(contagem.get(categoria) ?? 0) === 1 ? 'item' : 'itens'}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
