// Definição central dos fluxos de autenticação: quais "quadrados" aparecem no
// painel da marca e qual texto acompanha cada fluxo. As telas (formulários)
// só dizem em qual fluxo/etapa estão — o painel desenha o resto.

export type AuthRole = 'dono' | 'funcionario';
export type AuthFlow = 'cadastro' | 'login' | 'funcionario';

export interface AuthFlowConfig {
  /** Rótulo de cada quadrado, na ordem. */
  steps: string[];
  pill: string;
  title: string;
  subtitle: string;
}

export const AUTH_FLOWS: Record<AuthFlow, AuthFlowConfig> = {
  cadastro: {
    steps: [
      'Registre sua conta',
      'Cadastre as informações da sua oficina',
      'Seja bem-vindo ao Revisacar',
    ],
    pill: 'Cadastre sua oficina 🚀',
    title: 'Comece sua jornada',
    subtitle: 'Siga estes passos simples para configurar a sua conta.',
  },
  login: {
    steps: ['Entre na sua conta', 'Recupere sua senha'],
    pill: 'Painel da oficina 🔧',
    title: 'Bem-vindo de volta',
    subtitle: 'Entre para acompanhar ordens de serviço, clientes e estoque.',
  },
  funcionario: {
    steps: ['Selecione um funcionário', 'Entre na sua conta', 'Recupere seu PIN'],
    pill: 'Área do funcionário 🛠️',
    title: 'Vamos ao trabalho',
    subtitle: 'Escolha o seu nome e confirme com o seu PIN.',
  },
};

/** Fluxo inicial de cada lado — usado assim que o painel começa a deslizar. */
export const DEFAULT_FLOW_BY_ROLE: Record<AuthRole, AuthFlow> = {
  dono: 'login',
  funcionario: 'funcionario',
};

/** Tempos (ms) da transição dono ⇄ funcionário. Mantenha em sincronia com auth.css. */
export const AUTH_SLIDE_MS = 800;
/** Momento em que o formulário é trocado: o painel já está cobrindo a área do form. */
export const AUTH_SWAP_AT_MS = 360;
