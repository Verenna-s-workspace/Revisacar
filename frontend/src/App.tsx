import { useState } from 'react';
import Check  from './pages/InitialChecklist';
import Check2 from './pages/InspectionChecklist';
import { Dashboard } from './pages/Dashboard';
import { api } from './utils/api';
import type { OrdemServico } from './types';

type View = 'dashboard' | 'os' | 'os2';

export default function App() {
  const [view, setView]                 = useState<View>('dashboard');
  const [selectedOrdem, setSelectedOrdem] = useState<(OrdemServico & { id: string }) | null>(null);

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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'dashboard') {
    return (
      <Dashboard
        onNewOS={handleStartNew}
        onLoadOS={handleLoadOS}
      />
    );
  }

  if (view === 'os2') {
    return (
      <Check2
        initialOrdem={selectedOrdem}
        onBackToStart={handleBackToDashboard}
      />
    );
  }

  
  return (
    <Check
      initialOrdem={selectedOrdem}
      onBackToStart={handleBackToDashboard}
      onNextChecklist={handleGoToCheck2}   // ← permite ir para Check2
    />
  );
}
