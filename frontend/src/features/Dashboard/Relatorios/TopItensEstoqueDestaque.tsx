import { tokens } from '../../../constants';
import { Icons, CATEGORIA_ICON } from '../Icons';
import { formatBRL } from '../../../utils/dashboard';
import { formatarNumero } from '../../../utils/relatorios';
import type { ItemEstoqueMovimentado } from '../../../types/estoque';

function FotoOuIcone({ item, tamanho }: { item: ItemEstoqueMovimentado; tamanho: number }) {
  if (item.fotoDataUrl) {
    return (
      <img
        src={item.fotoDataUrl}
        alt={item.nome}
        style={{ width: tamanho, height: tamanho, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: tamanho, height: tamanho, borderRadius: 12, flexShrink: 0,
        background: tokens.color.ferrariMid, color: tokens.color.ferrari,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: tamanho * 0.42,
      }}
    >
      {CATEGORIA_ICON[item.categoria] ?? Icons.box}
    </div>
  );
}

interface TopItensEstoqueDestaqueProps {
  itens: ItemEstoqueMovimentado[];   // já ordenados, maior primeiro — usa os 4 primeiros
  isMobile: boolean;
  onVerItem: (nome: string) => void;
}

export function TopItensEstoqueDestaque({ itens, isMobile, onVerItem }: TopItensEstoqueDestaqueProps) {
  const [destaque, ...resto] = itens;
  const secundarios = resto.slice(0, 3);

  if (!destaque) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr',
        gap: isMobile ? 14 : 18,
      }}
    >
      {/* item #1 — destaque grande */}
      <div
        style={{
          position: 'relative',
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          padding: isMobile ? 16 : 20,
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 12, left: 12,
            background: tokens.color.ferrari, color: 'white',
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em',
            padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase',
          }}
        >
          Mais Movimentado
        </span>

        <button
          onClick={() => onVerItem(destaque.nome)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginTop: 26 }}
          title={`Ver ${destaque.nome} no Estoque`}
        >
          <FotoOuIcone item={destaque} tamanho={isMobile ? 84 : 108} />
        </button>

        <div style={{ flex: 1, minWidth: 160, marginTop: 26 }}>
          <span
            style={{
              display: 'inline-block', padding: '3px 8px', background: tokens.color.surfaceHigh,
              color: tokens.color.textSecond, borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, marginBottom: 6,
            }}
          >
            {destaque.categoria || 'Geral'}
          </span>

          <button
            onClick={() => onVerItem(destaque.nome)}
            style={{
              display: 'block', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              textAlign: 'left', fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800,
              color: tokens.color.text, lineHeight: 1.25, marginBottom: 8,
            }}
          >
            {destaque.nome}
          </button>

          {destaque.preco !== undefined && (
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.ferrari, marginBottom: 10 }}>
              {formatBRL(destaque.preco)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 18, marginBottom: 14, flexWrap: 'wrap' }}>
            {destaque.quantidadeAtual !== undefined && (
              <div>
                <div style={{ fontSize: '0.66rem', color: tokens.color.muted, textTransform: 'uppercase', fontWeight: 700 }}>Em estoque</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>{formatarNumero(destaque.quantidadeAtual)} un.</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.66rem', color: tokens.color.muted, textTransform: 'uppercase', fontWeight: 700 }}>Movimentado no período</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>{formatarNumero(destaque.quantidade)} un.</div>
            </div>
          </div>

          <button
            onClick={() => onVerItem(destaque.nome)}
            style={{
              padding: '9px 18px', background: tokens.color.ferrari, color: 'white', border: 'none',
              borderRadius: 9, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Ver Item
          </button>
        </div>
      </div>

      {/* #2, #3, #4 — secundários */}
      {secundarios.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? `repeat(${secundarios.length}, 1fr)` : '1fr',
            gap: 10,
          }}
        >
          {secundarios.map((item, i) => (
            <button
              key={item.id ?? item.nome}
              onClick={() => onVerItem(item.nome)}
              style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10,
                flexDirection: isMobile ? 'column' : 'row',
                textAlign: isMobile ? 'center' : 'left',
                border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.md,
                padding: isMobile ? '10px 8px' : '10px 12px',
                background: 'transparent', cursor: 'pointer', minWidth: 0,
              }}
            >
              <FotoOuIcone item={item} tamanho={isMobile ? 40 : 44} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.66rem', color: tokens.color.muted, fontWeight: 700 }}>#{i + 2}</div>
                <div
                  style={{
                    fontSize: '0.8rem', fontWeight: 700, color: tokens.color.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {item.nome}
                </div>
                <div style={{ fontSize: '0.72rem', color: tokens.color.muted }}>
                  {formatarNumero(item.quantidade)} un. movimentadas
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
