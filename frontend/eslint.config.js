// ESLint (flat config) — Fase 0 das travas do frontend (branch chore/travas-lint).
//
// TODAS as regras começam como AVISO: o lint roda no CI, mas não derruba o build.
// Conforme as fases de migração terminam, regras sobem para 'error' (ver TIMELINE.md).
// Só analisa `src/`; arquivos de configuração na raiz ficam de fora.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const ARQUIVOS = ['src/**/*.{ts,tsx}'];

/** Rebaixa toda regra ligada ('error') para 'warn', mantendo as opções. Regras 'off' ficam 'off'. */
export const comoAviso = (rules = {}) =>
  Object.fromEntries(
    Object.entries(rules).map(([nome, cfg]) => {
      const nivel = Array.isArray(cfg) ? cfg[0] : cfg;
      if (nivel === 'off' || nivel === 0) return [nome, cfg];
      return [nome, Array.isArray(cfg) ? ['warn', ...cfg.slice(1)] : 'warn'];
    }),
  );

const base = [js.configs.recommended, ...tseslint.configs.recommended].map((cfg) => ({
  ...cfg,
  files: ARQUIVOS,
  rules: comoAviso(cfg.rules),
}));

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  ...base,

  {
    files: ARQUIVOS,
    plugins: { 'react-hooks': reactHooks },
    // O código já tem `eslint-disable-next-line react-hooks/exhaustive-deps`; sem o plugin
    // carregado, o ESLint reclamaria de "regra não encontrada" nesses comentários.
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      // Ordem dos hooks: quebrar isso gera o React error #300 (citado em pages/Dashboard.tsx).
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // Variáveis e parâmetros sem uso. Prefixe com `_` para marcar como intencional.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];
