import { useMemo, useState } from 'react';
import { tokens } from '../../constants';
import { Sidebar, MobileNav, MobileTopbar } from './Navigation';
import { useServicos } from '../../hooks/useServicos';
import { useEstoque } from '../../hooks/useEstoque';
import type { ServicoItem } from '../../types/servico';
import type { NavPage } from '../../types/dashboard';

import { ServicosDesktop } from './Servicos/ServicosDesktop';
import { ServicosMobile } from './Servicos/ServicosMobile';
import { ServicoFormModal } from './Servicos/ServicoFormModal';
import { DeleteConfirmModal } from './Servicos/DeleteConfirmModal';

interface ServicosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
}

export function ServicosPage({ onNav, isMobile, onNewOS }: ServicosPageProps) {
  const { servicos, loading, erro, addServico, updateServico, deleteServico, toggleAtivo } = useServicos();

  // Vínculo Kit ↔ Serviço: leitura apenas (fonte da verdade é o Kit no Estoque)
  const { kits } = useEstoque();
  const kitPorServicoId = useMemo(() => {
    const mapa = new Map<string, string>();
    kits.forEach(k => { if (k.servicoId) mapa.set(k.servicoId, k.nome); });
    return mapa;
  }, [kits]);

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

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="servicos" onNav={onNav} />
        <ServicosMobile
          servicos={servicos}
          loading={loading}
          erro={erro}
          erroAcao={erroAcao}
          onLimparErroAcao={() => setErroAcao(null)}
          kitPorServicoId={kitPorServicoId}
          onVoltar={() => onNav('dashboard')}
          onNovo={abrirNovo}
          onEditar={abrirEdicao}
          onToggleAtivo={id => executarAcao(() => toggleAtivo(id))}
          onExcluir={setExcluindo}
        />
        <MobileNav active="servicos" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
        {modals}
      </div>
    );
  }

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