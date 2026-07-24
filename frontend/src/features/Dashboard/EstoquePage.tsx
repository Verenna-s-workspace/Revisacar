import { useMemo, useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Sidebar, MobileNav } from './Navigation';
import { Card, Skeleton } from './Primitives';
import { useEstoque } from '../../hooks/useEstoque';
import { filtrarItensPorBusca, itemEstaBaixo } from '../../utils/estoque_utils';
import type { EstoqueItem, EstoqueKit, NovoEstoqueItemInput, NovoEstoqueKitInput } from '../../types/estoque';
import type { NavPage } from '../../types/dashboard';

import { EstoqueStats } from './Estoque/EstoqueStats';
import { EstoqueFilters } from './Estoque/EstoqueFilters';
import { CategoriaGrid } from './Estoque/CategoriaGrid';
import { EstoqueItemCard } from './Estoque/EstoqueItemCard';
import { EstoqueBaixoTira } from './Estoque/EstoqueBaixoTira';
import { QuarentenaAlert } from './Estoque/QuarentenaAlert';
import { KitCard } from './Estoque/KitCard';
import { ProdutoModal } from './Estoque/ProdutoModal';
import { CriarKitModal } from './Estoque/CriarKitModal';
import { ConfirmDeleteModal } from './Estoque/ConfirmDeleteModal';

interface EstoquePageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
}

type Visao = { tipo: 'inicio' } | { tipo: 'categoria'; categoria: string } | { tipo: 'baixo-estoque' };

