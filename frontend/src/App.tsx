import { useState } from 'react';
import Home from '../src/pages/home';
import { StartScreen } from '../src/components/StartScreen';
import type { OrdemServico } from '../src/types';

export default function App() {
  const [showStart, setShowStart] = useState(true);
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemServico & { id: string } | null>(null);

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

  if (showStart) {
    return <StartScreen onStartNew={handleStartNew} onLoadRascunho={handleLoadRascunho} />;
  }

  return <div><Home initialOrdem={selectedOrdem} onBackToStart={handleBackToStart} /></div>;
}
