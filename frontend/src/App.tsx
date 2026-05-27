import { useEffect, useState } from 'react';
import Home from '../src/pages/home';
import { StartScreen } from './pages/StartScreen';
import { AuthScreen } from './pages/AuthScreen';
import type { AdminUser, OrdemServico } from '../src/types';

const STORAGE_KEY = 'revisacar-admin';

export default function App() {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as AdminUser : null;
  });
  const [showStart, setShowStart] = useState(true);
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemServico & { id: string } | null>(null);

  useEffect(() => {
    if (admin) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [admin]);

  const handleStartNew = () => {
    setSelectedOrdem(null);
    setShowStart(false);
  };

  const handleLoadRascunho = (ordem: OrdemServico & { id: string }) => {
    setSelectedOrdem(ordem);
    setShowStart(false);
  };

  const handleBackToStart = () => {
    setShowStart(true);
    setSelectedOrdem(null);
  };

  if (!admin) {
    return <AuthScreen onAuthenticated={(user) => {
      setAdmin(user);
      setShowStart(true);
    }} />;
  }

  if (showStart) {
    return <StartScreen adminNome={admin.nome} onLogout={() => setAdmin(null)} onStartNew={handleStartNew} onLoadRascunho={handleLoadRascunho} />;
  }

  return <div><Home initialOrdem={selectedOrdem} onBackToStart={handleBackToStart} /></div>;
}
