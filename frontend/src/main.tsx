import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import OrcamentoPublicoPage from './features/OrcamentoPublico/OrcamentoPublicoPage';
import { tokenDoCaminho } from './utils/orcamento_link_utils';
import AcessoEquipePage from './features/AcessoEquipe/AcessoEquipePage';
import { codigoDoCaminho } from './utils/acesso_equipe_utils';

// ── Service Worker ────────────────────────────────────────────────────────────
// In development: unregister any previously installed SW so it never
// intercepts Vite's hot-reload requests and serves stale cached assets.
// In production: register normally so the app works offline as a PWA.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[PWA] SW registrado:', reg.scope))
        .catch((err) => console.error('[PWA] Erro ao registrar SW:', err));
    });
  } else {
    // Dev mode: kill every registered SW so cache-first never blocks HMR
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
        console.log('[Dev] SW desregistrado:', reg.scope);
      }
    });
  }
}

// Global PWA Install Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('[RevisaCar] Elemento #root não encontrado no HTML.');

// Link público do orçamento (/o/<token>): página do CLIENTE, sem login e fora do painel
// (não monta AuthProvider nem App, então nada da sessão da oficina entra nela).
const tokenPublico = tokenDoCaminho(window.location.pathname);

// Link de acesso da equipe (/f/<código>): pareia este aparelho com a oficina e abre o login do
// funcionário. Depois disso é o painel normal (por isso o painel entra como filho).
const codigoEquipe = codigoDoCaminho(window.location.pathname);

const painel = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

createRoot(rootElement).render(
  <StrictMode>
    {tokenPublico ? (
      <OrcamentoPublicoPage token={tokenPublico} />
    ) : codigoEquipe ? (
      <AcessoEquipePage codigo={codigoEquipe}>{painel}</AcessoEquipePage>
    ) : (
      painel
    )}
  </StrictMode>
);