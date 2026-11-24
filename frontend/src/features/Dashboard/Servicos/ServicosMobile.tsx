import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Skeleton } from '../Primitives';
import { formatPreco } from '../../../utils/servicos_utils';
import type { ServicoItem } from '../../../types/servico';
import { IcBuscar, IcFiltros, IcMais, IcReticencias, IcSetaEsq } from './icones';
import './ServicosMobile.css';

type StatusFiltro = 'todos' | 'ativos' | 'inativos';

interface Props {
  servicos: ServicoItem[];
  loading: boolean;
  erro: string | null;
  erroAcao: string | null;
  onLimparErroAcao: () => void;
  kitPorServicoId: Map<string, string>;
  onVoltar: () => void;
  onNovo: () => void;
  onEditar: (servico: ServicoItem) => void;
  onToggleAtivo: (id: string) => void;
  onExcluir: (servico: ServicoItem) => void;
}

const POR_PAGINA = 12;

export function ServicosMobile({
  servicos,
  loading,
  erro,
  erroAcao,
  onLimparErroAcao,
  kitPorServicoId,
  onVoltar,
  onNovo,
  onEditar,
  onToggleAtivo,
  onExcluir,
}: Props) {
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [categoria, setCategoria] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [filtrosSheetAberto, setFiltrosSheetAberto] = useState(false);
  const [acaoItem, setAcaoItem] = useState<ServicoItem | null>(null);

  const { ativosCount, inativosCount, categoriasOrdenadas } = useMemo(() => {
    let ativos = 0;
    let inativos = 0;
    const porCat = new Map<string, number>();

    for (const s of servicos) {
      if (s.ativo) ativos++;
      else inativos++;
      porCat.set(s.categoria, (porCat.get(s.categoria) ?? 0) + 1);
    }

    const cats = Array.from(porCat.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR'));

    return { ativosCount: ativos, inativosCount: inativos, categoriasOrdenadas: cats };
  }, [servicos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return servicos.filter(s => {
      if (statusFiltro === 'ativos' && !s.ativo) return false;
      if (statusFiltro === 'inativos' && s.ativo) return false;
      if (categoria !== 'todas' && s.categoria !== categoria) return false;
      if (!q) return true;
      return (
        s.nome.toLowerCase().includes(q) ||
        s.categoria.toLowerCase().includes(q) ||
        (s.descricao ?? '').toLowerCase().includes(q)
      );
    });
  }, [servicos, statusFiltro, categoria, busca]);

  useEffect(() => {
    setLimite(POR_PAGINA);
  }, [statusFiltro, categoria, busca]);

  useEffect(() => {
    if (!filtrosSheetAberto && !acaoItem) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltrosSheetAberto(false);
        setAcaoItem(null);
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [filtrosSheetAberto, acaoItem]);

  const visiveis = filtrados.slice(0, limite);
  const restantes = filtrados.length - visiveis.length;
  const filtrosAtivosCount = (categoria !== 'todas' ? 1 : 0) + (statusFiltro !== 'todos' ? 1 : 0);

  const subtitulo =
    ativosCount === 1
      ? '1 serviço ativo · orçamentos'
      : `${ativosCount} serviços ativos · orçamentos`;

  return (
    <div className="svm-page">
      {/* Topo */}
      <header className="svm-topo">
        <div className="svm-barra">
          <button
            type="button"
            className="svm-voltar"
            onClick={onVoltar}
            aria-label="Voltar para a Visão Geral"
          >
            {IcSetaEsq}
          </button>

          <div className="svm-barra__titulos">
            <h1 className="svm-titulo">Catálogo de serviços</h1>
            <p className="svm-subtitulo">{loading ? 'Carregando serviços…' : subtitulo}</p>
          </div>

          <button
            type="button"
            className="svm-novo-btn"
            onClick={onNovo}
            aria-label="Novo serviço"
          >
            {IcMais}
          </button>
        </div>

        <div className="svm-busca-linha">
          <label className="svm-busca">
            {IcBuscar}
            <input
              name="busca_servicos_mobile"
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar serviço"
              aria-label="Buscar serviço"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>

          <button
            type="button"
            className="svm-filtros-btn"
            aria-haspopup="dialog"
            onClick={() => setFiltrosSheetAberto(true)}
          >
            {IcFiltros}
            Filtros
            {filtrosAtivosCount > 0 && (
              <span className="svm-filtros-btn__contador">{filtrosAtivosCount}</span>
            )}
          </button>
        </div>

        <div className="svm-filtros" role="group" aria-label="Filtros rápidos">
          <button
            type="button"
            className="svm-chip"
            aria-pressed={statusFiltro === 'ativos'}
            onClick={() => setStatusFiltro(prev => (prev === 'ativos' ? 'todos' : 'ativos'))}
          >
            Ativos
            <span className="svm-chip__qtd">{ativosCount}</span>
          </button>

          <button
            type="button"
            className="svm-chip"
            aria-pressed={statusFiltro === 'inativos'}
            onClick={() => setStatusFiltro(prev => (prev === 'inativos' ? 'todos' : 'inativos'))}
          >
            Inativos
            <span className="svm-chip__qtd">{inativosCount}</span>
          </button>
        </div>
      </header>

      {erro && (
        <div className="svm-aviso" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {erroAcao && (
        <div className="svm-aviso" role="alert">
          <span>{erroAcao}</span>
          <button type="button" className="svm-aviso__fechar" onClick={onLimparErroAcao}>
            Fechar
          </button>
        </div>
      )}

      {/* Lista */}
      <section className="svm-lista" aria-label="Lista de serviços" aria-busy={loading}>
        {loading ? (
          <div className="svm-carregando">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} h={72} r={6} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="svm-vazio">
            <strong>Nenhum serviço encontrado</strong>
            <span>
              {busca || filtrosAtivosCount > 0
                ? 'Ajuste a busca ou os filtros aplicados.'
                : 'Cadastre o primeiro serviço do catálogo para começar.'}
            </span>
          </div>
        ) : (
          <>
            <ul className="svm-itens">
              {visiveis.map(s => {
                const kitNome = kitPorServicoId.get(s.id);
                return (
                  <li
                    key={s.id}
                    className={`svm-cartao${s.ativo ? '' : ' svm-cartao--inativo'}`}
                    onClick={() => onEditar(s)}
                  >
                    <div className="svm-linha1">
                      <div className="svm-titulo-bloco">
                        <span className="svm-nome">{s.nome}</span>
                        {kitNome && <span className="svm-kit">Kit: {kitNome}</span>}
                      </div>
                      <span className="svm-preco">R$ {formatPreco(s.preco)}</span>
                    </div>

                    <div className="svm-linha2">
                      <span className="svm-meta">
                        {s.categoria} · {s.duracao}
                      </span>

                      <div className="svm-controles" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={s.ativo}
                          aria-label={`${s.nome}: ${s.ativo ? 'Ativo' : 'Inativo'}`}
                          className="svm-situacao-btn"
                          onClick={() => onToggleAtivo(s.id)}
                        >
                          <span className="svm-switch" aria-hidden="true">
                            <span className="svm-switch__thumb" />
                          </span>
                          <span className="svm-situacao-rotulo">{s.ativo ? 'Ativo' : 'Inativo'}</span>
                        </button>

                        <button
                          type="button"
                          className="svm-mais"
                          aria-label={`Mais ações de ${s.nome}`}
                          aria-haspopup="dialog"
                          onClick={() => setAcaoItem(s)}
                        >
                          {IcReticencias}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {restantes > 0 && (
              <button
                type="button"
                className="svm-mais-pag"
                onClick={() => setLimite(l => l + POR_PAGINA)}
              >
                Mostrar mais {Math.min(restantes, POR_PAGINA)}
              </button>
            )}
          </>
        )}
      </section>

      {/* Bottom Sheet: Filtros */}
      {filtrosSheetAberto &&
        createPortal(
          <div className="svm-sheet-backdrop" onClick={() => setFiltrosSheetAberto(false)}>
            <div
              className="svm-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Filtros do catálogo"
              onClick={e => e.stopPropagation()}
            >
              <div className="svm-sheet__grab" aria-hidden="true" />
              <h2 className="svm-sheet__titulo">Filtros</h2>

              <label className="svm-sheet__campo">
                <span>Situação</span>
                <select
                  value={statusFiltro}
                  onChange={e => setStatusFiltro(e.target.value as StatusFiltro)}
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Somente ativos</option>
                  <option value="inativos">Somente inativos</option>
                </select>
              </label>

              <label className="svm-sheet__campo">
                <span>Categoria</span>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                  <option value="todas">Todas as categorias</option>
                  {categoriasOrdenadas.map(c => (
                    <option key={c.nome} value={c.nome}>
                      {c.nome} ({c.qtd})
                    </option>
                  ))}
                </select>
              </label>

              <div className="svm-sheet__acoes">
                <button
                  type="button"
                  className="svm-sheet__btn svm-sheet__btn--sec"
                  onClick={() => {
                    setStatusFiltro('todos');
                    setCategoria('todas');
                  }}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  className="svm-sheet__btn svm-sheet__btn--pri"
                  onClick={() => setFiltrosSheetAberto(false)}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Bottom Sheet: Ações do serviço */}
      {acaoItem &&
        createPortal(
          <div className="svm-sheet-backdrop" onClick={() => setAcaoItem(null)}>
            <div
              className="svm-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Ações para ${acaoItem.nome}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="svm-sheet__grab" aria-hidden="true" />
              <h2 className="svm-sheet__titulo">{acaoItem.nome}</h2>

              <button
                type="button"
                className="svm-sheet__opt"
                onClick={() => {
                  const alvo = acaoItem;
                  setAcaoItem(null);
                  onEditar(alvo);
                }}
              >
                Editar serviço
              </button>

              <button
                type="button"
                className="svm-sheet__opt"
                onClick={() => {
                  const id = acaoItem.id;
                  setAcaoItem(null);
                  onToggleAtivo(id);
                }}
              >
                {acaoItem.ativo ? 'Desativar serviço' : 'Ativar serviço'}
              </button>

              <button
                type="button"
                className="svm-sheet__opt svm-sheet__opt--perigo"
                onClick={() => {
                  const alvo = acaoItem;
                  setAcaoItem(null);
                  onExcluir(alvo);
                }}
              >
                Excluir serviço
              </button>

              <button
                type="button"
                className="svm-sheet__cancel"
                onClick={() => setAcaoItem(null)}
              >
                Cancelar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}