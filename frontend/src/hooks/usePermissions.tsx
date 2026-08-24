import { useAuth } from '../context/AuthContext';

/**
 * Espelha, no front, as permissões que o backend já resolveu pro cargo do
 * usuário logado (via `permissoes` no AuthResult). Serve só pra decidir o
 * que RENDERIZAR — esconder um botão, uma aba, um item de menu.
 *
 * Isso NÃO é a proteção de verdade. Quem protege é o `require_permission`
 * no backend: mesmo que alguém force a UI a aparecer, a chamada à API é
 * rejeitada lá. Ver PERMISSOES em backend/orders/rbac.py pra lista completa.
 */
export function usePermissions() {
  const { user } = useAuth();

  const permissoes = user?.permissoes ?? [];
  const isDono = user?.tipo === 'dono';

  const can = (permissao: string) => isDono || permissoes.includes(permissao);

  return {
    cargo: user?.cargo,
    tipo: user?.tipo,
    isDono,
    can,
  };
}