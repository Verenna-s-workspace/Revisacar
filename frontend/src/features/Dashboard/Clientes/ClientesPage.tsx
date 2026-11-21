import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Sidebar, MobileNav, MobileTopbar } from '../Navigation';
import { DesktopTopBar } from '../../../components/DesktopTopBar';
import { useClientes } from '../../../hooks/useClientes';
import { useVeiculos } from '../../../hooks/useVeiculos';
import { useAgendamentos } from '../../../hooks/useAgendamentos';
import { useOrdens } from '../../../hooks/useOrdens';
import { emptyFiltros, filtrosAtivos, enrichClientes, computeClienteStats } from '../../../utils/clientes_utils';
import { veiculoParaPrefill } from '../../../utils/veiculos_utils';
import type { NavPage } from '../../../types/dashboard';
import type { OSPrefillInput } from '../../../types/atendimento';
import type { ClienteComDados, ClienteFiltros, NovoClienteInput, NovoVeiculoClienteInput } from '../../../types/cliente';
import type { VeiculoCadastrado, NovoVeiculoInput } from '../../../types/veiculo';
import type { OrdemRow } from '../../../types/dashboard';
import type { NovoAgendamentoInput } from '../../../types/agendamento';

import { ClientesDesktop } from './ClientesDesktop';
import { ClientesMobile } from './ClientesMobile';
import { ClientFilterModal } from './ClientFilterModal';
import { ClientDetailsModal } from './ClientDetailsModal';
import { ClientFormModal } from './ClientFormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

import { VehicleDetailsModal } from '../Veiculos/VehicleDetailsModal';
import { VehicleFormModal } from '../Veiculos/VehicleFormModal';
import { DeleteConfirmModal as VehicleDeleteConfirmModal } from '../Veiculos/DeleteConfirmModal';
import { NewAppointmentModal } from '../Agendamentos/NewAppointmentModal';
import { OSModal } from '../OrdensPage';

interface ClientesPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  /** "Nova OS" a partir de um veículo do cliente: abre o checklist já com os dados dele e do veículo. */
  onNewOSComPrefill?: (prefill: OSPrefillInput) => void;
  onLoadOS?: (id: string) => void;
  /** Navega para a tela de Agendamentos já filtrada/focada em um agendamento específico. */
  onGoToAgendamentos: (focus: { search?: string; highlightId?: string }) => void;
}

function applyFilters(list: ClienteComDados[], search: string, f: ClienteFiltros): ClienteComDados[] {
  return list.filter(c => {
    if (f.status !== 'todos' && c.status !== f.status) return false;
    if (f.semVeiculos && c.veiculos.length > 0) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchCliente =
        c.nome.toLowerCase().includes(q) ||
        (c.cpfCnpj?.toLowerCase().includes(q) ?? false) ||
        (c.telefone?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false);
      const matchVeiculo = c.veiculos.some(v =>
        v.placa.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q),
      );
      return matchCliente || matchVeiculo;
    }
    return true;
  });
}

