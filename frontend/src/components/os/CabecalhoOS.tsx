import { useEffect, useRef, useState } from 'react';
import { Placa } from '../../features/Dashboard/Placa';
import { StatusOSBadge } from '../system';
import './os-fase.css';

export interface AcaoMais { rotulo: string; onClick: () => void; perigo?: boolean }

interface CabecalhoOSProps {
  /** Veículo identificado? Antes: "Nova OS" + placa tracejada. Depois: placa Mercosul, modelo e badge. */
  identificado: boolean;
  placa?: string;
  /** "Marca Modelo · Ano". */
  titulo?: string;
  /** Status (subestado) da OS no servidor — o selo é o mesmo do resto do sistema. */
  status?: string | null;
  /** "OS #… · Cliente · entrada dd/mm … · km". */
  meta?: string;
  onHistorico?: () => void;
  /** Itens do menu "…". Sem itens, o botão não aparece. */
  acoesMais?: AcaoMais[];
}

const IcRelogio = <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const IcMais = <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;

/**
 * Cabeçalho da OS: se monta quando o veículo é identificado e fica o mesmo até o Fechamento.
 * (Histórico e "…" só existem depois de identificar. "Gerar laudo PDF" não aparece na Entrada — as fases
 * seguintes podem passar suas próprias ações em `acoesMais`.)
 */
export function CabecalhoOS({ identificado, placa, titulo, status, meta, onHistorico, acoesMais = [] }: CabecalhoOSProps) {
  const [menu, setMenu] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setMenu(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [menu]);

  return (
    <header className="osf-cab">
      <div className="osf-cab__id">
        {identificado ? <Placa placa={placa} /> : <div className="osf-cab__placa-vazia" aria-hidden="true">PLACA</div>}
        <div className="osf-cab__txt">
          <div className="osf-cab__linha">
            <h1 className="osf-cab__titulo">{identificado ? (titulo || 'Veículo') : 'Nova OS'}</h1>
            {identificado && <StatusOSBadge status={status ?? 'rascunho'} size="sm" />}
          </div>
          <div className="osf-cab__meta">{identificado ? meta : 'Identifique o veículo ou escolha um cliente para começar.'}</div>
        </div>
      </div>

      {identificado && (onHistorico || acoesMais.length > 0) && (
        <div className="osf-cab__acoes" ref={raiz}>
          {onHistorico && (
            <button type="button" className="osf-icbtn" aria-label="Abrir histórico da OS" onClick={onHistorico}>{IcRelogio}</button>
          )}
          {acoesMais.length > 0 && (
            <>
              <button type="button" className="osf-icbtn" aria-label="Mais ações" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>{IcMais}</button>
              {menu && (
                <div className="osf-menu" role="menu">
                  {acoesMais.map((a) => (
                    <button key={a.rotulo} type="button" role="menuitem" data-perigo={a.perigo ? 'true' : undefined} onClick={() => { setMenu(false); a.onClick(); }}>
                      {a.rotulo}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
