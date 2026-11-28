import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { SeletorSistemas } from './SeletorSistemas';
import './diagnostico.css';

/** Sub-etapa 1 — Serviços: quais sistemas entram na inspeção (a mesma escolha do menu "+ Adicionar sistema"). */
export function EtapaServicos({ os }: { os: ReturnType<typeof useOrdemServico> }) {
  return (
    <>
      <div className="osd-topo">
        <h2 className="osd-titulo">Selecionar sistemas para inspeção</h2>
      </div>
      <SeletorSistemas selected={os.selected} onToggle={os.toggleSection} onToggleAll={os.toggleAllSections} layout="grade" />
    </>
  );
}
