import { useState } from 'react';
import Check  from './pages/InitialChecklist';
import Check2 from './pages/InspectionChecklist';
import { Dashboard } from './pages/Dashboard';
import { AuthScreen } from './pages/AuthScreen';
import { ResetPasswordScreen } from './pages/ResetPasswordScreen';
import { FuncionarioLoginScreen } from './pages/FuncionarioLogin/FuncionarioLoginScreen';
import { api } from './utils/api';
import type { OrdemServico, AuthResult } from './types';
import type { OSPrefillInput } from './types/atendimento';
import { useAuth } from './context/AuthContext';

type View = 'dashboard' | 'os' | 'os2' | 'login' | 'reset-password';

export default function App() {
  const { user, loading, login, logout } = useAuth();

  const [view, setView]                 = useState<View>('dashboard');
  const [selectedOrdem, setSelectedOrdem] = useState<(OrdemServico & { id: string }) | null>(null);
  const [prefillOS, setPrefillOS]       = useState<OSPrefillInput | null>(null);
  const [authMode, setAuthMode]         = useState<'login' | 'reset-password' | 'funcionario'>('login');

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
    setSelectedOrdem(null);
    setPrefillOS(null);
    setView('os');            // sempre abre o Check (fluxo de entrada)
  };

  // Igual a handleStartNew, mas pré-preenchendo cliente/veículo (usado pelo
  // botão "Iniciar Atendimento" da tela de Atendimento — ver Seção 8 do prompt).
  const handleStartNewComPrefill = (prefill: OSPrefillInput) => {
    setSelectedOrdem(null);
    setPrefillOS(prefill);
    setView('os');
  };

  const handleLoadRascunho = (ordem: OrdemServico & { id: string }) => {
    setSelectedOrdem(ordem);
    setPrefillOS(null);
    setView('os');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedOrdem(null);
    setPrefillOS(null);
  };

  const handleGoToCheck2 = () => {
    setView('os2');           // chamado pelo botão "Próxima etapa" do Step3
  };

  const handleLoadOS = async (id: string) => {
    try {
      const ordem = await api.obterOrdem(id);
      handleLoadRascunho(ordem);
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
          />
        ) : view === 'os2' ? (
          <Check2
            initialOrdem={selectedOrdem}
            onBackToStart={handleBackToDashboard}
          />
        ) : view === 'os' ? (
          <Check
            initialOrdem={selectedOrdem}
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
          />
        )}
      </div>
    </div>
  );
}