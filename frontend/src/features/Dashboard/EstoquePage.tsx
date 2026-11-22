import { useMemo, useState } from 'react';
import { Sidebar, MobileNav, MobileTopbar } from './Navigation';
import { DesktopTopBar } from '../../components/DesktopTopBar';
import { Card, Skeleton } from './Primitives';codium frontend/src/features/Dashboard/EstoquePage.tsx
import { useEstoque } from '../../hooks/useEstoque';
import { usePermissions } from '../../hooks/usePermissions';
import type { EstoqueItem, EstoqueKit, NovoEstoqueItemInput, NovoEstoqueKitInput } from '../../types/estoque';
import type { NavPage } from '../../types/dashboard';

import { EstoqueDesktop } from './Estoque/EstoqueDesktop';
import { EstoqueMobile } from './Estoque/EstoqueMobile';
import { ProdutoModal } from './Estoque/ProdutoModal';
import { ProdutoDetalheModal } from './Estoque/ProdutoDetalheModal';
import { KitDetalheModal } from './Estoque/KitDetalheModal';
import { CriarKitModal } from './Estoque/CriarKitModal';
import { ConfirmDeleteModal } from './Estoque/ConfirmDeleteModal';

interface EstoquePageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  /** Preenche a busca ao entrar na tela — usado pelo "Ver Item" em Relatórios. */
  initialSearch?: string;
}

