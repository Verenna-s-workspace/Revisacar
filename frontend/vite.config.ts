import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['revisacar-1-qmmv.onrender.com'],
  },
  preview: {
    allowedHosts: ['revisacar-1-qmmv.onrender.com'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
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
