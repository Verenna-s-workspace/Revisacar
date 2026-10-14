import { useState } from 'react';
import Check  from './pages/InitialChecklist';
import Check2 from './pages/InspectionChecklist';
import OrcamentoPage from './features/Orcamento/OrcamentoPage';
import FechamentoPage from './features/Fechamento/FechamentoPage';
import { useOrdemServico } from './hooks/useOrdemServico';
import { Dashboard } from './pages/Dashboard';
import { AuthScreen } from './pages/AuthScreen';
import { ResetPasswordScreen } from './pages/ResetPasswordScreen';
import { FuncionarioLoginScreen } from './pages/FuncionarioLogin/FuncionarioLoginScreen';
import { LearningCenterModal } from './features/Dashboard/LearningCenter/LearningCenterModal';
import { api } from './utils/api';
import type { AuthResult } from './types';
import type { OSPrefillInput } from './types/atendimento';
import { useAuth } from './context/AuthContext';

type View = 'dashboard' | 'os' | 'os2' | 'orcamento' | 'fechamento' | 'login' | 'reset-password';

export default function App() {
  const { user, loading, login, logout } = useAuth();

  const [view, setView]                 = useState<View>('dashboard');
  // UMA instância do estado da OS, compartilhada por entrada (os), diagnóstico (os2) e
  // orçamento: sem isso cada tela começava uma OS em branco e salvar criava OS duplicada.
  const os = useOrdemServico();
  const [prefillOS, setPrefillOS]       = useState<OSPrefillInput | null>(null);
  const [authMode, setAuthMode]         = useState<'login' | 'reset-password' | 'funcionario'>('login');
  // Central de Aprendizado — vive aqui (acima de Dashboard) porque o botão
  // "Dicas" está disponível em qualquer página do painel, e Dashboard só
  // renderiza uma página por vez internamente.
  const [showLearningCenter, setShowLearningCenter] = useState(false);

  // Show loading indicator while checking auth status
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
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

  // Barreira de login — dono (CNPJ+senha) e funcionário (nome + PIN, tela cheia).
  if (!user) {
    if (authMode === 'funcionario') {
      return (
        <FuncionarioLoginScreen
          onAuthenticated={(result: AuthResult) => {
            login(result);
            setView('dashboard');
          }}
          onVoltarParaDono={() => setAuthMode('login')}
        />
      );
    }

    if (authMode === 'login') {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            padding: '30px',
          }}>
            <AuthScreen onAuthenticated={(result) => {
              login(result);
              // Guarda o CNPJ neste dispositivo — é o que permite a tela de
              // login de funcionário já abrir direto no seletor de nomes,
              // sem pedir CNPJ de novo (ver FuncionarioLoginScreen).
              if (result.doc) localStorage.setItem('revisacarDeviceOficinaDoc', result.doc);
              // depois do login vai pro dash
              setView('dashboard');
            }}/>
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setAuthMode('funcionario')}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-ferrari)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Sou funcionário →
              </button>
            </div>
          </div>
        </div>
      );
    } else if (authMode === 'reset-password') {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            padding: '30px',
          }}>
            <ResetPasswordScreen onAuthenticated={(result) => {
              login(result);
              // dash pos login com senha resetada
              setView('dashboard');
              setAuthMode('login');
            }}/>
          </div>
        </div>
      );
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
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
        <LearningCenterModal onClose={() => setShowLearningCenter(false)} />
      )}
    </div>
  );
}