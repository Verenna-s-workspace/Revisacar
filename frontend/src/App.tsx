import { useState } from 'react';
import Check  from './pages/InitialChecklist';
import Check2 from './pages/InspectionChecklist';
import { Dashboard } from './pages/Dashboard';
import { AuthScreen } from './pages/AuthScreen';
import { ResetPasswordScreen } from './pages/ResetPasswordScreen';
import { api } from './utils/api';
import type { OrdemServico } from './types';
import { useAuth } from './context/AuthContext';

type View = 'dashboard' | 'os' | 'os2' | 'login' | 'reset-password';

export default function App() {
  const { user, loading, login, logout } = useAuth();

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

  const [view, setView]                 = useState<View>('dashboard');
  const [selectedOrdem, setSelectedOrdem] = useState<(OrdemServico & { id: string }) | null>(null);
  const [authMode, setAuthMode]         = useState<'login' | 'reset-password'>('login');

  // ── Navegação ──────────────────────────────────────────────────────────────
  const handleStartNew = () => {
    setSelectedOrdem(null);
    setView('os');            // sempre abre o Check (fluxo de entrada)
  };

  const handleLoadRascunho = (ordem: OrdemServico & { id: string }) => {
    setSelectedOrdem(ordem);
    setView('os');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedOrdem(null);
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
  // se nao tiver logado mostra o login
  if (!user) {
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
              // depois do login vai pro dash
              setView('dashboard');
            }}/>
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
          />
        ) : view === 'os2' ? (
          <Check2
            initialOrdem={selectedOrdem}
            onBackToStart={handleBackToDashboard}
          />
        ) : view === 'os' ? (
          <Check
            initialOrdem={selectedOrdem}
            onBackToStart={handleBackToDashboard}
            onNextChecklist={handleGoToCheck2}   // ← permite ir para Check2
          />
        ) : (
          // Fallback (shouldn't reach here)
          <Dashboard
            onNewOS={handleStartNew}
            onLoadOS={handleLoadOS}
          />
        )}
      </div>
    </div>
  );
}