import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { Button } from '../../../components/system';
import { LIM } from '../../../utils/campos_checklist';
import { TabelaPecas } from './TabelaPecas';
import { IcMais, IcPrancheta } from './icones';
import './diagnostico.css';

interface EtapaPecasProps {
  os: ReturnType<typeof useOrdemServico>;
  onVoltarDiagnostico: () => void;
}

/** Sub-etapa 3 — Peças: tabela das peças para troca (as marcadas em "Trocar" + as digitadas aqui). */
export function EtapaPecas({ os, onVoltarDiagnostico }: EtapaPecasProps) {
  const { tabelaPecas, updateTabelaPeca, addTabelaPecaManual, removeTabelaPeca } = os;
  const auto = tabelaPecas.filter((r) => r.isAuto).length;
  const manual = tabelaPecas.length - auto;
  const cheia = tabelaPecas.length >= LIM.maxPecas;

  return (
    <>
      <div className="osd-pecas-topo">
        <h2 className="osd-titulo">Peças para troca</h2>
        <p className="osd-contagem" role="status">
          <span><b>{tabelaPecas.length}</b> {tabelaPecas.length === 1 ? 'item' : 'itens'}</span>
          {auto > 0 && <span><b>{auto}</b> {auto === 1 ? 'automático' : 'automáticos'}</span>}
          {manual > 0 && <span><b>{manual}</b> {manual === 1 ? 'manual' : 'manuais'}</span>}
        </p>
      </div>

      {tabelaPecas.length === 0 ? (
        <div className="osd-vazio">
          <IcPrancheta />
          <span>Nenhuma peça marcada para troca.<br />Ative “Trocar” nos itens do diagnóstico ou adicione manualmente abaixo.</span>
          <Button variant="secondary" onClick={onVoltarDiagnostico}>Voltar ao diagnóstico</Button>
        </div>
      ) : (
        <TabelaPecas pecas={tabelaPecas} onAtualizar={updateTabelaPeca} onRemover={removeTabelaPeca} />
      )}

      <div>
        <Button variant="secondary" icon={<IcMais />} onClick={addTabelaPecaManual} disabled={cheia}>Adicionar peça manualmente</Button>
        {cheia && <p className="osf-nota" role="status" style={{ marginTop: 8 }}>Limite de {LIM.maxPecas} peças atingido.</p>}
      </div>
    </>
  );
}
