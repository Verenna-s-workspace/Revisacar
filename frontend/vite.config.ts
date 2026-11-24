import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// "/" é a landing (index.html, estática pro Google). O app mora em /app/ (app/index.html).
// Links que o app abre direto também vão pro app: orçamento do cliente (/o/<token>),
// acesso da equipe (/f/<código>) e redefinição de senha. Em produção o Render faz o mesmo
// com regras de rewrite (ver README).
const ROTAS_DO_APP = /^\/(app(\/|$)|o\/|f\/|reset-password(\/|$|\?))/;

function rotasDoApp(): Plugin {
  const reescrever = (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url ?? '';
    const caminho = url.split('?')[0];
    // O token do orçamento tem ponto (/o/abc.def), então /o/ nunca é tratado como arquivo.
    const arquivo = (!caminho.startsWith('/o/') && /\.[a-z0-9]+$/i.test(caminho)) || caminho.startsWith('/@') || caminho.startsWith('/src/') || caminho.startsWith('/node_modules/');
    if (!arquivo && ROTAS_DO_APP.test(url)) req.url = '/app/index.html';
    next();
  };
  return {
    name: 'rotas-do-app',
    configureServer(server) { server.middlewares.use(reescrever); },
    configurePreviewServer(server) { server.middlewares.use(reescrever); },
  };
}

export default defineConfig({
  plugins: [react(), rotasDoApp()],
  resolve: {
    // Alias `@/` -> `src/` (mesmo mapeamento do `paths` no tsconfig.json).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    allowedHosts: ['revisacar-1-qmmv.onrender.com', 'revisacarapp.com', 'www.revisacarapp.com'],
  },
  preview: {
    allowedHosts: ['revisacar-1-qmmv.onrender.com', 'revisacarapp.com', 'www.revisacarapp.com'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
      output: {
        // Só o React vai num arquivo próprio (muda pouco entre deploys, fica no cache). O resto o
        // Rollup divide sozinho: os gráficos (recharts) ficam junto das telas que os usam. A forma
        // antiga ({ 'vendor-react': [...], 'vendor-charts': ['recharts'] }) deixava o React dentro
        // do arquivo dos gráficos, e até a tela de login baixava os 563 KB.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  }
});
