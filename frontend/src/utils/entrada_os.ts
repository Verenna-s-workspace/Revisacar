// Regras da fase ENTRADA da OS: o estado de cada sub-etapa, o que falta e quando dá para concluir.
// Só leitura de dados que já existem em `os` — não cria estado novo nem muda regra de negócio.
import type { Cliente, OSHeader, Tecnico, Veiculo } from '../types';
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
  osHeader: OSHeader;
  fotos: { resolvidas: number; total: number; liberado: boolean };
}

/** Nº da OS, data e hora de entrada: automáticos, mas o servidor continua exigindo os três. */
export function cabecalhoOSCompleto(h: Pick<OSHeader, 'os_num' | 'os_date' | 'os_time'>): boolean {
  return !!h.os_num.trim() && !!h.os_date.trim() && !!h.os_time.trim();
}

/** O que `validateStep1` exige: nome e telefone do cliente, modelo e placa do veículo (+ cabeçalho da OS, se informado). */
export function clienteVeiculoCompleto(c: Cliente, v: Veiculo, h?: Pick<OSHeader, 'os_num' | 'os_date' | 'os_time'>): boolean {
  return !!c.nome.trim() && !!c.tel.trim() && !validarTel(c.tel) && !!v.modelo.trim() && !!v.placa.trim()
    && (h ? cabecalhoOSCompleto(h) : true);
}

export function etapasDaEntrada(i: EntradaInput): EtapaFase[] {
  const clienteOk = i.identificado && clienteVeiculoCompleto(i.cliente, i.veiculo, i.osHeader);
  const temRelato = !!i.veiculo.obs_cliente.trim();
  const temAvarias = !!i.veiculo.obs_entrada.trim();
  const responsavel = !!i.tecnico.nome?.trim();

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
      // A assinatura do mecânico só serve ao PDF: não conta para a etapa nem bloqueia nada.
      estado: responsavel ? 'completa' : 'pendente',
      detalhe: responsavel ? i.tecnico.nome.trim() : 'Falta o responsável',
    },
  ];
}

export interface ResumoEntrada {
  concluidas: number;
  total: number;
  /** Etapa 1 completa + 5 fotos resolvidas + responsável preenchido. A assinatura NÃO bloqueia. */
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

  let ajuda: string;
  if (!i.identificado) ajuda = 'O rascunho da OS é criado assim que o veículo é identificado.';
  else if (!podeConcluir) ajuda = `Falta: ${falta.join(', ')}.`;
  else ajuda = 'Tudo pronto. Concluir libera a fase de Diagnóstico.';

  return { concluidas: etapas.filter((e) => e.estado === 'completa').length, total: etapas.length, podeConcluir, falta, ajuda };
}
