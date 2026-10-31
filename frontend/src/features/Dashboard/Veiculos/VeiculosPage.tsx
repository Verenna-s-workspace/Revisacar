import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Sidebar, MobileNav, MobileTopbar } from '../Navigation';
import { useResponsive } from '../../../components/ui';
import { useVeiculos } from '../../../hooks/useVeiculos';
import { useClientes } from '../../../hooks/useClientes';
import { emptyFiltros, filtrosAtivos, veiculoParaPrefill } from '../../../utils/veiculos_utils';
import type { NavPage } from '../../../types/dashboard';
import type { OSPrefillInput } from '../../../types/atendimento';
import type { VeiculoCadastrado, VeiculoFiltros, NovoVeiculoInput, VeiculoProprietario } from '../../../types/veiculo';

import { VehicleStats } from './VehicleStats';
import { VehicleFilters } from './VehicleFilters';
import { VehicleFilterModal } from './VehicleFilterModal';
import { VehicleGrid } from './VehicleGrid';
import { VehicleDetailsModal } from './VehicleDetailsModal';
import { VehicleFormModal } from './VehicleFormModal';
import { ChangeOwnerModal } from './ChangeOwnerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface VeiculosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  /** "Nova OS" a partir de um veículo: abre o checklist já com os dados dele (e do cliente, se houver). */
  onNewOSComPrefill?: (prefill: OSPrefillInput) => void;
}

