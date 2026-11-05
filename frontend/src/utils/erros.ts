/**
 * Mensagem legível de um erro vindo de `api`. Mantido por compatibilidade: a lógica vive em
 * `api_erro.ts` (mensagemDoErro), para as telas e os hooks falarem todos do mesmo jeito.
 */
export { mensagemDoErro as mensagemDeErro } from './api_erro';
