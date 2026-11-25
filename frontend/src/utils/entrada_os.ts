// Regras da fase ENTRADA da OS: o estado de cada sub-etapa, o que falta e quando dá para concluir.
// Só leitura de dados que já existem em `os` — não cria estado novo nem muda regra de negócio.
import type { AssinaturaEntrada, Cliente, Tecnico, Veiculo } from '../types';
import type { EtapaFase } from './os_fases';
import { validarTel } from './campos_checklist';

export const ETAPA = { cliente: 1, relato: 2, fotos: 3, assinatura: 4 } as const;
export const ROTULOS_ENTRADA = ['Cliente e veículo', 'Relato e avarias', 'Fotos', 'Assinatura'] as const;

export interface EntradaInput {
  /** O veículo foi identificado (cadastro encontrado ou dados do novo cliente/veículo confirmados). */
  identificado: boolean;
  cliente: Cliente;
  veiculo: Veiculo;
  tecnico: Tecnico;
  assinatura: AssinaturaEntrada;
  fotos: { resolvidas: number; total: number; liberado: boolean };
}

/** O que `validateStep1` exige quando não vem de cadastro: nome e telefone do cliente e modelo do veículo. */
export function clienteVeiculoCompleto(c: Cliente, v: Veiculo): boolean {
  return !!c.nome.trim() && !!c.tel.trim() && !validarTel(c.tel) && !!v.modelo.trim() && !!v.placa.trim();
}

export function etapasDaEntrada(i: EntradaInput): EtapaFase[] {
  const clienteOk = i.identificado && clienteVeiculoCompleto(i.cliente, i.veiculo);
  const temRelato = !!i.veiculo.obs_cliente.trim();
  const temAvarias = !!i.veiculo.obs_entrada.trim();
  const responsavel = !!i.tecnico.nome?.trim();
  const { status } = i.assinatura;
  const assinaturaOk = responsavel && (status === 'assinada' || status === 'adiada');

  const detalheAssinatura = !responsavel
    ? 'Falta o responsável'
    : status === 'assinada' ? 'Assinada pelo cliente'
    : status === 'adiada' ? 'Adiada, cliente ausente'
    : 'Pendente';

  return [
    {
      id: ETAPA.cliente, rotulo: ROTULOS_ENTRADA[0], bloqueada: false,
      estado: clienteOk ? 'completa' : 'pendente',
      detalhe: clienteOk ? [i.veiculo.placa, i.cliente.nome].filter(Boolean).join(' · ') : 'Pendente',
    },
    {
      id: ETAPA.relato, rotulo: ROTULOS_ENTRADA[1], bloqueada: !i.identificado,
      estado: temRelato || temAvarias ? 'completa' : 'opcional',
      detalhe: temRelato && temAvarias ? 'Relato e avarias registrados'
        : temRelato ? 'Relato registrado'
        : temAvarias ? 'Avarias registradas'
        : 'Opcional',
    },
    {
      id: ETAPA.fotos, rotulo: ROTULOS_ENTRADA[2], bloqueada: !i.identificado,
      estado: i.fotos.liberado ? 'completa' : 'pendente',
      detalhe: `${i.fotos.resolvidas} de ${i.fotos.total} fotos`,
    },
    {
      id: ETAPA.assinatura, rotulo: ROTULOS_ENTRADA[3], bloqueada: !i.identificado,
      estado: assinaturaOk ? 'completa' : 'pendente',
      detalhe: detalheAssinatura,
      // Adiada não trava nada, mas fica visível como pendência até o cliente assinar.
      pendencia: assinaturaOk && status === 'adiada' ? 'Assinatura do cliente pendente' : undefined,
    },
  ];
}

export interface ResumoEntrada {
  concluidas: number;
  total: number;
  /** Etapa 1 completa + 5 fotos resolvidas + responsável preenchido. Assinatura adiada NÃO bloqueia. */
  podeConcluir: boolean;
  /** Nomes do que falta para concluir (vazio se pode). */
  falta: string[];
  ajuda: string;
}

export function resumoDaEntrada(etapas: EtapaFase[], i: EntradaInput): ResumoEntrada {
  const clienteOk = etapas[0].estado === 'completa';
  const fotosOk = i.fotos.liberado;
  const responsavel = !!i.tecnico.nome?.trim();
  const falta: string[] = [];
  if (!clienteOk) falta.push(ROTULOS_ENTRADA[0]);
  if (!fotosOk) falta.push(ROTULOS_ENTRADA[2]);
  if (!responsavel) falta.push('Responsável pela entrada');
  const podeConcluir = falta.length === 0;
  const adiada = i.assinatura.status === 'adiada';

  let ajuda: string;
  if (!i.identificado) ajuda = 'O rascunho da OS é criado assim que o veículo é identificado.';
  else if (!podeConcluir) ajuda = `Falta: ${falta.join(', ')}.`;
  else if (adiada) ajuda = 'Tudo pronto. A assinatura do cliente fica como pendência.';
  else if (i.assinatura.status !== 'assinada') ajuda = 'Tudo pronto. Sem assinatura, a entrada segue sem o termo do cliente.';
  else ajuda = 'Tudo pronto. Concluir libera a fase de Diagnóstico.';

  return { concluidas: etapas.filter((e) => e.estado === 'completa').length, total: etapas.length, podeConcluir, falta, ajuda };
}
