/**
 * Ilustração genérica de três caixas empilhadas — usada como imagem do produto
 * quando a oficina não cadastrou foto.
 *
 * Reproduz a referência do Figma em SVG puro: três cubos isométricos de mesmo
 * tamanho (meia-largura 56,5 · meia-altura 32 · altura 64), cada um com fita
 * que cruza o topo e desce pela face direita. As cores foram medidas na
 * referência (faces chapadas, sem gradiente). Ordem de desenho: caixa de
 * trás, caixa da frente-esquerda, caixa de cima — assim as sobreposições
 * saem naturalmente, sem recortes.
 *
 * Sem fundo próprio: quem usa decide o fundo (ver `.es-foto`).
 */
export function CaixasEmpilhadasSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="44 8 244 244" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      {/* caixa de trás (direita) */}
      <polygon fill="#9496A1" points="146,100 202.5,132 202.5,196 146,164" />
      <polygon fill="#BDBFC8" points="202.5,132 259,100 259,164 202.5,196" />
      <polygon fill="#DCDFE2" points="146,100 202.5,68 259,100 202.5,132" />
      <polygon fill="#707686" points="171,85.9 179.9,80.8 236.4,112.8 227.5,117.9" />
      <polygon fill="#616372" points="227.5,117.9 236.4,112.8 236.4,128.8 227.5,133.9" />

      {/* caixa da frente (esquerda) */}
      <polygon fill="#90939E" points="72,143 128.5,175 128.5,239 72,207" />
      <polygon fill="#BDC0C9" points="128.5,175 185,143 185,207 128.5,239" />
      <polygon fill="#D9DADF" points="72,143 128.5,111 185,143 128.5,175" />
      <polygon fill="#717887" points="97,128.9 105.9,123.8 162.4,155.8 153.5,160.9" />
      <polygon fill="#5E626F" points="153.5,160.9 162.4,155.8 162.4,171.8 153.5,176.9" />

      {/* caixa de cima */}
      <polygon fill="#8F929E" points="109,52 165.5,84 165.5,148 109,116" />
      <polygon fill="#BDC0C9" points="165.5,84 222,52 222,116 165.5,148" />
      <polygon fill="#D9DADF" points="109,52 165.5,20 222,52 165.5,84" />
      <polygon fill="#707686" points="134,37.9 142.9,32.8 199.4,64.8 190.5,69.9" />
      <polygon fill="#5C5F6D" points="190.5,69.9 199.4,64.8 199.4,80.8 190.5,85.9" />
    </svg>
  );
}
