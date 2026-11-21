import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Sidebar, MobileNav, MobileTopbar } from '../Navigation';
import { useVeiculos } from '../../../hooks/useVeiculos';
import { useClientes } from '../../../hooks/useClientes';
import { useOrdens } from '../../../hooks/useOrdens';
import { emptyFiltros, veiculoParaPrefill } from '../../../utils/veiculos_utils';
import type { NavPage } from '../../../types/dashboard';
import type { OSPrefillInput } from '../../../types/atendimento';
import type { VeiculoCadastrado, VeiculoFiltros, NovoVeiculoInput, VeiculoProprietario } from '../../../types/veiculo';

import { VeiculosDesktop } from './VeiculosDesktop';
import { VeiculosMobile } from './VeiculosMobile';
import { VehicleFilterModal } from './VehicleFilterModal';
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
  const { veiculos, loading, erro, stats, reload, addVeiculo, updateVeiculo, deleteVeiculo, changeOwner } = useVeiculos();
  // Clientes da carteira: é entre eles que o proprietário do veículo é escolhido (vínculo veículo ↔ cliente).
  const { clientes } = useClientes();
  // Ordens: usado na coluna "Última OS".
  const { ordens } = useOrdens();

  const [search,          setSearch]          = useState('');
  const [filtros,         setFiltros]         = useState<VeiculoFiltros>(emptyFiltros());
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selected,        setSelected]        = useState<VeiculoCadastrado | null>(null);
  const [formOpen,        setFormOpen]        = useState(false);
  const [editing,         setEditing]         = useState<VeiculoCadastrado | null>(null);
  const [ownerTarget,     setOwnerTarget]     = useState<VeiculoCadastrado | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<VeiculoCadastrado | null>(null);

  const filtered = useMemo(() => applyFilters(veiculos, search, filtros), [veiculos, search, filtros]);

  // ── handlers ────────────────────────────────────────────────────────────────

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (v: VeiculoCadastrado) => { setSelected(null); setEditing(v); setFormOpen(true); };

  const avisarErro = (e: unknown) => window.alert(e instanceof Error ? e.message : 'Não foi possível concluir a operação. Atualize a página e tente de novo.');

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

  // ── layout mobile (redesign em ./VeiculosMobile) ───────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="veiculos" onNav={onNav} />
        <VeiculosMobile
          veiculos={filtered}
          totalVeiculos={veiculos.length}
          stats={stats}
          ordens={ordens}
          loading={loading}
          erro={erro}
          search={search}
          filtros={filtros}
          onVoltar={() => onNav('dashboard')}
          onSearch={setSearch}
          onFiltros={setFiltros}
          onOpenFilters={() => setFilterModalOpen(true)}
          onClearFilters={() => { setFiltros(emptyFiltros()); setSearch(''); }}
          onRecarregar={reload}
          onNovoVeiculo={openCreate}
          onView={setSelected}
          onEdit={openEdit}
          onChangeOwner={v => { setSelected(null); setOwnerTarget(v); }}
          onUnlinkOwner={handleUnlinkOwner}
          onDelete={v => { setSelected(null); setDeleteTarget(v); }}
          onNovaOS={handleNovaOS}
        />
        <MobileNav active="veiculos" onNav={onNav} onNewOS={onNewOS ?? openCreate} />
        {modals}
      </div>
    );
  }

  // ── layout desktop (redesign em ./VeiculosDesktop) ──────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar active="veiculos" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
        <VeiculosDesktop
          veiculos={filtered}
          totalVeiculos={veiculos.length}
          stats={stats}
          ordens={ordens}
          loading={loading}
          erro={erro}
          search={search}
          filtros={filtros}
          onSearch={setSearch}
          onFiltros={setFiltros}
          onOpenFilters={() => setFilterModalOpen(true)}
          onClearFilters={() => { setFiltros(emptyFiltros()); setSearch(''); }}
          onRecarregar={reload}
          onNovoVeiculo={openCreate}
          onView={setSelected}
          onEdit={openEdit}
          onChangeOwner={v => { setSelected(null); setOwnerTarget(v); }}
          onUnlinkOwner={handleUnlinkOwner}
          onDelete={v => { setSelected(null); setDeleteTarget(v); }}
          onNovaOS={handleNovaOS}
        />
      </main>
      {modals}
    </div>
  );
}