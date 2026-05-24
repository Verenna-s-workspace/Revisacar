import { useState } from 'react';
import Home from './pages/home';
import { Dashboard } from './pages/Dashboard';
import { api } from './utils/api';
import type { OrdemServico } from './types';

type View = 'dashboard' | 'os';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemServico & { id: string } | null>(null);

  const handleStartNew = () => { setSelectedOrdem(null); setView('os'); };
  const handleLoadRascunho = (ordem: OrdemServico & { id: string }) => { setSelectedOrdem(ordem); setView('os'); };
  const handleBackToStart = () => { setView('dashboard'); setSelectedOrdem(null); };

  const handleLoadOS = async (id: string) => {
    try {
      const ordem = await api.obterOrdem(id);
      handleLoadRascunho(ordem);
    } catch (e) {
      console.error('Erro ao carregar OS:', e);
    }
  };

  if (view === 'dashboard') {
    return <Dashboard onNewOS={handleStartNew} onLoadOS={handleLoadOS} />;
  }

  return <div><Home initialOrdem={selectedOrdem} onBackToStart={handleBackToStart} /></div>;
}
