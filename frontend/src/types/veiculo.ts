// ── Veículos (frota): tipos ───────────────────────────────────────────────────
// Cadastro de veículos da oficina — distinto do snapshot `Veiculo` usado dentro
// de uma Ordem de Serviço (ver `types/index.ts`). Aqui modelamos o veículo como
// um registro persistente da frota, que pode existir com ou sem proprietário e
// pode estar associado a múltiplas OS/checklists ao longo do tempo.

/** Categoria/carroceria do veículo — usada para o card do grid e a foto padrão. */
export type VeiculoCategoria =
  | 'sedan'
  | 'hatch'
  | 'suv'
  | 'picape'
  | 'van'
  | 'utilitario'
  | 'esportivo';

/** Tipo de câmbio. */
export type VeiculoCambio = 'Manual' | 'Automático' | 'CVT' | 'Automatizado';

/** Status operacional do veículo dentro da oficina. */
export type VeiculoStatus =
  | 'disponivel'             // sem pendência ativa no momento
  | 'na_oficina'             // em manutenção/inspeção agora
  | 'aguardando_aprovacao'   // orçamento enviado, aguardando cliente
  | 'pronto_entrega';        // serviço concluído, aguardando retirada

/**
 * Proprietário do veículo = o cliente da carteira ao qual ele está vinculado.
 * Ao enviar: com `clienteId`, o backend vincula esse cliente (precisa estar na carteira);
 * sem `clienteId`, só com texto, ele acha o cliente por CPF/CNPJ, e-mail ou nome — ou
 * cadastra um novo. Ao receber, `clienteId` vem sempre que há proprietário.
 */
export interface VeiculoProprietario {
  clienteId?: string;
  nome: string;
  docCpfCnpj?: string;
  telefone?: string;
  email?: string;
}

/** Registro de veículo cadastrado na frota da oficina. */
export interface VeiculoCadastrado {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  categoria: VeiculoCategoria;
  quilometragem: number;
  combustivel: string;
  cambio: VeiculoCambio;
  portas: number;
  motor?: string;                // ex.: "1.0 Turbo", "2.0 16V" — opcional
  chassi?: string;
  renavam?: string;
  observacoes?: string;
  fotoPrincipal?: string;       // data URL ou caminho remoto
  fotosAdicionais: string[];
  proprietario?: VeiculoProprietario | null;
  status: VeiculoStatus;
  ultimaOSId?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Payload utilizado para criar/editar um veículo a partir do modal de cadastro. */
export interface NovoVeiculoInput {
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  categoria: VeiculoCategoria;
  quilometragem: number;
  combustivel: string;
  cambio: VeiculoCambio;
  portas: number;
  motor?: string;
  chassi?: string;
  renavam?: string;
  observacoes?: string;
  /** Data URL já comprimida (ver `comprimirImagem`). `null` remove a foto; ausente = não mexe. */
  fotoPrincipal?: string | null;
  /** Lista COMPLETA desejada (até `MAX_FOTOS_ADICIONAIS`); ausente = não mexe. */
  fotosAdicionais?: string[];
  /** Ausente = não mexe no dono; `null` = sem proprietário; com `clienteId` = cliente cadastrado. */
  proprietario?: VeiculoProprietario | null;
  status?: VeiculoStatus;
}

/** Limite de fotos adicionais por veículo — igual ao do backend (veiculos_views.MAX_FOTOS_ADICIONAIS). */
export const MAX_FOTOS_ADICIONAIS = 5;

/** Filtro de vínculo com proprietário. */
export type VeiculoVinculo = 'todos' | 'com' | 'sem';

/** Estado atual dos filtros aplicados à listagem/grid de veículos. */
export interface VeiculoFiltros {
  marca: string;                     // '' = todas
  modelo: string;                    // busca livre
  categoria: VeiculoCategoria | 'todas';
  anoDe: string;                     // texto p/ permitir input vazio
  anoAte: string;
  cor: string;
  proprietario: string;              // busca livre por nome/doc
  status: VeiculoStatus | 'todos';
  vinculo: VeiculoVinculo;
}
