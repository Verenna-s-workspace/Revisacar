import type { ReactNode } from 'react';
import './os-fase.css';

interface LayoutFaseOSProps {
  cabecalho: ReactNode;
  stepper: ReactNode;
  subetapas: ReactNode;
  /** Card com os campos da sub-etapa atual (use <div className="osf-card">…). */
  children: ReactNode;
  /** Painel lateral "Resumo da fase". No celular vai abaixo do conteúdo. */
  resumo: ReactNode;
}

/** Esqueleto de toda fase da OS: cabeçalho fixo → stepper → sub-etapas → card + painel lateral. */
export function LayoutFaseOS({ cabecalho, stepper, subetapas, children, resumo }: LayoutFaseOSProps) {
  return (
    <div className="osf">
      {cabecalho}
      {stepper}
      {subetapas}
      <div className="osf-corpo">
        {children}
        {resumo}
      </div>
    </div>
  );
}
