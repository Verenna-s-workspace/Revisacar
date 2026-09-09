import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth';

/* ─── Lazy screens ──────────────────────────────────────── */
const Dashboard     = lazy(() => import('./components/screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const Vehicles      = lazy(() => import('./components/screens/VehiclesScreen').then(m => ({ default: m.VehiclesScreen })));
const Schedule      = lazy(() => import('./components/screens/ScheduleScreen').then(m => ({ default: m.ScheduleScreen })));
const History       = lazy(() => import('./components/screens/HistoryScreen').then(m => ({ default: m.HistoryScreen })));
const Maintenance   = lazy(() => import('./components/screens/ScheduledMaintenanceScreen').then(m => ({ default: m.ScheduledMaintenanceScreen })));
const Estimates     = lazy(() => import('./components/screens/EstimatesScreen').then(m => ({ default: m.EstimatesScreen })));
const Notifications = lazy(() => import('./components/screens/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })));
const Profile       = lazy(() => import('./components/screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const AuthScreen    = lazy(() => import('./components/screens/AuthScreen').then(m => ({ default: m.AuthScreen })));
const MechanicClientRegister = lazy(() => import('./components/screens/MechanicClientRegister').then(m => ({ default: m.MechanicClientRegister })));

/* ─── Query Client ──────────────────────────────────────── */
const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});

/* ─── Guards ────────────────────────────────────────────── */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuthStore();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/* ─── Loader ────────────────────────────────────────────── */
function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-brand rounded-[18px] flex items-center justify-center shadow-brand">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none"
               stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="12" rx="2"/>
            <path d="M16 8h4l3 3v4h-7V8z"/>
            <circle cx="5.5" cy="17.5" r="2.5"/>
            <circle cx="18.5" cy="17.5" r="2.5"/>
          </svg>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce"
                 style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Router ────────────────────────────────────────────── */
function AppRouter() {
  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/login"    element={<AuthScreen />} />
        <Route path="/cadastro" element={<AuthScreen />} />
        <Route path="/"             element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/veiculos"     element={<RequireAuth><Vehicles /></RequireAuth>} />
        <Route path="/agendar"      element={<RequireAuth><Schedule /></RequireAuth>} />
        <Route path="/historico"    element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/manutencoes"  element={<RequireAuth><Maintenance /></RequireAuth>} />
        <Route path="/orcamentos"   element={<RequireAuth><Estimates /></RequireAuth>} />
        <Route path="/notificacoes" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/perfil"       element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="*"             element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

/* ─── App ───────────────────────────────────────────────── */
export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppRouter />
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 3000,
            style: {
              background: '#18171A',
              color: '#FFFFFF',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '0.875rem',
              fontWeight: '600',
              borderRadius: '14px',
              padding: '12px 18px',
              maxWidth: '380px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
              letterSpacing: '-0.01em',
            },
            success: {
              iconTheme: { primary: '#16A34A', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#CC1400', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
