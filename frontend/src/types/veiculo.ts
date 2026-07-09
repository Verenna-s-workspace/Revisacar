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
 * Proprietário do veículo — modelagem propositalmente simples (texto livre).
 * 🔜 Feature futura: substituir por vínculo relacional com um Cliente cadastrado
 * (seleção de cliente existente ou criação rápida). Por enquanto, apenas os
 * dados básicos são armazenados diretamente no veículo.
 */
export interface VeiculoProprietario {
  clienteId?: string;   // reservado para o vínculo relacional futuro
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
  fotoPrincipal?: string;
  fotosAdicionais?: string[];
  proprietario?: VeiculoProprietario | null;
  status?: VeiculoStatus;
}

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
