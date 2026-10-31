import { startTransition, Suspense, useEffect, useState } from 'react';
import { useOrdemServico } from './hooks/useOrdemServico';
import { api } from './utils/api';
import type { AuthResult } from './types';
import type { OSPrefillInput } from './types/atendimento';
import { useAuth } from './context/AuthContext';
import { DEVICE_OFICINA_KEY } from './utils/acesso_equipe_utils';
import { preCarregarQuandoOcioso, telaSobDemanda } from './utils/telaSobDemanda';

// Cada tela é um arquivo à parte, baixado quando abre (ver utils/telaSobDemanda.ts).
const Check = telaSobDemanda(() => import('./pages/InitialChecklist').then((m) => m.default));
const Check2 = telaSobDemanda(() => import('./pages/InspectionChecklist').then((m) => m.default));
const OrcamentoPage = telaSobDemanda(() => import('./features/Orcamento/OrcamentoPage').then((m) => m.default));
const FechamentoPage = telaSobDemanda(() => import('./features/Fechamento/FechamentoPage').then((m) => m.default));
const Dashboard = telaSobDemanda(() => import('./pages/Dashboard').then((m) => m.Dashboard));
const AuthPage = telaSobDemanda(() => import('./pages/AuthPage').then((m) => m.AuthPage));
const ResetPasswordScreen = telaSobDemanda(() => import('./pages/ResetPasswordScreen').then((m) => m.ResetPasswordScreen));
const LearningCenterModal = telaSobDemanda(
  () => import('./features/Dashboard/LearningCenter/LearningCenterModal').then((m) => m.LearningCenterModal));

type View = 'dashboard' | 'os' | 'os2' | 'orcamento' | 'fechamento' | 'login' | 'reset-password';

