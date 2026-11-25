import { EstadoMensagem } from './cfgUi';

/** Plano e cobrança: o sistema ainda não tem essa área. Mantida no menu como no Figma, marcada "Em breve". */
export function PlanoCobrancaSecao() {
  return (
    <EstadoMensagem titulo="Em breve">
      Aqui você vai ver o plano contratado e o histórico de cobranças. Esta área ainda está em preparação.
    </EstadoMensagem>
  );
}
