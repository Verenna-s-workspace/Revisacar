// Fases do ciclo da OS (stepper do topo) — genérico: cada fase nova só acrescenta suas sub-etapas.
// As 6 fases são fixas; o `status` da OS (utils/ordem_status.ts) é outra coisa (subestado) e não é calculado aqui.

export type FaseId = 'entrada' | 'diagnostico' | 'orcamento' | 'aprovacao' | 'execucao' | 'fechamento';

export interface FaseOS { id: FaseId; rotulo: string }

export const FASES_OS: readonly FaseOS[] = [
  { id: 'entrada', rotulo: 'Entrada' },
  { id: 'diagnostico', rotulo: 'Diagnóstico' },
  { id: 'orcamento', rotulo: 'Orçamento' },
  { id: 'aprovacao', rotulo: 'Aprovação' },
  { id: 'execucao', rotulo: 'Execução' },
  { id: 'fechamento', rotulo: 'Fechamento' },
];

/** Estado de uma sub-etapa ou item do resumo. `opcional` = vazio e não trava nada. */
export type EstadoEtapa = 'completa' | 'pendente' | 'opcional';

/** Item de sub-etapa/resumo — o mesmo formato serve para qualquer fase. */
export interface EtapaFase {
  id: number;
  rotulo: string;
  estado: EstadoEtapa;
  /** Texto curto do resumo (ex.: "RVX5G67 · Rodrigo Lima", "3 de 5 fotos"). */
  detalhe: string;
  /** Algo que ficou para depois (ex.: um dado a conferir depois). A etapa pode estar completa e ainda ter pendência. */
  pendencia?: string;
  bloqueada: boolean;
}
