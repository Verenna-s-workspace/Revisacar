import { Icons } from '../Icons';
import type { NavPage } from '../../../types/dashboard';

export interface LearningModule {
  id: NavPage;
  icon: JSX.Element;
  /** Rótulo curto usado na navegação lateral do modal. */
  label: string;
  /** Título grande exibido no topo do conteúdo. */
  title: string;
  /** Frase de apoio, uma linha, logo abaixo do título. */
  description: string;
  /**
   * URL de embed do vídeo (ex.: https://www.youtube.com/embed/XXXXX).
   * Deixe undefined enquanto o vídeo não existir — o player mostra
   * automaticamente um estado "em breve" nesse caso. Quando gravar,
   * só preencher aqui que o embed passa a aparecer sozinho.
   */
  videoUrl?: string;
  /** Resumo em tópicos do que o vídeo mostra — pra quem prefere ler. */
  highlights: string[];
}

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: 'dashboard',
    icon: Icons.home,
    label: 'Visão Geral',
    title: 'Visão Geral',
    description: 'Acompanhe o desempenho da sua oficina em tempo real, direto na tela inicial.',
    highlights: [
      'Faturamento total e número de ordens de serviço do período',
      'Progresso da meta mensal, atualizado a cada OS faturada',
      'Gráfico de faturamento por dia, com filtro de período',
      'Acesso rápido aos serviços mais realizados',
    ],
  },
  {
    id: 'ordens',
    icon: Icons.orders,
    label: 'Ordens de Serviço',
    title: 'Ordens de Serviço',
    description: 'Crie e acompanhe cada ordem de serviço, do check-in até a entrega do veículo.',
    highlights: [
      'Nova OS em etapas: identificação do cliente e veículo, inspeção, fotos e encerramento',
      'Busca e filtro por número da OS, cliente, placa ou status',
      'Cada OS guarda o histórico completo do que foi feito',
      'PDF da ordem de serviço gerado automaticamente',
    ],
  },
  {
    id: 'atendimento',
    icon: Icons.clipboardCheck,
    label: 'Atendimento',
    title: 'Atendimento',
    description: 'O painel do dia a dia do mecânico — o que está na fila, em execução ou bloqueado.',
    highlights: [
      'Quadro com colunas: Fila, Em Execução, Bloqueado e Finalizado',
      'Inicie um atendimento direto a partir de um agendamento do dia',
      'Marque uma OS como bloqueada e registre o motivo (ex.: aguardando peça)',
      'Veja o próximo agendamento e clientes ainda não avisados',
    ],
  },
  {
    id: 'agendamentos',
    icon: Icons.cal,
    label: 'Agendamentos',
    title: 'Agendamentos',
    description: 'Organize a agenda da oficina com visão diária, semanal ou mensal.',
    highlights: [
      'Horários disponíveis já respeitam o horário de funcionamento definido em Configurações',
      'Criação rápida escolhendo cliente, veículo, data e horário livre',
      'Reagendar ou cancelar um agendamento existente',
      'Visões Diária, Semanal e Mensal pra planejar a semana',
    ],
  },
  {
    id: 'clientes',
    icon: Icons.user,
    label: 'Clientes',
    title: 'Clientes',
    description: 'A carteira de clientes da oficina, com histórico e veículos vinculados.',
    highlights: [
      'Cadastro com dados de contato e endereço, foto opcional',
      'Veículos vinculados aparecem direto no perfil do cliente',
      'Busca por nome, CPF/CNPJ, telefone, e-mail ou placa',
      'Filtros por status (aguardando, em atendimento, pronto)',
    ],
  },
  {
    id: 'veiculos',
    icon: Icons.car,
    label: 'Veículos',
    title: 'Veículos',
    description: 'Cadastro completo da frota atendida, com fotos e proprietário.',
    highlights: [
      'Placa, marca, modelo, ano, quilometragem, câmbio e combustível',
      'Fotos do veículo, principal e adicionais',
      'Vincular ou trocar o proprietário de um veículo',
      'Filtros avançados por categoria, ano, cor e status',
    ],
  },
  {
    id: 'estoque',
    icon: Icons.box,
    label: 'Estoque',
    title: 'Estoque',
    description: 'Controle de peças e insumos, com alerta antes de faltar.',
    highlights: [
      'Aviso automático de estoque baixo, abaixo do mínimo definido',
      'Kits de peças vinculados a um serviço do catálogo',
      'Quarentena pra itens aguardando devolução ou garantia',
      'Busca por nome ou aplicação (ex.: modelo do carro)',
    ],
  },
  {
    id: 'financeiro',
    icon: Icons.money,
    label: 'Financeiro',
    title: 'Financeiro',
    description: 'Entradas e saídas da oficina, organizadas por categoria.',
    highlights: [
      'Lançar entradas (recebimentos) e saídas (despesas)',
      'Categoria e forma de pagamento em cada lançamento',
      'Status pago ou pendente, com data de vencimento',
      'Vincular um lançamento de entrada a um cliente',
    ],
  },
  {
    id: 'servicos',
    icon: Icons.wrench,
    label: 'Catálogo',
    title: 'Catálogo de Serviços',
    description: 'Os serviços que a oficina oferece, com preço e tempo estimado.',
    highlights: [
      'Cada serviço tem categoria, duração estimada e preço',
      'Ativar ou desativar um serviço sem precisar excluir',
      'Descrição detalhada opcional pra padronizar o atendimento',
      'Base usada pelos kits de peças do Estoque',
    ],
  },
  {
    id: 'relatorios',
    icon: Icons.chart,
    label: 'Relatórios',
    title: 'Relatórios',
    description: 'Análises da operação por período, pra enxergar tendências.',
    highlights: [
      'Período customizável: últimos 7/30/90 dias, mês atual ou datas específicas',
      'Comparativo de faturamento entre períodos',
      'Ranking dos serviços mais realizados',
      'Números por forma de pagamento e categoria',
    ],
  },
  {
    id: 'configuracoes',
    icon: Icons.cog,
    label: 'Configurações',
    title: 'Configurações',
    description: 'Os dados da sua oficina e como o sistema se comporta.',
    highlights: [
      'Nome, CNPJ, contato e endereço da oficina',
      'Horário de funcionamento — define os horários disponíveis em Agendamentos',
      'Gerenciar funcionários, cargos e permissões de acesso',
      'Tema claro ou escuro, do jeito que preferir',
    ],
  },
];