export function EstoquePage({ onNav, isMobile, onNewOS }: EstoquePageProps) {
  const {
    itens, kits, carregando, erro, usandoDadosDemo, stats,
    recarregar, criarItem, atualizarItem, excluirItem,
    criarKit, atualizarKit, excluirKit, aplicarKit, disponibilidadeKit,
  } = useEstoque();

  const [busca, setBusca] = useState('');
  const [visao, setVisao] = useState<Visao>({ tipo: 'inicio' });
  const [somenteBaixo, setSomenteBaixo] = useState(false);

  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [editandoItem, setEditandoItem] = useState<EstoqueItem | undefined>(undefined);
  const [excluindoItem, setExcluindoItem] = useState<EstoqueItem | null>(null);

  const [modalKitAberto, setModalKitAberto] = useState(false);
  const [editandoKit, setEditandoKit] = useState<EstoqueKit | undefined>(undefined);
  const [excluindoKit, setExcluindoKit] = useState<EstoqueKit | null>(null);

  const [aplicandoKitId, setAplicandoKitId] = useState<string | null>(null);
  const [erroAplicarKit, setErroAplicarKit] = useState<Record<string, string>>({});

  const itensPorId = useMemo(() => new Map(itens.map(i => [i.id, i])), [itens]);

  const resultadosBusca = useMemo(
    () => (busca.trim() ? filtrarItensPorBusca(itens, busca) : null),
    [busca, itens]
  );

  const itensDaVisao = useMemo(() => {
    if (visao.tipo === 'categoria') {
      const daCategoria = itens.filter(i => i.categoria === visao.categoria);
      return somenteBaixo ? daCategoria.filter(itemEstaBaixo) : daCategoria;
    }
    if (visao.tipo === 'baixo-estoque') return itens.filter(itemEstaBaixo);
    return [];
  }, [itens, visao, somenteBaixo]);

  function abrirNovoProduto() {
    setEditandoItem(undefined);
    setModalProdutoAberto(true);
  }
  function abrirEdicaoProduto(item: EstoqueItem) {
    setEditandoItem(item);
    setModalProdutoAberto(true);
  }
  function salvarProduto(input: NovoEstoqueItemInput) {
    if (editandoItem) atualizarItem(editandoItem.id, input);
    else criarItem(input);
    setModalProdutoAberto(false);
    setEditandoItem(undefined);
  }

  function abrirNovoKit() {
    setEditandoKit(undefined);
    setModalKitAberto(true);
  }
  function abrirEdicaoKit(kit: EstoqueKit) {
    setEditandoKit(kit);
    setModalKitAberto(true);
  }
  function salvarKit(input: NovoEstoqueKitInput) {
    if (editandoKit) atualizarKit(editandoKit.id, input);
    else criarKit(input);
    setModalKitAberto(false);
    setEditandoKit(undefined);
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

  function selecionarCategoria(categoria: string) {
    setSomenteBaixo(false);
    setVisao({ tipo: 'categoria', categoria });
  }

  const BTN_PRIMARIO = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
    background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 9,
    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  } as const;

  const BTN_SECUNDARIO = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
    background: 'transparent', color: tokens.color.ferrari, border: `1px solid ${tokens.color.ferrari}`, borderRadius: 9,
    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  } as const;

  // ── conteúdo ──────────────────────────────────────────────────────────────

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.3rem', color: tokens.color.text, margin: 0 }}>
                Estoque
              </h2>
              {usandoDadosDemo && (
                <span
                  style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: tokens.color.warn, background: tokens.color.warnBg, border: `1px solid ${tokens.color.warnBorder}`,
                    borderRadius: 6, padding: '2px 7px',
                  }}
                >
                  dados de demonstração
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              Peças, insumos e kits da oficina.
            </p>
          </div>
        </div>

        {!erro && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={abrirNovoKit} style={BTN_SECUNDARIO}>
              <span style={{ display: 'flex' }}>{Icons.plus}</span>
              {!isMobile && 'Criar Kit'}
            </button>
            <button onClick={abrirNovoProduto} style={BTN_PRIMARIO}>
              <span style={{ display: 'flex' }}>{Icons.plus}</span>
              {!isMobile && 'Adicionar Produto'}
            </button>
          </div>
        )}
      </div>

      <EstoqueFilters busca={busca} onBusca={setBusca} />

      {/* corpo */}
      <div
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: isMobile ? '12px 12px 32px' : '18px 28px 36px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {erro && !carregando && (
          <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: tokens.color.crit, display: 'flex' }}>{Icons.alert}</span>
              <span style={{ fontSize: '0.85rem', color: tokens.color.text }}>{erro}</span>
            </div>
            <button
              onClick={recarregar}
              style={{ padding: '7px 14px', background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
            >
              Tentar novamente
            </button>
          </Card>
        )}

        {!erro && (
          <>
            <EstoqueStats stats={stats} loading={carregando} />

            {carregando ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} style={{ padding: 14 }}>
                    <Skeleton h={140} r={8} />
                  </Card>
                ))}
              </div>
            ) : resultadosBusca ? (
              resultadosBusca.length === 0 ? (
                <Card style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: tokens.color.ferrariMid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.ferrari }}>
                    {Icons.search}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: tokens.color.text }}>Nenhum item encontrado</div>
                  <div style={{ fontSize: '0.82rem', color: tokens.color.muted, maxWidth: 320 }}>
                    Tente buscar por outro nome ou por um veículo de aplicação.
                  </div>
                </Card>
              ) : (
                <div>
                  <div style={{ fontSize: '0.78rem', color: tokens.color.muted, marginBottom: 10 }}>
                    {resultadosBusca.length} {resultadosBusca.length === 1 ? 'resultado' : 'resultados'} pra &quot;{busca}&quot;
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                    {resultadosBusca.map(item => (
                      <EstoqueItemCard
                        key={item.id}
                        item={item}
                        onEdit={() => abrirEdicaoProduto(item)}
                        onDelete={() => setExcluindoItem(item)}
                      />
                    ))}
                  </div>
                </div>
              )
            ) : (
              <>
                <QuarentenaAlert itens={itens} />

                {visao.tipo === 'inicio' && (
                  <EstoqueBaixoTira itens={itens} onVerTodos={() => setVisao({ tipo: 'baixo-estoque' })} />
                )}

                {visao.tipo === 'inicio' && (
                  <>
                    <CategoriaGrid itens={itens} onSelecionar={selecionarCategoria} />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Kits</h3>
                        <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>({kits.length})</span>
                      </div>

                      {kits.length === 0 ? (
                        <Card style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                          <div style={{ width: 52, height: 52, borderRadius: 14, background: tokens.color.ferrariMid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.ferrari }}>
                            {Icons.box}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>Nenhum kit cadastrado</div>
                          <div style={{ fontSize: '0.8rem', color: tokens.color.muted, maxWidth: 300 }}>
                            Combine itens já cadastrados numa receita pra dar baixa rápida em serviços comuns.
                          </div>
                        </Card>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                          {kits.map(kit => (
                            <KitCard
                              key={kit.id}
                              kit={kit}
                              itensPorId={itensPorId}
                              disponibilidade={disponibilidadeKit(kit)}
                              aplicando={aplicandoKitId === kit.id}
                              erro={erroAplicarKit[kit.id] ?? null}
                              onAplicar={() => handleAplicarKit(kit)}
                              onEdit={() => abrirEdicaoKit(kit)}
                              onDelete={() => setExcluindoKit(kit)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {visao.tipo !== 'inicio' && (
                  <div>
                    <button
                      onClick={() => setVisao({ tipo: 'inicio' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.ferrari, fontSize: '0.82rem', fontWeight: 700, padding: 0, marginBottom: 12 }}
                    >
                      <span style={{ display: 'flex' }}>{Icons.chevL}</span>
                      Categorias
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>
                        {visao.tipo === 'categoria' ? visao.categoria : 'Estoque Baixo'}
                        <span style={{ fontWeight: 600, color: tokens.color.muted, fontSize: '0.8rem', marginLeft: 8 }}>
                          ({itensDaVisao.length})
                        </span>
                      </h3>
                      {visao.tipo === 'categoria' && (
                        <button
                          onClick={() => setSomenteBaixo(v => !v)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
                            border: `1px solid ${somenteBaixo ? tokens.color.warn : tokens.color.border}`,
                            background: somenteBaixo ? tokens.color.warnBg : 'transparent',
                            color: somenteBaixo ? tokens.color.warn : tokens.color.textSecond,
                            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ display: 'flex' }}>{Icons.alert}</span>
                          Só estoque baixo
                        </button>
                      )}
                    </div>

                    {itensDaVisao.length === 0 ? (
                      <Card style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: tokens.color.ferrariMid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.ferrari }}>
                          {Icons.box}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>Nenhum item encontrado</div>
                        <div style={{ fontSize: '0.8rem', color: tokens.color.muted, maxWidth: 300 }}>
                          {somenteBaixo ? 'Nenhum item em baixo estoque nesta categoria.' : 'Cadastre o primeiro item pra começar.'}
                        </div>
                      </Card>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                        {itensDaVisao.map(item => (
                          <EstoqueItemCard
                            key={item.id}
                            item={item}
                            onEdit={() => abrirEdicaoProduto(item)}
                            onDelete={() => setExcluindoItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  const modals = (
    <>
      {modalProdutoAberto && (
        <ProdutoModal
          item={editandoItem}
          categoriaInicial={visao.tipo === 'categoria' ? visao.categoria : undefined}
          onSave={salvarProduto}
          onClose={() => { setModalProdutoAberto(false); setEditandoItem(undefined); }}
        />
      )}
      {excluindoItem && (
        <ConfirmDeleteModal
          nome={excluindoItem.nome}
          entidadeLabel="produto"
          onConfirm={() => excluirItem(excluindoItem.id)}
          onClose={() => setExcluindoItem(null)}
        />
      )}
      {modalKitAberto && (
        <CriarKitModal
          kit={editandoKit}
          itensDisponiveis={itens}
          onSave={salvarKit}
          onClose={() => { setModalKitAberto(false); setEditandoKit(undefined); }}
        />
      )}
      {excluindoKit && (
        <ConfirmDeleteModal
          nome={excluindoKit.nome}
          entidadeLabel="kit"
          onConfirm={() => excluirKit(excluindoKit.id)}
          onClose={() => setExcluindoKit(null)}
        />
      )}
    </>
  );

  // ── layout ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="estoque" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
        {modals}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="estoque" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {content}
      </main>
      {modals}
    </div>
  );
}
