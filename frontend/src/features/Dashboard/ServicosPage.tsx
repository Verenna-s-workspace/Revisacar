import { useMemo, useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Sidebar, MobileNav, MobileTopbar } from './Navigation';
import { Card, Skeleton } from './Primitives';
import { useServicos } from '../../hooks/useServicos';
import { useEstoque } from '../../hooks/useEstoque';
import type { ServicoItem } from '../../types/servico';
import type { NavPage } from '../../types/dashboard';

import { ServicosDesktop } from './Servicos/ServicosDesktop';
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
  const { servicos, loading, erro, stats, addServico, updateServico, deleteServico, toggleAtivo } = useServicos();

  // Vínculo Kit ↔ Serviço: leitura apenas (fonte da verdade é o Kit no Estoque)
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

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

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
    setErroSalvar(null);
    setEditando(undefined);
    setModalAberto(true);
  }

  function abrirEdicao(servico: ServicoItem) {
    setErroSalvar(null);
    setEditando(servico);
    setModalAberto(true);
  }

  async function salvar(input: Parameters<typeof addServico>[0]) {
    setSalvando(true);
    setErroSalvar(null);
    try {
      if (editando) await updateServico(editando.id, input);
      else await addServico(input);
      setModalAberto(false);
      setEditando(undefined);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar o serviço. Confira nome, categoria e preço e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function executarAcao(acao: () => Promise<void>) {
    setErroAcao(null);
    try {
      await acao();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível concluir a ação. Atualize a página e tente de novo.');
    }
  }

  const modals = (
    <>
      {modalAberto && (
        <ServicoFormModal
          servico={editando}
          categoriasDisponiveis={categoriasDisponiveis}
          onSave={salvar}
          erro={erroSalvar}
          salvando={salvando}
          onClose={() => { setModalAberto(false); setEditando(undefined); }}
        />
      )}
      {excluindo && (
        <DeleteConfirmModal
          servico={excluindo}
          onConfirm={() => executarAcao(() => deleteServico(excluindo.id))}
          onClose={() => setExcluindo(null)}
        />
      )}
    </>
  );

  // ── Desktop (redesign) ────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', minHeight: '100dvh' }}>
        <Sidebar active="servicos" onNav={onNav} onNewOS={onNewOS} />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
          <ServicosDesktop
            servicos={servicos}
            loading={loading}
            erro={erro}
            erroAcao={erroAcao}
            onLimparErroAcao={() => setErroAcao(null)}
            kitPorServicoId={kitPorServicoId}
            onNovo={abrirNovo}
            onEditar={abrirEdicao}
            onToggleAtivo={id => executarAcao(() => toggleAtivo(id))}
            onExcluir={setExcluindo}
          />
        </main>
        {modals}
      </div>
    );
  }

  // ── Mobile (mantido sem alterações) ───────────────────────────────────────
  const temFiltroAtivo = search !== '' || categoria !== 'todas';

  const mobileContent = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'var(--color-surface)',
          borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0, flexWrap: 'wrap', gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => onNav('dashboard')} aria-label="Voltar para a Visão Geral" className="dashboard-back-button"
          >
            {Icons.chevL}
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.05rem', color: tokens.color.text, margin: 0 }}>
                Catálogo de Serviços
              </h2>
            </div>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              Serviços, preços e duração estimada oferecidos pela oficina.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={abrirNovo}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 16px',
            background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 9,
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            width: '100%', minHeight: 44,
          }}
        >
          <span style={{ display: 'flex' }}>{Icons.plus}</span>
          Novo serviço
        </button>
      </div>

      {erroAcao && (
        <div role="alert" style={{
          margin: '12px 16px 0',
          padding: '10px 16px', background: tokens.color.critBg, color: tokens.color.crit,
          border: `1px solid ${tokens.color.critBorder}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', gap: 12,
        }}>
          <span>{erroAcao}</span>
          <button onClick={() => setErroAcao(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>
            Fechar
          </button>
        </div>
      )}

      {erro && (
        <div style={{
          margin: '12px 16px 0',
          padding: '10px 16px', background: tokens.color.critBg, color: tokens.color.crit,
          border: `1px solid ${tokens.color.critBorder}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
        }}>
          {erro}
        </div>
      )}

      <ServicoFilters
        search={search}
        categoria={categoria}
        categoriasDisponiveis={categoriasDisponiveis}
        onSearch={setSearch}
        onCategoria={setCategoria}
      />

      <div
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '12px 12px 32px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <ServicoStats stats={stats} loading={loading} />

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            {filtrados.map(s => (
              <ServicoCard
                key={s.id}
                servico={s}
                onEdit={() => abrirEdicao(s)}
                onDelete={() => setExcluindo(s)}
                onToggleAtivo={() => executarAcao(() => toggleAtivo(s.id))}
                kitVinculadoNome={kitPorServicoId.get(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
      <MobileTopbar active="servicos" onNav={onNav} />
      {mobileContent}
      <MobileNav active="servicos" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
      {modals}
    </div>
  );
}