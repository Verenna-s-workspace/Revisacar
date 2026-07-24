import { useMemo, useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Sidebar, MobileNav } from './Navigation';
import { Card, Skeleton } from './Primitives';
import { useServicos } from '../../hooks/useServicos';
import { useEstoque } from '../../hooks/useEstoque';
import type { ServicoItem } from '../../types/servico';
import type { NavPage } from '../../types/dashboard';

import { ServicoStats } from './Servicos/ServicoStats';
import { ServicoFilters } from './Servicos/ServicoFilters';
import { ServicoCard } from './Servicos/ServicoCard';
import { ServicoFormModal } from './Servicos/ServicoFormModal';
import { DeleteConfirmModal } from './Servicos/DeleteConfirmModal';

interface ServicosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
}

export function ServicosPage({ onNav, isMobile, onNewOS }: ServicosPageProps) {
  const { servicos, loading, stats, addServico, updateServico, deleteServico, toggleAtivo } = useServicos();

  // Vínculo Kit ↔ Serviço: a fonte da verdade é o Kit (Estoque), então aqui é
  // só leitura — um lookup servicoId -> nome do kit, montado uma vez aqui em
  // vez de cada ServicoCard chamar useEstoque() individualmente.
  const { kits } = useEstoque();
  const kitPorServicoId = useMemo(() => {
    const mapa = new Map<string, string>();
    kits.forEach(k => { if (k.servicoId) mapa.set(k.servicoId, k.nome); });
    return mapa;
  }, [kits]);

  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ServicoItem | undefined>(undefined);
  const [excluindo, setExcluindo] = useState<ServicoItem | null>(null);

  const categoriasDisponiveis = useMemo(
    () => Array.from(new Set(servicos.map(s => s.categoria))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [servicos]
  );

  const filtrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return servicos.filter(s => {
      const bateBusca = !termo || s.nome.toLowerCase().includes(termo);
      const bateCategoria = categoria === 'todas' || s.categoria === categoria;
      return bateBusca && bateCategoria;
    });
  }, [servicos, search, categoria]);

  function abrirNovo() {
    setEditando(undefined);
    setModalAberto(true);
  }

  function abrirEdicao(servico: ServicoItem) {
    setEditando(servico);
    setModalAberto(true);
  }

  function salvar(input: Parameters<typeof addServico>[0]) {
    if (editando) {
      updateServico(editando.id, input);
    } else {
      addServico(input);
    }
    setModalAberto(false);
    setEditando(undefined);
  }

  const temFiltroAtivo = search !== '' || categoria !== 'todas';

  // ── conteúdo ────────────────────────────────────────────────────────────────

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>
      {/* header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '14px 16px' : '16px 28px', background: 'white',
          borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0, flexWrap: 'wrap', gap: 10,
        }}
      >
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
              Catálogo de Serviços
            </h2>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              Serviços, preços e duração estimada oferecidos pela oficina.
            </p>
          </div>
        </div>

        <button
          onClick={abrirNovo}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 9,
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ display: 'flex' }}>{Icons.plus}</span>
          {!isMobile && 'Adicionar Serviço'}
        </button>
      </div>

      <ServicoFilters
        search={search}
        categoria={categoria}
        categoriasDisponiveis={categoriasDisponiveis}
        onSearch={setSearch}
        onCategoria={setCategoria}
      />

      {/* corpo */}
      <div
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: isMobile ? '12px 12px 32px' : '18px 28px 36px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <ServicoStats stats={stats} loading={loading} />

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} style={{ padding: 20 }}>
                <Skeleton h={110} r={8} />
              </Card>
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: tokens.color.ferrariMid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.ferrari }}>
              {Icons.wrench}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: tokens.color.text }}>
              {temFiltroAtivo ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
            </div>
            <div style={{ fontSize: '0.82rem', color: tokens.color.muted, maxWidth: 320 }}>
              {temFiltroAtivo
                ? 'Tente ajustar a busca ou o filtro de categoria.'
                : 'Cadastre o primeiro serviço do catálogo pra começar.'}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {filtrados.map(s => (
              <ServicoCard
                key={s.id}
                servico={s}
                onEdit={() => abrirEdicao(s)}
                onDelete={() => setExcluindo(s)}
                onToggleAtivo={() => toggleAtivo(s.id)}
                kitVinculadoNome={kitPorServicoId.get(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const modals = (
    <>
      {modalAberto && (
        <ServicoFormModal
          servico={editando}
          categoriasDisponiveis={categoriasDisponiveis}
          onSave={salvar}
          onClose={() => { setModalAberto(false); setEditando(undefined); }}
        />
      )}
      {excluindo && (
        <DeleteConfirmModal
          servico={excluindo}
          onConfirm={() => deleteServico(excluindo.id)}
          onClose={() => setExcluindo(null)}
        />
      )}
    </>
  );

  // ── layout ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="servicos" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
        {modals}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="servicos" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {content}
      </main>
      {modals}
    </div>
  );
}