function TelaCarregando() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)'
    }}>
      <div style={{
        padding: '20px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <p>Carregando...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, login, logout } = useAuth();

  const [view, setViewAgora]            = useState<View>('dashboard');
  // Em transição: se o arquivo da próxima tela ainda não chegou, a atual continua à mostra.
  const setView = (v: View) => startTransition(() => setViewAgora(v));
  // UMA instância do estado da OS, compartilhada por entrada (os), diagnóstico (os2) e
  // orçamento: sem isso cada tela começava uma OS em branco e salvar criava OS duplicada.
  const os = useOrdemServico();
  const [prefillOS, setPrefillOS]       = useState<OSPrefillInput | null>(null);
  const [authMode, setAuthMode]         = useState<'login' | 'reset-password'>('login');
  // Central de Aprendizado — vive aqui (acima de Dashboard) porque o botão
  // "Dicas" está disponível em qualquer página do painel, e Dashboard só
  // renderiza uma página por vez internamente.
  const [showLearningCenter, setShowLearningCenter] = useState(false);

  // Sem login: enquanto a pessoa digita, o painel já vai baixando. Logado: as telas da OS vêm em
  // segundo plano, pra "Nova OS" e "Abrir OS" abrirem na hora.
  const logado = !!user;
  useEffect(() => {
    if (loading) return;
    preCarregarQuandoOcioso(logado
      ? [Check, Check2, OrcamentoPage, FechamentoPage]
      : [Dashboard]);
  }, [loading, logado]);

  // Show loading indicator while checking auth status
  if (loading) {
    return <TelaCarregando />;
  }

  // ── Navegação ──────────────────────────────────────────────────────────────
  const handleStartNew = () => {
    os.novaOrdem();
    setPrefillOS(null);
    setView('os');            // sempre abre o Check (fluxo de entrada)
  };

  // Igual a handleStartNew, mas pré-preenchendo cliente/veículo (usado pelo
  // botão "Iniciar Atendimento" da tela de Atendimento — ver Seção 8 do prompt).
  const handleStartNewComPrefill = (prefill: OSPrefillInput) => {
    os.novaOrdem();
    setPrefillOS(prefill);
    setView('os');
  };

  // Abre uma OS existente. Rascunho volta pro checklist; a partir de "em orçamento"
  // o trabalho está no orçamento (as etapas 1 e 2 continuam a um clique).
  const handleLoadRascunho = async (ordem: { id: string; status?: string }) => {
    await os.loadOrder(ordem);
    setPrefillOS(null);
    const emServico = ['em_execucao', 'aguardando', 'finalizada'].includes(ordem.status ?? '');
    setView(emServico ? 'fechamento' : ordem.status && ordem.status !== 'rascunho' ? 'orcamento' : 'os');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setPrefillOS(null);
  };

  // As etapas começam sempre na primeira aba: o `step` é do hook compartilhado.
  const handleGoToCheck2 = () => {
    os.goStep(1, 1);
    setView('os2');           // chamado pelo botão "Próxima etapa" do Step3
  };

  const handleGoToEntrada = () => {
    os.goStep(1, 1);
    setView('os');
  };

  const handleGoToOrcamento = () => {
    setView('orcamento');
    window.scrollTo({ top: 0 });
  };

  const handleGoToFechamento = () => {
    setView('fechamento');
    window.scrollTo({ top: 0 });
  };

  const handleLoadOS = async (id: string) => {
    try {
      const ordem = await api.obterOrdem(id);
      await handleLoadRascunho(ordem);
    } catch (e) {
      console.error('Erro ao carregar OS:', e);
    }
  };

  const handleShowResetPassword = () => {
    setAuthMode('reset-password');
  };

  const handleBackToLogin = () => {
    setAuthMode('login');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Barreira de login — o AuthPage cuida do dono (CNPJ+senha) e do funcionário
  // (nome + PIN) no mesmo layout: o painel da marca desliza de um lado pro
  // outro, então os dois precisam viver no mesmo componente (não desmontar).
  if (!user) {
    return <Suspense fallback={<TelaCarregando />}>{telaDeEntrada()}</Suspense>;
  }

  return <Suspense fallback={<TelaCarregando />}>{painel()}</Suspense>;

  function telaDeEntrada() {
    if (authMode === 'reset-password') {
      return (
        <ResetPasswordScreen
          onVoltar={handleBackToLogin}
          onAuthenticated={(result) => {
            login(result);
            // dash pos login com senha resetada
            setView('dashboard');
            setAuthMode('login');
          }}
        />
      );
    }

    return (
      <AuthPage
        onAuthenticated={(result, role) => {
          login(result);
          // Guarda o CNPJ neste dispositivo — é o que permite a tela de
          // login de funcionário já abrir direto no seletor de nomes,
          // sem pedir CNPJ de novo (ver FuncionarioLoginScreen).
          if (role === 'dono' && result.doc) localStorage.setItem(DEVICE_OFICINA_KEY, result.doc);
          // depois do login vai pro dash
          setView('dashboard');
        }}
      />
    );
  }

  function painel() {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column'
      }}>

        {/* Main content */}
        <div style={{ flex: 1 }}>
          {view === 'dashboard' ? (
            <Dashboard
              onNewOS={handleStartNew}
              onLoadOS={handleLoadOS}
              onNewOSComPrefill={handleStartNewComPrefill}
              onOpenLearningCenter={() => setShowLearningCenter(true)}
            />
          ) : view === 'fechamento' ? (
            <FechamentoPage
              os={os}
              onBackToStart={handleBackToDashboard}
              onGoOrcamento={handleGoToOrcamento}
            />
          ) : view === 'orcamento' ? (
            <OrcamentoPage
              os={os}
              onBackToStart={handleBackToDashboard}
              onGoEntrada={handleGoToEntrada}
              onGoDiagnostico={handleGoToCheck2}
              onGoFechamento={handleGoToFechamento}
            />
          ) : view === 'os2' ? (
            <Check2
              os={os}
              onBackToStart={handleBackToDashboard}
              onNextChecklist={handleGoToOrcamento}
            />
          ) : view === 'os' ? (
            <Check
              os={os}
              prefill={prefillOS}
              onBackToStart={handleBackToDashboard}
              onNextChecklist={handleGoToCheck2}   // ← permite ir para Check2
            />
          ) : (
            // Fallback (shouldn't reach here)
            <Dashboard
              onNewOS={handleStartNew}
              onLoadOS={handleLoadOS}
              onNewOSComPrefill={handleStartNewComPrefill}
              onOpenLearningCenter={() => setShowLearningCenter(true)}
            />
          )}
        </div>

        {showLearningCenter && (
          <Suspense fallback={null}>
            <LearningCenterModal onClose={() => setShowLearningCenter(false)} />
          </Suspense>
        )}
      </div>
    );
  }
}