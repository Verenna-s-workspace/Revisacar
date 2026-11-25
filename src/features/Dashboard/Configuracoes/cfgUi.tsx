import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { IcAlerta, IcCheck } from './icones';
import './configuracoes.css';

/* Peças reutilizáveis da tela de Configurações. Os estilos (classes cfg-*) vivem em
 * configuracoes.css e só valem dentro de .cfg-page. */

// ── Navegação lateral ────────────────────────────────────────────────────────

export interface ItemNav { id: string; rotulo: string; emBreve?: boolean }

export function NavSecoes({ itens, ativo, onSelecionar }: {
  itens: ItemNav[];
  ativo: string;
  onSelecionar: (id: string) => void;
}) {
  return (
    <nav className="cfg-nav" aria-label="Seções das configurações">
      {itens.map(item => {
        const selecionado = item.id === ativo;
        return (
          <button
            key={item.id}
            type="button"
            className={`cfg-nav__item${selecionado ? ' cfg-nav__item--ativo' : ''}`}
            aria-current={selecionado ? 'page' : undefined}
            onClick={() => onSelecionar(item.id)}
          >
            <span className="cfg-nav__rotulo">{item.rotulo}</span>
            {item.emBreve && <span className="cfg-nav__tag">Em breve</span>}
          </button>
        );
      })}
    </nav>
  );
}

// ── Painel de uma seção ──────────────────────────────────────────────────────

/** O "cartão" da direita: título (h2) + descrição + o conteúdo da seção. */
export function PainelSecao({ id, titulo, descricao, children }: {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  const tituloId = `cfg-titulo-${id}`;
  return (
    <section className="cfg-painel" aria-labelledby={tituloId}>
      <header className="cfg-painel__cabecalho">
        <h2 id={tituloId} className="cfg-painel__titulo">{titulo}</h2>
        {descricao && <p className="cfg-painel__descricao">{descricao}</p>}
      </header>
      {children}
    </section>
  );
}

/** Rodapé com a linha de cima e os botões à direita (Descartar / Salvar). */
export function RodapeAcoes({ children }: { children: ReactNode }) {
  return <div className="cfg-acoes">{children}</div>;
}

// ── Avisos e estados ─────────────────────────────────────────────────────────

export function Aviso({ tom, children }: { tom: 'ok' | 'crit'; children: ReactNode }) {
  return (
    <div className={`cfg-aviso cfg-aviso--${tom}`} role={tom === 'crit' ? 'alert' : 'status'}>
      {tom === 'crit' ? IcAlerta : IcCheck}
      <span>{children}</span>
    </div>
  );
}

/** Carregando, vazio ou erro de uma lista/bloco. */
export function EstadoMensagem({ icone, titulo, acao, children }: {
  icone?: ReactNode;
  titulo?: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="cfg-estado">
      {icone && <span className="cfg-estado__icone">{icone}</span>}
      {titulo && <span className="cfg-estado__titulo">{titulo}</span>}
      {children && <span>{children}</span>}
      {acao && <div className="cfg-estado__acao">{acao}</div>}
    </div>
  );
}

// ── Interruptor (liga/desliga) ───────────────────────────────────────────────

export function Interruptor({ ligado, onAlternar, rotulo }: {
  ligado: boolean;
  onAlternar: () => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      className="cfg-interruptor"
      onClick={onAlternar}
    />
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

/** Janela de formulário. Esc e clique fora fecham, menos enquanto `bloqueado` (envio em andamento). */
export function ModalCfg({ titulo, tom, bloqueado = false, onFechar, children }: {
  titulo: string;
  tom?: 'crit';
  bloqueado?: boolean;
  onFechar: () => void;
  children: ReactNode;
}) {
  const tituloId = useId();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape' && !bloqueado) onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [bloqueado, onFechar]);

  return (
    <div
      className="cfg-modal-fundo"
      onMouseDown={e => { if (e.target === e.currentTarget && !bloqueado) onFechar(); }}
    >
      <div className="cfg-modal" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <h3 id={tituloId} className={`cfg-modal__titulo${tom === 'crit' ? ' cfg-modal__titulo--crit' : ''}`}>{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