export function ClientesPage({ onNav, isMobile, onNewOS, onNewOSComPrefill, onLoadOS, onGoToAgendamentos }: ClientesPageProps) {
  const { clientes, loading: clientesLoading, erro: clientesErro, reload, addCliente, updateCliente, deleteCliente } = useClientes();
  const { veiculos, loading: veiculosLoading, addVeiculo, updateVeiculo, deleteVeiculo } = useVeiculos();
  const { agendamentos, loading: agendamentosLoading, addAgendamento, getOcupados } = useAgendamentos();
  const { loading: ordensLoading, ordens } = useOrdens();

  const loading = clientesLoading || veiculosLoading || agendamentosLoading || ordensLoading;
  const erro = clientesErro;

  const clientesEnriquecidos = useMemo(
    () => enrichClientes(clientes, veiculos, agendamentos, ordens),
    [clientes, veiculos, agendamentos, ordens],
  );
  const stats = useMemo(() => computeClienteStats(clientesEnriquecidos), [clientesEnriquecidos]);

  const [search,          setSearch]          = useState('');
  const [filtros,         setFiltros]         = useState<ClienteFiltros>(emptyFiltros());
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selected,        setSelected]        = useState<ClienteComDados | null>(null);
  const [formOpen,        setFormOpen]        = useState(false);
  const [editing,         setEditing]         = useState<ClienteComDados | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<ClienteComDados | null>(null);
  const [agendaTarget,    setAgendaTarget]    = useState<ClienteComDados | null>(null);

  const [viewingVeiculo,  setViewingVeiculo]  = useState<VeiculoCadastrado | null>(null);
  const [editingVeiculo,  setEditingVeiculo]  = useState<VeiculoCadastrado | null>(null);
  const [deletingVeiculo, setDeletingVeiculo] = useState<VeiculoCadastrado | null>(null);
  const [viewingOrdem,    setViewingOrdem]    = useState<OrdemRow | null>(null);

  const filtered = useMemo(() => applyFilters(clientesEnriquecidos, search, filtros), [clientesEnriquecidos, search, filtros]);

  // ── handlers: cliente ─────────────────────────────────────────────────────────

  const avisarErro = (e: unknown) => window.alert(e instanceof Error ? e.message : 'Não foi possível concluir a ação no cadastro de cliente. Verifique sua conexão e tente novamente.');

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (c: ClienteComDados) => { setSelected(null); setEditing(c); setFormOpen(true); };

  const handleSaveForm = async (input: NovoClienteInput, veiculosNovos: NovoVeiculoClienteInput[]) => {
    try {
      const clienteAlvo = editing
        ? { ...editing, ...input }
        : await addCliente(input);

      if (editing) await updateCliente(editing.id, input);

      for (const v of veiculosNovos) {
        const novoVeiculo: NovoVeiculoInput = {
          placa: v.placa.trim().toUpperCase(),
          marca: v.marca.trim(),
          modelo: v.modelo.trim(),
          ano: Number(v.ano) || new Date().getFullYear(),
          cor: v.cor.trim(),
          categoria: v.categoria,
          quilometragem: Number(v.quilometragem) || 0,
          combustivel: v.combustivel,
          cambio: 'Manual',
          portas: 4,
          motor: v.motor.trim() || undefined,
          observacoes: v.observacoes.trim() || undefined,
          fotosAdicionais: [],
          proprietario: {
            clienteId: clienteAlvo.id,
            nome: clienteAlvo.nome,
            docCpfCnpj: clienteAlvo.cpfCnpj,
            telefone: clienteAlvo.telefone,
            email: clienteAlvo.email,
          },
        };
        await addVeiculo(novoVeiculo);
      }
    } catch (e) { avisarErro(e); }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteCliente(deleteTarget.id).catch(avisarErro);
  };

  const openAgendar = (c: ClienteComDados) => { setSelected(null); setAgendaTarget(c); };

  const handleNewAgendamentoConfirm = async (input: NovoAgendamentoInput) => {
    try {
      await addAgendamento(input);
      setAgendaTarget(null);
    } catch (e) { avisarErro(e); }
  };

  // ── handlers: veículo (dentro do perfil do cliente) ───────────────────────────

  const handleSaveVeiculoEdit = async (input: NovoVeiculoInput) => {
    if (editingVeiculo) await updateVeiculo(editingVeiculo.id, input).catch(avisarErro);
  };

  const handleNovaOS = (v: VeiculoCadastrado) => {
    if (onNewOSComPrefill) onNewOSComPrefill(veiculoParaPrefill(v));
    else onNewOS?.();
  };

  // ── modais ──────────────────────────────────────────────────────────────────

  const modals = (
    <>
      {selected && (
        <ClientDetailsModal
          cliente={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => { setDeleteTarget(selected); setSelected(null); }}
          onViewVeiculo={v => { setSelected(null); setViewingVeiculo(v); }}
          onViewOrdem={o => { setSelected(null); setViewingOrdem(o); }}
          onNovoAgendamento={openAgendar}
          onGoToAgendamento={ag => onGoToAgendamentos({ search: ag.cliente, highlightId: ag.id })}
        />
      )}

      {formOpen && (
        <ClientFormModal
          cliente={editing ?? undefined}
          onSave={handleSaveForm}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {filterModalOpen && (
        <ClientFilterModal
          filtros={filtros}
          onApply={setFiltros}
          onClose={() => setFilterModalOpen(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          cliente={deleteTarget}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {agendaTarget && (
        <NewAppointmentModal
          initialCliente={agendaTarget.nome}
          initialVeiculos={agendaTarget.veiculos.map(v => ({ veiculo: `${v.marca} ${v.modelo}`, placa: v.placa }))}
          getOcupados={getOcupados}
          onConfirm={handleNewAgendamentoConfirm}
          onClose={() => setAgendaTarget(null)}
        />
      )}

      {/* Veículo vinculado — reaproveita os mesmos modais da tela de Veículos */}
      {viewingVeiculo && (
        <VehicleDetailsModal
          veiculo={viewingVeiculo}
          onClose={() => setViewingVeiculo(null)}
          onEdit={() => { setEditingVeiculo(viewingVeiculo); setViewingVeiculo(null); }}
          onDelete={() => { setDeletingVeiculo(viewingVeiculo); setViewingVeiculo(null); }}
          onNewOS={() => handleNovaOS(viewingVeiculo)}
        />
      )}
      {editingVeiculo && (
        <VehicleFormModal
          veiculo={editingVeiculo}
          clientes={clientes}
          onSave={handleSaveVeiculoEdit}
          onClose={() => setEditingVeiculo(null)}
        />
      )}
      {deletingVeiculo && (
        <VehicleDeleteConfirmModal
          veiculo={deletingVeiculo}
          onConfirm={() => deleteVeiculo(deletingVeiculo.id).catch(avisarErro)}
          onClose={() => setDeletingVeiculo(null)}
        />
      )}

      {/* Ordem de serviço — reaproveita o mesmo modal do Dashboard/Ordens */}
      {viewingOrdem && (
        <OSModal
          ordem={viewingOrdem}
          onClose={() => setViewingOrdem(null)}
          onEdit={() => { onLoadOS?.(viewingOrdem.id); setViewingOrdem(null); }}
        />
      )}
    </>
  );

  // ── layout mobile ───────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="clientes" onNav={onNav} />
        <ClientesMobile
          clientes={filtered}
          totalClientes={clientes.length}
          stats={stats}
          loading={loading}
          erro={erro}
          search={search}
          filtros={filtros}
          onSearch={setSearch}
          onFiltros={setFiltros}
          onOpenFilters={() => setFilterModalOpen(true)}
          onClearFilters={() => { setFiltros(emptyFiltros()); setSearch(''); }}
          onRecarregar={reload}
          onNovoCliente={openCreate}
          onView={setSelected}
          onEdit={openEdit}
          onSchedule={openAgendar}
          onDelete={c => { setSelected(null); setDeleteTarget(c); }}
        />
        <MobileNav active="clientes" onNav={onNav} onNewOS={onNewOS ?? openCreate} />
        {modals}
      </div>
    );
  }

  // ── layout desktop ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar active="clientes" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
        <DesktopTopBar page="clientes" onNav={onNav} />
        <ClientesDesktop
          clientes={filtered}
          totalClientes={clientes.length}
          stats={stats}
          loading={loading}
          erro={erro}
          search={search}
          filtros={filtros}
          onSearch={setSearch}
          onFiltros={setFiltros}
          onOpenFilters={() => setFilterModalOpen(true)}
          onClearFilters={() => { setFiltros(emptyFiltros()); setSearch(''); }}
          onRecarregar={reload}
          onNovoCliente={openCreate}
          onView={setSelected}
          onEdit={openEdit}
          onSchedule={openAgendar}
          onDelete={c => { setSelected(null); setDeleteTarget(c); }}
        />
      </main>
      {modals}
    </div>
  );
}