import { useEffect, useRef, useState } from 'react';
import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { Button } from '../../../components/system';
import { LIM } from '../../../utils/campos_checklist';
import { textoDasPecas } from '../../../utils/diagnostico_os';
import { TabelaPecas } from './TabelaPecas';
import { IcCheck, IcCopiar, IcLapis, IcPrancheta, IcRestaurar } from './icones';
import './diagnostico.css';

interface EtapaTextoProps {
  os: ReturnType<typeof useOrdemServico>;
  onVoltarPecas: () => void;
}

/** Sub-etapa 4 — Texto: texto gerado a partir das peças, editável só aqui (não altera a tabela) e copiável. */
export function EtapaTexto({ os, onVoltarPecas }: EtapaTextoProps) {
  const { tabelaPecas } = os;
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const auto = textoDasPecas(tabelaPecas);
  const [texto, setTexto] = useState(auto);
  const ultimoAuto = useRef(auto);
  // A tabela mudou: o texto volta a acompanhá-la (como antes).
  useEffect(() => {
    if (auto !== ultimoAuto.current) { setTexto(auto); ultimoAuto.current = auto; setEditando(false); }
  }, [auto]);

  const vazio = tabelaPecas.length === 0;

  async function copiar() {
    const ok = () => { setCopiado(true); setTimeout(() => setCopiado(false), 2200); };
    try {
      await navigator.clipboard.writeText(texto);
      ok();
    } catch {
      if (area.current) { area.current.select(); document.execCommand('copy'); ok(); }
    }
  }

  if (vazio) {
    return (
      <>
        <div className="osd-topo"><h2 className="osd-titulo">Texto das peças</h2></div>
        <div className="osd-vazio">
          <IcPrancheta />
          <span>Nenhuma peça para gerar o texto.<br />Adicione peças na etapa anterior.</span>
          <Button variant="secondary" onClick={onVoltarPecas}>Voltar às peças</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="osd-pecas-topo">
        <h2 className="osd-titulo">Prévia das peças</h2>
        <p className="osd-contagem" role="status"><span><b>{tabelaPecas.length}</b> {tabelaPecas.length === 1 ? 'peça listada' : 'peças listadas'}</span></p>
      </div>
      <TabelaPecas pecas={tabelaPecas} editavel={false} />

      <h2 className="osd-titulo">Texto gerado</h2>
      <div className="osd-texto" data-editando={editando}>
        <div className="osd-texto__barra">
          <span className="osd-dica">{editando ? 'Editando manualmente' : 'Gerado automaticamente'}</span>
          <div className="osd-texto__acoes">
            <Button
              variant="secondary" size="sm" icon={<IcLapis size={14} />} aria-pressed={editando}
              onClick={() => { setEditando((e) => !e); if (!editando) setTimeout(() => area.current?.focus(), 50); }}
            >
              {editando ? 'Modo edição' : 'Editar'}
            </Button>
            <Button variant="ghost" size="sm" icon={<IcRestaurar size={14} />} title="Restaurar texto automático" onClick={() => { setTexto(auto); setEditando(false); }}>
              Restaurar
            </Button>
            <Button variant="secondary" size="sm" icon={copiado ? <IcCheck size={14} /> : <IcCopiar size={14} />} onClick={() => void copiar()}>
              {copiado ? 'Copiado!' : 'Copiar texto'}
            </Button>
          </div>
        </div>
        <textarea
          ref={area} value={texto} readOnly={!editando} maxLength={LIM.relatorioCopia} aria-label="Texto gerado das peças"
          rows={Math.max(8, texto.split('\n').length + 2)} onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <p className="osf-nota" aria-live="polite">
        {editando ? 'Modo edição ativo — alterações não afetam a tabela de peças.' : 'O texto é atualizado automaticamente quando a tabela de peças é editada.'}
      </p>
    </>
  );
}
