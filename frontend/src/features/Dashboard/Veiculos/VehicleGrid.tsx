import { useEffect, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { VeiculoIcons } from './icons';
import { VehicleCard } from './VehicleCard';
import { useResponsive } from '../../../components/ui';
import type { VeiculoCadastrado } from '../../../types/veiculo';

interface VehicleGridProps {
  veiculos: VeiculoCadastrado[];
  loading?: boolean;
  hasAnyVeiculo: boolean;
  hasActiveFilters: boolean;
  onView: (v: VeiculoCadastrado) => void;
  onEdit: (v: VeiculoCadastrado) => void;
  onChangeOwner: (v: VeiculoCadastrado) => void;
  onUnlinkOwner: (v: VeiculoCadastrado) => void;
  onDelete: (v: VeiculoCadastrado) => void;
  onClearFilters: () => void;
  onNovoVeiculo: () => void;
}

const PAGE_SIZE = 12;

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 18, border: `1px solid ${tokens.color.border}`, overflow: 'hidden', background: 'white' }}>
      <div style={{ height: 168, background: tokens.color.surfaceHigh }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 16, width: '70%', borderRadius: 5, background: tokens.color.surfaceHigh }} />
        <div style={{ height: 11, width: '50%', borderRadius: 5, background: tokens.color.surfaceHigh }} />
        <div style={{ height: 28, width: '100%', borderRadius: 5, background: tokens.color.surfaceHigh, marginTop: 4 }} />
      </div>
    </div>
  );
}

export function VehicleGrid({
  veiculos, loading, hasAnyVeiculo, hasActiveFilters,
  onView, onEdit, onChangeOwner, onUnlinkOwner, onDelete, onClearFilters, onNovoVeiculo,
}: VehicleGridProps) {
  const { isMobile, isTablet } = useResponsive();
  const columns = isMobile ? 1 : isTablet ? 2 : 4;
  const [page, setPage] = useState(1);

  // Sempre que a lista filtrada mudar de tamanho (nova busca/filtro), volta para a página 1.
  useEffect(() => { setPage(1); }, [veiculos.length]);

  const totalPages = Math.max(1, Math.ceil(veiculos.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = veiculos.slice(start, start + PAGE_SIZE);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 18 }}>
        {Array.from({ length: columns * 2 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (veiculos.length === 0) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', textAlign: 'center', background: 'white',
          borderRadius: 18, border: `1px dashed ${tokens.color.border}`,
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: tokens.color.surfaceHigh,
          color: tokens.color.ghost, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <span style={{ display: 'flex', transform: 'scale(1.6)' }}>{Icons.car}</span>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: tokens.color.text, marginBottom: 6 }}>
          {hasAnyVeiculo ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}
        </div>
        <div style={{ fontSize: '0.84rem', color: tokens.color.muted, maxWidth: 360, lineHeight: 1.5, marginBottom: 18 }}>
          {hasAnyVeiculo
            ? 'Ajuste a busca ou os filtros aplicados para encontrar o veículo desejado.'
            : 'Comece cadastrando o primeiro veículo da frota da sua oficina.'}
        </div>
        {hasActiveFilters ? (
          <button
            onClick={onClearFilters}
            style={{ padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${tokens.color.ferrari}`, background: 'transparent', color: tokens.color.ferrari, fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
          >
            Limpar Filtros
          </button>
        ) : (
          <button
            onClick={onNovoVeiculo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: 'none', background: tokens.color.ferrari, color: 'white', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', boxShadow: tokens.shadow.ferrari }}
          >
            <span style={{ display: 'flex' }}>{Icons.plus}</span>
            Cadastrar Veículo
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: isMobile ? 14 : 18 }}>
        {pageItems.map(v => (
          <VehicleCard
            key={v.id}
            veiculo={v}
            onView={() => onView(v)}
            onEdit={() => onEdit(v)}
            onChangeOwner={() => onChangeOwner(v)}
            onUnlinkOwner={() => onUnlinkOwner(v)}
            onDelete={() => onDelete(v)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 4px 4px', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: '0.76rem', color: tokens.color.muted }}>
          Exibindo {start + 1}–{Math.min(start + PAGE_SIZE, veiculos.length)} de {veiculos.length} veículo{veiculos.length === 1 ? '' : 's'}
        </span>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PageBtn disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{VeiculoIcons.chevR && <span style={{ display: 'flex', transform: 'rotate(180deg)' }}>{VeiculoIcons.chevR}</span>}</PageBtn>
            {Array.from({ length: totalPages }).map((_, i) => {
              const n = i + 1;
              const active = n === safePage;
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', border: 'none',
                    background: active ? tokens.color.ferrari : 'transparent',
                    color: active ? 'white' : tokens.color.text,
                    fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              );
            })}
            <PageBtn disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>{VeiculoIcons.chevR}</PageBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function PageBtn({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent',
        color: disabled ? tokens.color.ghost : tokens.color.muted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
