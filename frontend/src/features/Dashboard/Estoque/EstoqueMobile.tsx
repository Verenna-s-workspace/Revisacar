import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '../Primitives';
import { Valor } from '../../../components/Privacidade';
import { Select } from '../../../components/inputs/select';
import { Button, Modal, ModalHeader, ModalBody, ModalSection, ModalFooter } from '../../../components/system';
import { formatBRL } from '../../../utils/dashboard';
import { filtrarItensPorBusca, itemEstaBaixo, ordenarPorCriticidade } from '../../../utils/estoque_utils';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';
import { agruparCategorias } from './categorias';
import { KitCartao, ProdutoCartao } from './EstoqueCartao';
import { QuarentenaAviso } from './QuarentenaAviso';
import { IcAlerta, IcBuscar, IcCaixa, IcFechar, IcFiltros, IcMais } from './icones';
// Paleta dos selos/linhas (recusada, pendente, finalizada) vem do status da OS. Só define --st-*.
import '../Ordens/Status.css';
import './estoqueDesktop.css';   // selo (.es-selo), miniatura (.es-foto) e ícones (.es-ic) compartilhados
import './estoqueMobile.css';

const POR_PAGINA = 20;

type FiltroRapido = 'todos' | 'baixo' | 'kits';
const FILTROS: FiltroRapido[] = ['todos', 'baixo', 'kits'];
const ROTULO_FILTRO: Record<FiltroRapido, string> = { todos: 'Todos', baixo: 'Estoque baixo', kits: 'Kits' };

interface EstoqueMobileProps {
  itens: EstoqueItem[];
  kits: EstoqueKit[];
  carregando: boolean;
  erro: string | null;
  valorTotal: number;
  busca: string;
  onBusca: (texto: string) => void;
  erroExcluir: string | null;
  onFecharErroExcluir: () => void;
  onRecarregar: () => void;
  /** `categoria`: categoria filtrada no momento, pra já vir selecionada no modal. */
  onNovoProduto: (categoria?: string) => void;
  onNovoKit: () => void;
  /** Tocar num cartão abre o modal de detalhes (de lá se edita/exclui). */
  onAbrirProduto: (item: EstoqueItem) => void;
  onAbrirKit: (kit: EstoqueKit) => void;
  disponibilidadeKit: (kit: EstoqueKit) => number;
}

