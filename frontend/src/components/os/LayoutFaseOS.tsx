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
  /** Menu lateral opcional (ex.: sistemas do Diagnóstico). Sem ele o layout é o de sempre (card + resumo). */
  menu?: ReactNode;
}

/** Esqueleto de toda fase da OS: cabeçalho fixo → stepper → sub-etapas → card + painel lateral. */
export function LayoutFaseOS({ cabecalho, stepper, subetapas, children, resumo, menu }: LayoutFaseOSProps) {
  return (
    <div className="osf">
      {cabecalho}
      {stepper}
      {subetapas}
      <div className={menu ? 'osf-corpo osf-corpo--menu' : 'osf-corpo'}>
        {menu}
        {children}
        {resumo}
      </div>
    </div>
  );
}
