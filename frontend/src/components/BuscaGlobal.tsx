import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as TeclaReact } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import { ROTULO_STATUS } from '../utils/ordem_status';
import type { StatusOrdem } from '../utils/ordem_status';
import type { GrupoBusca, RespostaBusca, ResultadoBusca, TipoResultadoBusca } from '../types/busca';
import '../styles/busca-global.css';

/**
 * Paleta da busca global (⌘K / Ctrl+K). Procura clientes, veículos e ordens de serviço da oficina
 * (GET /busca) e devolve o resultado escolhido em `onEscolher` — quem recebe decide como abri-lo.
 *
 * - Espera 250 ms depois da última tecla e só busca com 2+ caracteres.
 * - Resposta de uma busca antiga nunca sobrescreve a de uma mais nova (contador `pedido`).
 * - Teclado: ↑ ↓ percorrem, Enter abre, Esc fecha. O foco volta ao que estava antes ao fechar.
 */

const MIN_CARACTERES = 2;
const ATRASO_MS = 250;

const SECOES: Array<{ chave: 'clientes' | 'veiculos' | 'ordens'; titulo: string }> = [
  { chave: 'clientes', titulo: 'Clientes' },
  { chave: 'veiculos', titulo: 'Veículos' },
  { chave: 'ordens', titulo: 'Ordens de serviço' },
];

const ico = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
};
const ICONES: Record<TipoResultadoBusca, React.ReactNode> = {
  cliente: <svg {...ico}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  veiculo: <svg {...ico}><path d="M5 17h14M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1z" /><circle cx="7" cy="17" r="0.5" /><circle cx="17" cy="17" r="0.5" /></svg>,
  ordem: <svg {...ico}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>,
};
const IcLupa = <svg {...ico}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;

interface Secao { chave: string; titulo: string; grupo: GrupoBusca; inicio: number }

interface Props {
  onFechar: () => void;
  onEscolher: (r: ResultadoBusca) => void;
}

export function BuscaGlobal({ onFechar, onEscolher }: Props) {
  const idBase = useId();
  const idLista = `${idBase}-lista`;
  const entradaRef = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState<RespostaBusca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ativo, setAtivo] = useState(0);

  const consulta = texto.trim();
  const busca = consulta.length >= MIN_CARACTERES;

  // Devolve o foco a quem o tinha antes de abrir (botão da top-bar ou o que estava digitando).
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    entradaRef.current?.focus();
    return () => { if (anterior && document.contains(anterior)) anterior.focus(); };
  }, []);

  useEffect(() => {
    const meu = ++pedido.current;
    if (!busca) {
      setResposta(null); setErro(''); setCarregando(false);
      return;
    }
    setCarregando(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await api.buscaGlobal(consulta) as RespostaBusca;
        if (meu !== pedido.current) return;
        setResposta(r); setErro(''); setAtivo(0);
      } catch (e) {
        if (meu !== pedido.current) return;
        setResposta(null);
        setErro(mensagemDoErro(e, 'Não foi possível buscar agora.'));
      } finally {
        if (meu === pedido.current) setCarregando(false);
      }
    }, ATRASO_MS);
    return () => window.clearTimeout(t);
  }, [consulta, busca]);

  const { secoes, linhas } = useMemo(() => {
    const secoes: Secao[] = [];
    const linhas: ResultadoBusca[] = [];
    for (const s of SECOES) {
      const grupo = resposta?.[s.chave];
      if (!grupo || grupo.itens.length === 0) continue;
      secoes.push({ ...s, grupo, inicio: linhas.length });
      linhas.push(...grupo.itens);
    }
    return { secoes, linhas };
  }, [resposta]);

  useEffect(() => {
    document.getElementById(`${idBase}-op-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, idBase]);

  const aoTeclar = (e: TeclaReact<HTMLElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onFechar(); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; }  // o foco fica na caixa de busca
    if (linhas.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => (i + 1) % linhas.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(i => (i - 1 + linhas.length) % linhas.length); }
    else if (e.key === 'Enter' && linhas[ativo]) { e.preventDefault(); onEscolher(linhas[ativo]); }
  };

  const vazio = busca && !carregando && !erro && resposta !== null && linhas.length === 0;
  const parcial = (resposta?.indisponiveis?.length ?? 0) > 0;

  let aviso = '';
  if (!busca) aviso = 'Digite ao menos 2 letras ou números: nome do cliente, placa, telefone ou número da OS.';
  else if (erro) aviso = erro;
  else if (carregando && linhas.length === 0) aviso = 'Buscando…';
  else if (vazio) aviso = `Nada encontrado para “${consulta}”. Confira a grafia ou tente só parte do nome ou da placa.`;

  return (
    <div className="rv-busca" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="rv-busca__painel" role="dialog" aria-modal="true" aria-label="Busca global" onKeyDown={aoTeclar}>
        <div className="rv-busca__campo">
          {IcLupa}
          <input
            ref={entradaRef}
            className="rv-busca__entrada"
            type="text"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Buscar OS, cliente ou placa"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            maxLength={80}
            role="combobox"
            aria-expanded={linhas.length > 0}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={linhas.length > 0 ? `${idBase}-op-${ativo}` : undefined}
            aria-label="Buscar OS, cliente ou placa"
          />
          <kbd className="rv-busca__esc">Esc</kbd>
        </div>

        <div className="rv-busca__corpo">
          {aviso && <p className="rv-busca__aviso" role="status" aria-live="polite">{aviso}</p>}

          <div id={idLista} role="listbox" aria-label="Resultados">
            {secoes.map(s => (
              <div key={s.chave} role="group" aria-labelledby={`${idBase}-t-${s.chave}`} className="rv-busca__grupo">
                <div className="rv-busca__titulo" id={`${idBase}-t-${s.chave}`}>
                  <span>{s.titulo}</span>
                  {s.grupo.total > s.grupo.itens.length && (
                    <span className="rv-busca__mais">{s.grupo.itens.length} de {s.grupo.total}</span>
                  )}
                </div>
                {s.grupo.itens.map((r, i) => {
                  const n = s.inicio + i;
                  return (
                    <div
                      key={`${r.tipo}-${r.id}`}
                      id={`${idBase}-op-${n}`}
                      role="option"
                      aria-selected={n === ativo}
                      className={`rv-busca__item${n === ativo ? ' rv-busca__item--ativo' : ''}`}
                      onMouseMove={() => { if (n !== ativo) setAtivo(n); }}
                      onClick={() => onEscolher(r)}
                    >
                      <span className="rv-busca__icone">{ICONES[r.tipo]}</span>
                      <span className="rv-busca__textos">
                        <span className="rv-busca__item-titulo">{r.titulo}</span>
                        {r.subtitulo && <span className="rv-busca__item-sub">{r.subtitulo}</span>}
                      </span>
                      {r.status && (
                        <span className="rv-busca__status">{ROTULO_STATUS[r.status as StatusOrdem] ?? r.status}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {parcial && linhas.length > 0 && (
            <p className="rv-busca__aviso rv-busca__aviso--fraco">Alguns resultados não puderam ser carregados agora.</p>
          )}
        </div>

        <div className="rv-busca__rodape" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