function applyFilters(list: VeiculoCadastrado[], search: string, f: VeiculoFiltros): VeiculoCadastrado[] {
  return list.filter(v => {
    if (f.marca && v.marca !== f.marca) return false;
    if (f.modelo && !v.modelo.toLowerCase().includes(f.modelo.toLowerCase())) return false;
    if (f.categoria !== 'todas' && v.categoria !== f.categoria) return false;
    if (f.anoDe && v.ano < Number(f.anoDe)) return false;
    if (f.anoAte && v.ano > Number(f.anoAte)) return false;
    if (f.cor && !v.cor.toLowerCase().includes(f.cor.toLowerCase())) return false;
    if (f.status !== 'todos' && v.status !== f.status) return false;
    if (f.vinculo === 'com' && !v.proprietario) return false;
    if (f.vinculo === 'sem' && !!v.proprietario) return false;
    if (f.proprietario) {
      const q = f.proprietario.toLowerCase();
      const matchNome = v.proprietario?.nome.toLowerCase().includes(q) ?? false;
      const matchDoc  = v.proprietario?.docCpfCnpj?.toLowerCase().includes(q) ?? false;
      if (!matchNome && !matchDoc) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        v.placa.toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        (v.proprietario?.nome.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });
}

export function VeiculosPage({ onNav, isMobile, onNewOS, onNewOSComPrefill }: VeiculosPageProps) {
  const { veiculos, loading, usingApi, erro, stats, addVeiculo, updateVeiculo, deleteVeiculo, changeOwner } = useVeiculos();
  // Clientes da carteira: é entre eles que o proprietário do veículo é escolhido (vínculo veículo ↔ cliente).
  const { clientes } = useClientes();

  const [search,          setSearch]          = useState('');
  const [filtros,         setFiltros]         = useState<VeiculoFiltros>(emptyFiltros());
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selected,        setSelected]        = useState<VeiculoCadastrado | null>(null);
  const [formOpen,        setFormOpen]        = useState(false);
  const [editing,         setEditing]         = useState<VeiculoCadastrado | null>(null);
  const [ownerTarget,     setOwnerTarget]     = useState<VeiculoCadastrado | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<VeiculoCadastrado | null>(null);

  const filtered        = useMemo(() => applyFilters(veiculos, search, filtros), [veiculos, search, filtros]);
  const hasActiveFilters = filtrosAtivos(filtros) || search.length > 0;

  // ── handlers ────────────────────────────────────────────────────────────────

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (v: VeiculoCadastrado) => { setSelected(null); setEditing(v); setFormOpen(true); };

  const avisarErro = (e: unknown) => window.alert(e instanceof Error ? e.message : 'Não foi possível concluir a operação.');

  const handleSaveForm = async (input: NovoVeiculoInput) => {
    try {
      if (editing) { await updateVeiculo(editing.id, input); }
      else         { await addVeiculo(input); }
    } catch (e) { avisarErro(e); }
  };

  const handleSaveOwner = async (prop: VeiculoProprietario | null) => {
    if (ownerTarget) await changeOwner(ownerTarget.id, prop).catch(avisarErro);
  };

  const handleUnlinkOwner = (v: VeiculoCadastrado) => {
    if (!v.proprietario) return;
    const ok = window.confirm(
      `Desvincular o proprietário "${v.proprietario.nome}" deste veículo?\n\nO veículo permanecerá cadastrado no sistema.`
    );
    if (ok) changeOwner(v.id, null).catch(avisarErro);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteVeiculo(deleteTarget.id).catch(avisarErro);
  };

  // Com proprietário vinculado o checklist já abre com cliente + veículo; sem, só com o veículo.
  const handleNovaOS = (v: VeiculoCadastrado) => {
    if (onNewOSComPrefill) onNewOSComPrefill(veiculoParaPrefill(v));
    else onNewOS?.();
  };

  // ── conteúdo ────────────────────────────────────────────────────────────────

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>

      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '14px 16px' : '16px 28px',
        background: 'var(--color-surface)', borderBottom: `1px solid ${tokens.color.border}`,
        flexShrink: 0, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <button
              onClick={() => onNav('dashboard')} aria-label="Voltar para a Visão Geral" className="dashboard-back-button"
            >
              {Icons.chevL}
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.3rem', color: tokens.color.text, margin: 0 }}>
                Veículos
              </h2>
            </div>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              Gerencie todos os veículos cadastrados na oficina.
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: isMobile ? '8px 14px' : '9px 18px',
            background: tokens.color.ferrari, color: 'white',
            border: 'none', borderRadius: 10, cursor: 'pointer',
            fontSize: '0.84rem', fontWeight: 700, boxShadow: tokens.shadow.sm,
            fontFamily: tokens.fontSans,
          }}
        >
          <span style={{ display: 'flex' }}>{Icons.plus}</span>
          {isMobile ? 'Cadastrar' : 'Cadastrar Veículo'}
        </button>
      </div>

      {erro && (
        <div style={{
          margin: isMobile ? '12px 16px 0' : '14px 28px 0',
          padding: '10px 16px', background: tokens.color.critBg, color: tokens.color.crit,
          border: `1px solid ${tokens.color.critBorder}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
        }}>
          {erro}
        </div>
      )}

      {/* busca + filtros */}
      <VehicleFilters
        search={search}
        filtros={filtros}
        onSearch={setSearch}
        onOpenFilters={() => setFilterModalOpen(true)}
        onClear={() => { setFiltros(emptyFiltros()); setSearch(''); }}
      />

      {/* corpo */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: isMobile ? '12px 12px 32px' : '18px 28px 36px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <VehicleStats stats={stats} loading={loading} />

        <VehicleGrid
          veiculos={filtered}
          loading={loading}
          hasAnyVeiculo={veiculos.length > 0}
          hasActiveFilters={hasActiveFilters}
          onView={setSelected}
          onEdit={openEdit}
          onChangeOwner={v => { setSelected(null); setOwnerTarget(v); }}
          onUnlinkOwner={handleUnlinkOwner}
          onDelete={v => { setSelected(null); setDeleteTarget(v); }}
          onClearFilters={() => { setFiltros(emptyFiltros()); setSearch(''); }}
          onNovoVeiculo={openCreate}
        />
      </div>
    </div>
  );

  // ── modais ──────────────────────────────────────────────────────────────────

  const modals = (
    <>
      {selected && (
        <VehicleDetailsModal
          veiculo={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => { setDeleteTarget(selected); setSelected(null); }}
          onNewOS={() => handleNovaOS(selected)}
        />
      )}
      {formOpen && (
        <VehicleFormModal
          veiculo={editing ?? undefined}
          clientes={clientes}
          onSave={handleSaveForm}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
      {filterModalOpen && (
        <VehicleFilterModal
          filtros={filtros}
          onApply={setFiltros}
          onClose={() => setFilterModalOpen(false)}
        />
      )}
      {ownerTarget && (
        <ChangeOwnerModal
          veiculo={ownerTarget}
          clientes={clientes}
          onSave={handleSaveOwner}
          onClose={() => setOwnerTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          veiculo={deleteTarget}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );

  // ── layout ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="veiculos" onNav={onNav} />
        {content}
        <MobileNav active="veiculos" onNav={onNav} onNewOS={onNewOS ?? openCreate} />
        {modals}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar active="veiculos" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {content}
      </main>
      {modals}
    </div>
  );
}
