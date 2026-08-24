import { useEffect, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { ClienteIcons } from './icons';
import { ClientCard } from './ClientCard';
import { useResponsive } from '../../../components/ui';
import type { ClienteComDados } from '../../../types/cliente';

interface ClientGridProps {
  clientes: ClienteComDados[];
  loading?: boolean;
  hasAnyCliente: boolean;
  hasActiveFilters: boolean;
  onView: (c: ClienteComDados) => void;
  onEdit: (c: ClienteComDados) => void;
  onSchedule: (c: ClienteComDados) => void;
  onDelete: (c: ClienteComDados) => void;
  onGoToAgendamento: (c: ClienteComDados) => void;
  onClearFilters: () => void;
  onNovoCliente: () => void;
}

const PAGE_SIZE = 12;

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 20, border: `1px solid ${tokens.color.border}`, overflow: 'hidden', background: 'white' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: tokens.color.surfaceHigh, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: '70%', borderRadius: 4, background: tokens.color.surfaceHigh, marginBottom: 8 }} />
          <div style={{ height: 10, width: '50%', borderRadius: 4, background: tokens.color.surfaceHigh }} />
        </div>
      </div>
      <div style={{ padding: '18px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 11, width: '80%', borderRadius: 4, background: tokens.color.surfaceHigh }} />
        <div style={{ height: 11, width: '60%', borderRadius: 4, background: tokens.color.surfaceHigh }} />
        <div style={{ height: 30, width: '100%', borderRadius: 8, background: tokens.color.surfaceHigh, marginTop: 6 }} />
      </div>
    </div>
  );
}

export function ClientGrid({
  clientes, loading, hasAnyCliente, hasActiveFilters,
  onView, onEdit, onSchedule, onDelete, onGoToAgendamento, onClearFilters, onNovoCliente,
}: ClientGridProps) {
  const { isMobile, isTablet } = useResponsive();
  const columns = isMobile ? 1 : isTablet ? 2 : 4;
  const [page, setPage] = useState(1);

  // Sempre que a lista filtrada mudar de tamanho (nova busca/filtro), volta para a página 1.
  useEffect(() => { setPage(1); }, [clientes.length]);

  const totalPages = Math.max(1, Math.ceil(clientes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = clientes.slice(start, start + PAGE_SIZE);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 18 }}>
        {Array.from({ length: columns * 2 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (clientes.length === 0) {
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
          <span style={{ display: 'flex', transform: 'scale(1.6)' }}>{Icons.user}</span>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: tokens.color.text, marginBottom: 6 }}>
          {hasAnyCliente ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
        </div>
        <div style={{ fontSize: '0.84rem', color: tokens.color.muted, maxWidth: 360, lineHeight: 1.5, marginBottom: 18 }}>
          {hasAnyCliente
            ? 'Ajuste a busca ou os filtros aplicados para encontrar o cliente desejado.'
            : 'Comece cadastrando o primeiro cliente da carteira da sua oficina.'}
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
            onClick={onNovoCliente}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: 'none', background: tokens.color.ferrari, color: 'white', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', boxShadow: tokens.shadow.ferrari }}
          >
            <span style={{ display: 'flex' }}>{Icons.plus}</span>
            Cadastrar Cliente
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: isMobile ? 14 : 18 }}>
        {pageItems.map(c => (
          <ClientCard
            key={c.id}
            cliente={c}
            onView={() => onView(c)}
            onEdit={() => onEdit(c)}
            onSchedule={() => onSchedule(c)}
            onDelete={() => onDelete(c)}
            onGoToAgendamento={onGoToAgendamento}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 4px 4px', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: '0.76rem', color: tokens.color.muted }}>
          Exibindo {start + 1}–{Math.min(start + PAGE_SIZE, clientes.length)} de {clientes.length} cliente{clientes.length === 1 ? '' : 's'}
        </span>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PageBtn disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <span style={{ display: 'flex', transform: 'rotate(180deg)' }}>{ClienteIcons.chevR}</span>
            </PageBtn>
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
            <PageBtn disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>{ClienteIcons.chevR}</PageBtn>
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
