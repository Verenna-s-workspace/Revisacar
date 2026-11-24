/**
 * As seções da tela de Configurações, na ordem do menu lateral.
 *
 * - `permissao`: quem não tem a permissão não vê a seção (esconder é só UX; o backend é quem barra).
 * - `emBreve`: seção ainda sem funcionalidade — aparece no menu com a etiqueta "Em breve".
 *
 * Para esconder uma seção, basta remover o item daqui.
 */
export type IdSecao = 'dados' | 'equipe' | 'acesso' | 'horario' | 'reserva' | 'aplicativo' | 'plano' | 'conta';

export interface SecaoConfig {
  id: IdSecao;
  rotulo: string;
  titulo: string;
  descricao?: string;
  permissao?: string;
  emBreve?: boolean;
}

export const SECOES: SecaoConfig[] = [
  {
    id: 'dados', rotulo: 'Dados da oficina', titulo: 'Dados da oficina',
    descricao: 'Aparecem no orçamento enviado ao cliente e no PDF da OS.',
  },
  {
    id: 'equipe', rotulo: 'Equipe e cargos', titulo: 'Equipe e cargos',
    descricao: 'Controla quem acessa o quê no sistema.',
    permissao: 'funcionarios.gerenciar',
  },
  {
    id: 'acesso', rotulo: 'Acesso da equipe', titulo: 'Acesso da equipe',
    descricao: 'Link para o funcionário entrar com o PIN em qualquer computador.',
    permissao: 'funcionarios.gerenciar',
  },
  {
    id: 'horario', rotulo: 'Horário de funcionamento', titulo: 'Horário de funcionamento',
    descricao: 'Define automaticamente os horários disponíveis na tela de Agendamentos.',
  },
  {
    id: 'reserva', rotulo: 'Caixa de reserva', titulo: 'Caixa de reserva',
    descricao: 'Guarde uma parte de cada pagamento recebido num caixa de emergência.',
    permissao: 'financeiro.reserva',
  },
  {
    id: 'aplicativo', rotulo: 'Aplicativo', titulo: 'Aplicativo',
    descricao: 'Conexão e instalação do RevisaCar neste dispositivo.',
  },
  {
    id: 'plano', rotulo: 'Plano e cobrança', titulo: 'Plano e cobrança',
    emBreve: true,
  },
  {
    id: 'conta', rotulo: 'Minha conta', titulo: 'Minha conta',
    // a descrição (cargo · CNPJ/e-mail) é montada na página, a partir de quem está logado
  },
];
