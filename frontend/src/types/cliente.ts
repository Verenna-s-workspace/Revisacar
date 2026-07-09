// ── Clientes: tipos ───────────────────────────────────────────────────────────
// Cadastro de clientes da oficina. Modelado de forma independente dos
// registros de Veículos e Agendamentos, que hoje armazenam apenas o NOME do
// cliente em texto livre (ver `VeiculoProprietario.nome` e `Agendamento.cliente`).
//
// O cruzamento entre um Cliente e seus veículos/agendamentos/ordens é feito
// por nome (ver `enrichClientes` em `utils/clientes_utils.ts`) — o mesmo
// padrão de vínculo "por nome" já adotado no restante do projeto.
// `VeiculoProprietario` já reserva um campo `clienteId` para uma futura
// ligação relacional direta; quando esse vínculo existir, `Cliente.id` é o
// identificador que ele deverá referenciar.

import type { VeiculoCadastrado, VeiculoCategoria } from './veiculo';
import type { Agendamento } from './agendamento';
import type { OrdemRow } from './dashboard';

/** Registro de cliente cadastrado na carteira da oficina. */
export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  fotoPrincipal?: string; // data URL ou caminho remoto
  observacoes?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Payload utilizado para criar/editar um cliente a partir do modal de cadastro. */
export interface NovoClienteInput {
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  fotoPrincipal?: string;
  observacoes?: string;
}

/**
 * Veículo vinculado diretamente na etapa 2 do modal de cadastro do cliente.
 * Reaproveita os mesmos campos/opções (categoria, combustível) já usados no
 * cadastro de Veículos, para que o registro criado apareça normalmente na
 * tela de Veículos (mesmo modelo `VeiculoCadastrado`, mesmo hook `useVeiculos`).
 */
export interface NovoVeiculoClienteInput {
  marca: string;
  modelo: string;
  ano: string;
  placa: string;
  cor: string;
  categoria: VeiculoCategoria;
  quilometragem: string;
  motor: string;
  combustivel: string;
  observacoes: string;
}

/**
 * Status "ao vivo" do cliente — nunca é persistido; é sempre recalculado a
 * partir dos veículos e agendamentos vinculados a ele no momento da consulta
 * (ver `computeClienteStatus` em `utils/clientes_utils.ts`).
 */
export type ClienteStatus =
  | 'em_atendimento'        // possui veículo atualmente na oficina
  | 'pronto_retirada'       // veículo pronto / serviço concluído aguardando retirada
  | 'aguardando_aprovacao'  // orçamento enviado, aguardando aprovação do cliente
  | 'pagamento_pendente'    // serviço concluído, pagamento em aberto
  | 'agendado'              // possui agendamento futuro confirmado
  | 'disponivel';           // nenhuma pendência ativa no momento

/** Filtro de status usado na listagem — inclui a opção "todos". */
export type ClienteStatusFiltro = ClienteStatus | 'todos';

/** Estado atual dos filtros aplicados à listagem/catálogo de clientes. */
export interface ClienteFiltros {
  status: ClienteStatusFiltro;
  semVeiculos: boolean; // clientes sem nenhum veículo cadastrado
}

/**
 * Cliente "enriquecido" — o registro puro de `Cliente` combinado com tudo que
 * é derivado em tempo real a partir de Veículos, Agendamentos e Ordens de
 * Serviço já existentes no sistema. É essa forma que a UI da tela de
 * Clientes consome (cards, indicadores, busca, perfil completo).
 */
export interface ClienteComDados extends Cliente {
  veiculos: VeiculoCadastrado[];
  veiculoPrincipal: VeiculoCadastrado | null;
  ultimaVisita: string | null; // 'YYYY-MM-DD'
  proximoAgendamento: Agendamento | null;
  agendamentosFuturos: Agendamento[];
  agendamentosPassados: Agendamento[];
  ordens: OrdemRow[];
  status: ClienteStatus;
}