export function EstoqueMobile({
  itens, kits, carregando, erro, valorTotal, busca, onBusca,
  erroExcluir, onFecharErroExcluir, onRecarregar,
  onNovoProduto, onNovoKit, onAbrirProduto, onAbrirKit, disponibilidadeKit,
}: EstoqueMobileProps) {
  const [filtro, setFiltro] = useState<FiltroRapido>('todos');
  const [categoria, setCategoria] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  const emKits = filtro === 'kits';
  const buscando = busca.trim().length > 0;

  const qtdBaixos = useMemo(() => itens.filter(itemEstaBaixo).length, [itens]);
  const grupos = useMemo(() => agruparCategorias(itens), [itens]);

  const itensFiltrados = useMemo(() => {
    // "Estoque baixo": mais crítico primeiro. Busca e categoria combinam com qualquer filtro rápido.
    const base = filtro === 'baixo' ? ordenarPorCriticidade(itens.filter(itemEstaBaixo)) : itens;
    const porBusca = buscando ? filtrarItensPorBusca(base, busca) : base;
    return categoria ? porBusca.filter(i => i.categoria === categoria) : porBusca;
  }, [itens, filtro, busca, buscando, categoria]);

  const kitsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter(k => k.nome.toLowerCase().includes(q) || (k.descricao ?? '').toLowerCase().includes(q));
  }, [kits, busca]);

  useEffect(() => { setLimite(POR_PAGINA); }, [filtro, busca, categoria]);

  const total = emKits ? kitsFiltrados.length : itensFiltrados.length;
  const restantes = Math.max(0, total - limite);
  const itensVisiveis = itensFiltrados.slice(0, limite);
  const kitsVisiveis = kitsFiltrados.slice(0, limite);

  const contagem: Record<FiltroRapido, number> = { todos: itens.length, baixo: qtdBaixos, kits: kits.length };

  const opcoesCategoria = useMemo(() => [
    { value: '', label: 'Todas as categorias' },
    ...grupos.map(g => ({
      group: g.grupo,
      options: g.opcoes.map(o => ({ value: o.categoria, label: `${o.categoria} (${o.qtd})` })),
    })),
  ], [grupos]);

  function escolherFiltro(f: FiltroRapido) {
    setFiltro(f);
    if (f === 'kits') setFiltrosAbertos(false); // categoria só vale pra itens
  }

  const mensagemVazia = emKits
    ? (kits.length === 0
      ? { titulo: 'Nenhum kit cadastrado', texto: 'Combine itens já cadastrados numa receita pra dar baixa rápida em serviços comuns' }
      : { titulo: 'Nenhum kit encontrado', texto: 'Tente buscar por outro nome' })
    : (itens.length === 0 && !buscando
      ? { titulo: 'Nenhum item cadastrado', texto: 'Cadastre o primeiro item pra começar' }
      : { titulo: 'Nenhum item encontrado', texto: 'Ajuste os filtros ou busque por outro nome ou veículo de aplicação' });

  return (
    <div className="esm-page">
      {/* Topo: título + ações + busca + chips */}
      <header className="esm-topo">
        <div className="esm-barra">
          <div className="esm-barra__titulos">
            <h1 className="esm-titulo">Estoque</h1>
            <div className="esm-subtitulo">
              {carregando
                ? <Skeleton w={190} h={14} r={4} />
                : <>{itens.length} {itens.length === 1 ? 'item' : 'itens'} · {kits.length} {kits.length === 1 ? 'kit' : 'kits'} · <Valor texto={formatBRL(valorTotal)} /></>}
            </div>
          </div>
          {!erro && (
            <>
              <button type="button" className="esm-acao esm-acao--borda" aria-label="Novo kit" onClick={onNovoKit}>
                {IcCaixa}
              </button>
              <button type="button" className="esm-acao esm-acao--primaria" aria-label="Novo produto" onClick={() => onNovoProduto(categoria || undefined)}>
                {IcMais}
              </button>
            </>
          )}
        </div>

        {!erro && (
          <>
            <div className="esm-busca-linha">
              <label className="esm-busca">
                {IcBuscar}
                <input
                  ref={buscaRef}
                  name="busca_estoque"
                  type="search"
                  value={busca}
                  onChange={e => onBusca(e.target.value)}
                  placeholder={emKits ? 'Buscar kit por nome' : 'Buscar por nome ou aplicação'}
                  aria-label={emKits ? 'Buscar kits por nome' : 'Buscar itens por nome ou aplicação'}
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </label>
              <button
                type="button"
                className="esm-acao esm-acao--borda esm-filtro-btn"
                aria-label={categoria ? `Filtros (categoria: ${categoria})` : 'Filtros'}
                aria-haspopup="dialog"
                disabled={emKits}
                onClick={() => setFiltrosAbertos(true)}
              >
                {IcFiltros}
                {categoria && !emKits && <span className="esm-filtro-btn__ponto" aria-hidden="true" />}
              </button>
            </div>

            <div className="esm-filtros" role="group" aria-label="Filtrar o estoque">
              {FILTROS.map(f => (
                <button
                  key={f}
                  type="button"
                  className="esm-chip"
                  aria-pressed={filtro === f}
                  onClick={() => escolherFiltro(f)}
                >
                  {ROTULO_FILTRO[f]}
                  <span className="esm-chip__qtd">{contagem[f]}</span>
                </button>
              ))}
              {categoria && !emKits && (
                <button type="button" className="esm-pilula" onClick={() => setCategoria('')} aria-label={`Remover filtro da categoria ${categoria}`}>
                  {categoria}
                  {IcFechar}
                </button>
              )}
            </div>
          </>
        )}
      </header>

      {/* Avisos */}
      {erroExcluir && (
        <div className="esm-aviso-wrap">
          <div className="es-aviso os-status--recusada" role="alert">
            <span className="es-aviso__icone">{IcAlerta}</span>
            <p className="es-aviso__texto">{erroExcluir}</p>
            <button type="button" className="esm-btn" onClick={onFecharErroExcluir}>Fechar</button>
          </div>
        </div>
      )}
      {erro && !carregando && (
        <div className="esm-aviso-wrap">
          <div className="es-aviso os-status--recusada" role="alert">
            <span className="es-aviso__icone">{IcAlerta}</span>
            <p className="es-aviso__texto">{erro}</p>
            <button type="button" className="esm-btn esm-btn--primario" onClick={onRecarregar}>Tentar novamente</button>
          </div>
        </div>
      )}
      {!erro && !carregando && !buscando && (
        <div className="esm-aviso-wrap"><QuarentenaAviso itens={itens} /></div>
      )}

      {/* Lista */}
      {!erro && (
        <section className="esm-lista" aria-label={emKits ? 'Lista de kits' : 'Lista de itens do estoque'} aria-busy={carregando}>
          {carregando ? (
            <div className="esm-carregando">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={68} r={6} />)}
            </div>
          ) : total === 0 ? (
            <div className="esm-vazio">
              <span className="esm-vazio__icone">{IcCaixa}</span>
              <strong>{mensagemVazia.titulo}</strong>
              <span>{mensagemVazia.texto}</span>
            </div>
          ) : (
            <>
              <ul className="esm-itens">
                {emKits
                  ? kitsVisiveis.map(k => (
                    <KitCartao key={k.id} kit={k} disponibilidade={disponibilidadeKit(k)} onAbrir={onAbrirKit} />
                  ))
                  : itensVisiveis.map(i => <ProdutoCartao key={i.id} item={i} onAbrir={onAbrirProduto} />)}
              </ul>
              {restantes > 0 && (
                <button type="button" className="esm-mais" onClick={() => setLimite(l => l + POR_PAGINA)}>
                  Mostrar mais {Math.min(restantes, POR_PAGINA)}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* Folha de filtros (mesmo padrão de modal; no celular abre de baixo pra cima) */}
      {filtrosAbertos && (
        <Modal size="sm" onClose={() => setFiltrosAbertos(false)}>
          <ModalHeader icon={IcFiltros} title="Filtros" description="Refine a lista de itens" />
          <ModalBody>
            <ModalSection icon={IcFiltros} title="Filtrar itens">
              <Select name="filtro_categoria" label="Categoria" value={categoria} onChangeValue={setCategoria} options={opcoesCategoria} />
            </ModalSection>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" disabled={!categoria} onClick={() => setCategoria('')}>Limpar</Button>
            <Button variant="primary" onClick={() => setFiltrosAbertos(false)}>Concluir</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
