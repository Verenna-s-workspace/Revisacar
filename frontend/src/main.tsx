import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);