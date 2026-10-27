export interface PropsVarianteIgnicao {
  /** Frase inspiradora exibida abaixo do nome. */
  frase: string;
  /** Chamada uma única vez quando a animação termina (ou é pulada com um toque). */
  onConcluir: () => void;
}
