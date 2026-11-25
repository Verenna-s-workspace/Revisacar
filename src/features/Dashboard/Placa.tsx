import { tipoPlaca } from '../../components/inputs/masks';
import { PlacaCinza } from './PlacaCinza';
import { PlacaMercosul } from './PlacaMercosul';

/**
 * Seletor de placa: identifica o padrão (antiga ABC-1234 ou Mercosul ABC1D23, com ou sem
 * hífen, em qualquer caixa) e renderiza o desenho correspondente. Use este componente em
 * qualquer tela — não escolha PlacaCinza/PlacaMercosul na mão.
 *
 * Placa vazia ou fora dos dois padrões (ex.: ainda incompleta) cai no desenho Mercosul,
 * que é o padrão atual; o texto é exibido como veio.
 */
export function Placa({ placa }: { placa?: string | null }) {
  return tipoPlaca(placa) === 'antiga' ? <PlacaCinza placa={placa} /> : <PlacaMercosul placa={placa} />;
}