export function EstoquePage({ onNav, isMobile, onNewOS, initialSearch }: EstoquePageProps) {
  const {
    itens, kits, carregando, erro, stats,
    recarregar, criarItem, atualizarItem, excluirItem,
    criarKit, atualizarKit, excluirKit, aplicarKit, disponibilidadeKit,
  } = useEstoque();

  const { can } = usePermissions();
  // Custo é a base da margem: mesma regra do Orçamento (financeiro.ver_margem).
  const mostrarCusto = can('financeiro.ver_margem');

  const [busca, setBusca] = useState(initialSearch ?? '');

  // Celular: tocar numa linha abre o modal de detalhes (guarda só o id, pra refletir o estoque atual).
  const [detalheItemId, setDetalheItemId] = useState<string | null>(null);
  const [detalheKitId, setDetalheKitId] = useState<string | null>(null);

  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [editandoItem, setEditandoItem] = useState<EstoqueItem | undefined>(undefined);
  // Categoria filtrada na lista, pra já vir selecionada ao criar produto.
  const [categoriaNovoProduto, setCategoriaNovoProduto] = useState<string | undefined>(undefined);
  const [excluindoItem, setExcluindoItem] = useState<EstoqueItem | null>(null);

  const [modalKitAberto, setModalKitAberto] = useState(false);
  const [editandoKit, setEditandoKit] = useState<EstoqueKit | undefined>(undefined);
  const [excluindoKit, setExcluindoKit] = useState<EstoqueKit | null>(null);

  // Erros do servidor: ao salvar, ficam dentro do modal (que continua aberto);
  // ao excluir, vão pra um aviso no topo da página (o modal de confirmação fecha).
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const [aplicandoKitId, setAplicandoKitId] = useState<string | null>(null);
  const [erroAplicarKit, setErroAplicarKit] = useState<Record<string, string>>({});

  const itensPorId = useMemo(() => new Map(itens.map(i => [i.id, i])), [itens]);

  const detalheItem = detalheItemId ? itensPorId.get(detalheItemId) : undefined;
  const detalheKit = detalheKitId ? kits.find(k => k.id === detalheKitId) : undefined;

  function abrirNovoProduto() {
    setErroSalvar(null);
    setEditandoItem(undefined);
    setModalProdutoAberto(true);
  }
  function abrirEdicaoProduto(item: EstoqueItem) {
    setErroSalvar(null);
    setEditandoItem(item);
    setModalProdutoAberto(true);
  }
  async function salvarProduto(input: NovoEstoqueItemInput) {
    setSalvando(true);
    setErroSalvar(null);
    try {
      if (editandoItem) await atualizarItem(editandoItem.id, input);
      else await criarItem(input);
      setModalProdutoAberto(false);
      setEditandoItem(undefined);
      setCategoriaNovoProduto(undefined);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar o item. Confira nome, quantidade e valores e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirNovoKit() {
    setErroSalvar(null);
    setEditandoKit(undefined);
    setModalKitAberto(true);
  }
  function abrirEdicaoKit(kit: EstoqueKit) {
    setErroSalvar(null);
    setEditandoKit(kit);
    setModalKitAberto(true);
  }
  async function salvarKit(input: NovoEstoqueKitInput) {
    setSalvando(true);
    setErroSalvar(null);
    try {
      if (editandoKit) await atualizarKit(editandoKit.id, input);
      else await criarKit(input);
      setModalKitAberto(false);
      setEditandoKit(undefined);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar o kit. Confira o nome e os itens do kit e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(acao: () => Promise<void>) {
    setErroExcluir(null);
    try {
      await acao();
    } catch (e) {
      setErroExcluir(e instanceof Error ? e.message : 'Não foi possível excluir. O item pode estar em uso (kit ou OS): confira e tente de novo.');
    }
  }

  async function handleAplicarKit(kit: EstoqueKit) {
    setAplicandoKitId(kit.id);
    setErroAplicarKit(prev => {
      const proximo = { ...prev };
      delete proximo[kit.id];
      return proximo;
    });
    const resultado = await aplicarKit(kit.id);
    if (!resultado.ok) {
      setErroAplicarKit(prev => ({ ...prev, [kit.id]: resultado.mensagem }));
    }
    setAplicandoKitId(null);
  }

  const modals = (
    <>
      {detalheItem && (
        <ProdutoDetalheModal
          item={detalheItem}
          mostrarCusto={mostrarCusto}
          onClose={() => setDetalheItemId(null)}
          onEditar={item => { setDetalheItemId(null); abrirEdicaoProduto(item); }}
          onExcluir={item => { setDetalheItemId(null); setExcluindoItem(item); }}
        />
      )}
      {detalheKit && (
        <KitDetalheModal
          kit={detalheKit}
          itensPorId={itensPorId}
          disponibilidade={disponibilidadeKit(detalheKit)}
          aplicando={aplicandoKitId === detalheKit.id}
          erro={erroAplicarKit[detalheKit.id] ?? null}
          onClose={() => setDetalheKitId(null)}
          onAplicar={handleAplicarKit}
          onEditar={kit => { setDetalheKitId(null); abrirEdicaoKit(kit); }}
          onExcluir={kit => { setDetalheKitId(null); setExcluindoKit(kit); }}
        />
      )}
      {modalProdutoAberto && (
        <ProdutoModal
          item={editandoItem}
          categoriaInicial={categoriaNovoProduto}
          onSave={salvarProduto}
          erro={erroSalvar}
          salvando={salvando}
          onClose={() => { setModalProdutoAberto(false); setEditandoItem(undefined); setCategoriaNovoProduto(undefined); }}
        />
      )}
      {excluindoItem && (
        <ConfirmDeleteModal
          nome={excluindoItem.nome}
          entidadeLabel="produto"
          onConfirm={() => confirmarExclusao(() => excluirItem(excluindoItem.id))}
          onClose={() => setExcluindoItem(null)}
        />
      )}
      {modalKitAberto && (
        <CriarKitModal
          kit={editandoKit}
          itensDisponiveis={itens}
          onSave={salvarKit}
          erro={erroSalvar}
          salvando={salvando}
          onClose={() => { setModalKitAberto(false); setEditandoKit(undefined); }}
        />
      )}
      {excluindoKit && (
        <ConfirmDeleteModal
          nome={excluindoKit.nome}
          entidadeLabel="kit"
          onConfirm={() => confirmarExclusao(() => excluirKit(excluindoKit.id))}
          onClose={() => setExcluindoKit(null)}
        />
      )}
    </>
  );

  // ── layout ────────────────────────────────────────────────────────────────

  // Celular: tela redesenhada em ./Estoque (EstoqueMobile). Tocar num item/kit abre o modal de detalhes.
  if (isMobile) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="estoque" onNav={onNav} />
        <EstoqueMobile
          itens={itens}
          kits={kits}
          carregando={carregando}
          erro={erro}
          valorTotal={stats.valorTotal}
          busca={busca}
          onBusca={setBusca}
          erroExcluir={erroExcluir}
          onFecharErroExcluir={() => setErroExcluir(null)}
          onRecarregar={recarregar}
          onNovoProduto={categoria => { setCategoriaNovoProduto(categoria); abrirNovoProduto(); }}
          onNovoKit={abrirNovoKit}
          onAbrirProduto={item => setDetalheItemId(item.id)}
          onAbrirKit={kit => setDetalheKitId(kit.id)}
          disponibilidadeKit={disponibilidadeKit}
        />
        <MobileNav active="estoque" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
        {modals}
      </div>
    );
  }

  // Desktop: tela redesenhada em ./Estoque (EstoqueDesktop).
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar active="estoque" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
        <DesktopTopBar page="estoque" onNav={onNav} />
        <EstoqueDesktop
          itens={itens}
          kits={kits}
          carregando={carregando}
          erro={erro}
          valorTotal={stats.valorTotal}
          busca={busca}
          onBusca={setBusca}
          erroExcluir={erroExcluir}
          onFecharErroExcluir={() => setErroExcluir(null)}
          onRecarregar={recarregar}
          onNovoProduto={categoria => { setCategoriaNovoProduto(categoria); abrirNovoProduto(); }}
          onNovoKit={abrirNovoKit}
          onEditarProduto={abrirEdicaoProduto}
          onExcluirProduto={setExcluindoItem}
          onEditarKit={abrirEdicaoKit}
          onExcluirKit={setExcluindoKit}
          onAplicarKit={handleAplicarKit}
          aplicandoKitId={aplicandoKitId}
          erroAplicarKit={erroAplicarKit}
          disponibilidadeKit={disponibilidadeKit}
        />
      </main>
      {modals}
    </div>
  );
}
