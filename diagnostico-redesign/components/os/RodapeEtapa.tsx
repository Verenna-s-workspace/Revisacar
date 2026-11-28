import type { ReactNode } from 'react';
import { Button } from '../system';
import './os-fase.css';

interface RodapeEtapaProps {
  onVoltar?: () => void;
  voltarDesabilitado?: boolean;
  /** Ausente na última sub-etapa (a ação final fica no painel de resumo). */
  onContinuar?: () => void;
  continuarRotulo?: string;
  continuarDesabilitado?: boolean;
  /** Ação extra entre "Voltar" e "Continuar" (ex.: "Salvar" no Diagnóstico). */
  extra?: ReactNode;
}

const IcVoltar = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;

/** "Voltar / Continuar" dentro do card da sub-etapa. Continuar é secundário: o único primário da tela é o do painel de resumo. */
export function RodapeEtapa({ onVoltar, voltarDesabilitado, onContinuar, continuarRotulo = 'Continuar', continuarDesabilitado, extra }: RodapeEtapaProps) {
  return (
    <div className="osf-rodape">
      <Button variant="secondary" icon={IcVoltar} onClick={onVoltar} disabled={voltarDesabilitado}>Voltar</Button>
      {extra}
      {onContinuar && <Button variant="secondary" onClick={onContinuar} disabled={continuarDesabilitado}>{continuarRotulo}</Button>}
    </div>
  );
}
