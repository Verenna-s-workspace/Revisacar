import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Sidebar, MobileNav } from '../Navigation';
import { useClientes } from '../../../hooks/useClientes';
import { useVeiculos } from '../../../hooks/useVeiculos';
import { useAgendamentos } from '../../../hooks/useAgendamentos';
import { useDashboard } from '../../../hooks/useDashboard';
import { emptyFiltros, filtrosAtivos, enrichClientes, computeClienteStats } from '../../../utils/clientes_utils';
import type { NavPage } from '../../../types/dashboard';
import type { ClienteComDados, ClienteFiltros, NovoClienteInput, NovoVeiculoClienteInput } from '../../../types/cliente';
import type { VeiculoCadastrado, NovoVeiculoInput } from '../../../types/veiculo';
import type { OrdemRow } from '../../../types/dashboard';
import type { NovoAgendamentoInput } from '../../../types/agendamento';

import { ClientStats } from './ClientStats';
import { ClientFilters } from './ClientFilters';
import { ClientFilterModal } from './ClientFilterModal';
import { ClientGrid } from './ClientGrid';
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

export function ClientesPage({ onNav, isMobile, onNewOS, onLoadOS, onGoToAgendamentos }: ClientesPageProps) {
  const { clientes, loading: clientesLoading, addCliente, updateCliente, deleteCliente } = useClientes();
  const { veiculos, loading: veiculosLoading, addVeiculo, updateVeiculo, deleteVeiculo } = useVeiculos();
  const { agendamentos, loading: agendamentosLoading, addAgendamento, getOcupados } = useAgendamentos();
  const { loading: ordensLoading, data } = useDashboard();

  const loading = clientesLoading || veiculosLoading || agendamentosLoading || ordensLoading;

  const clientesEnriquecidos = useMemo(
    () => enrichClientes(clientes, veiculos, agendamentos, data.ordens),
    [clientes, veiculos, agendamentos, data.ordens],
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

  const filtered         = useMemo(() => applyFilters(clientesEnriquecidos, search, filtros), [clientesEnriquecidos, search, filtros]);
  const hasActiveFilters = filtrosAtivos(filtros) || search.length > 0;

  // ── handlers: cliente ─────────────────────────────────────────────────────────

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (c: ClienteComDados) => { setSelected(null); setEditing(c); setFormOpen(true); };

  const handleSaveForm = async (input: NovoClienteInput, veiculosNovos: NovoVeiculoClienteInput[]) => {
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
          nome: clienteAlvo.nome,
          docCpfCnpj: clienteAlvo.cpfCnpj,
          telefone: clienteAlvo.telefone,
          email: clienteAlvo.email,
        },
      };
      await addVeiculo(novoVeiculo);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteCliente(deleteTarget.id);
  };

  const openAgendar = (c: ClienteComDados) => { setSelected(null); setAgendaTarget(c); };

  const handleNewAgendamentoConfirm = async (input: NovoAgendamentoInput) => {
    await addAgendamento(input);
    setAgendaTarget(null);
  };

  const goToAgendamentoBadge = (c: ClienteComDados) => {
    if (c.proximoAgendamento) onGoToAgendamentos({ search: c.nome, highlightId: c.proximoAgendamento.id });
  };

  // ── handlers: veículo (dentro do perfil do cliente) ───────────────────────────

  const handleSaveVeiculoEdit = async (input: NovoVeiculoInput) => {
    if (editingVeiculo) await updateVeiculo(editingVeiculo.id, input);
  };

  // ── conteúdo ────────────────────────────────────────────────────────────────

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>

      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '14px 16px' : '16px 28px',
        background: 'white', borderBottom: `1px solid ${tokens.color.border}`,
        flexShrink: 0, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <button
              onClick={() => onNav('dashboard')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 4 }}
            >
              {Icons.chevL}
            </button>
          )}
          <div>
            <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.3rem', color: tokens.color.text, margin: 0 }}>
              Clientes
            </h2>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              Gerencie a carteira de clientes da oficina.
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
          {isMobile ? 'Cadastrar' : 'Cadastrar Cliente'}
        </button>
      </div>

      {/* busca + filtros */}
      <ClientFilters
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
        <ClientStats stats={stats} loading={loading} />

        <ClientGrid
          clientes={filtered}
          loading={loading}
          hasAnyCliente={clientes.length > 0}
          hasActiveFilters={hasActiveFilters}
          onView={setSelected}
          onEdit={openEdit}
          onSchedule={openAgendar}
          onDelete={c => { setSelected(null); setDeleteTarget(c); }}
          onGoToAgendamento={goToAgendamentoBadge}
          onClearFilters={() => { setFiltros(emptyFiltros()); setSearch(''); }}
          onNovoCliente={openCreate}
        />
      </div>
    </div>
  );

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
          onNewOS={onNewOS}
        />
      )}
      {editingVeiculo && (
        <VehicleFormModal
          veiculo={editingVeiculo}
          onSave={handleSaveVeiculoEdit}
          onClose={() => setEditingVeiculo(null)}
        />
      )}
      {deletingVeiculo && (
        <VehicleDeleteConfirmModal
          veiculo={deletingVeiculo}
          onConfirm={() => deleteVeiculo(deletingVeiculo.id)}
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

  // ── layout ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="clientes" onNav={onNav} onNewOS={onNewOS ?? openCreate} />
        {modals}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="clientes" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {content}
      </main>
      {modals}
    </div>
  );
}
