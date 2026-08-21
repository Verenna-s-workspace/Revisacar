# Dead Code Cleanup — 2026-08-21

Branch: `chore/dead-code-cleanup`  
Base commit: `faf511d` (feat: business hours config)

Para reverter **todas** as mudanças: `git revert HEAD` ou `git checkout main`.  
Para reverter um arquivo específico: `git checkout faf511d -- <caminho>`.

---

## Arquivos removidos

### Frontend — diretório `components/dashboard/` (12 arquivos)

Todos eram cópias antigas com dados mockados dos componentes vivos em `features/Dashboard/`.  
Nenhum arquivo no projeto importava de `components/dashboard/`.

| Arquivo removido | Arquivo vivo equivalente |
|---|---|
| `src/components/dashboard/AgendamentosPage.tsx` | `src/features/Dashboard/Agendamentos/AgendamentosPage.tsx` |
| `src/components/dashboard/ClientesPage.tsx` | `src/features/Dashboard/Clientes/ClientesPage.tsx` |
| `src/components/dashboard/ConfiguracoesPage.tsx` | `src/features/Dashboard/ConfiguracoesPage.tsx` |
| `src/components/dashboard/EstoquePage.tsx` | `src/features/Dashboard/EstoquePage.tsx` |
| `src/components/dashboard/FaturamentoChart.tsx` | `src/features/Dashboard/FaturamentoChart.tsx` |
| `src/components/dashboard/FinanceiroPage.tsx` | `src/features/Dashboard/FinanceiroPage.tsx` |
| `src/components/dashboard/Icons.tsx` | `src/features/Dashboard/Icons.tsx` |
| `src/components/dashboard/Navigation.tsx` | `src/features/Dashboard/Navigation.tsx` |
| `src/components/dashboard/OrdensPage.tsx` | `src/features/Dashboard/OrdensPage.tsx` |
| `src/components/dashboard/Primitives.tsx` | `src/features/Dashboard/Primitives.tsx` |
| `src/components/dashboard/ServicosPage.tsx` | `src/features/Dashboard/ServicosPage.tsx` |
| `src/components/dashboard/VeiculosPage.tsx` | `src/features/Dashboard/Veiculos/VeiculosPage.tsx` |

### Frontend — shadow root-level

| Arquivo removido | Motivo |
|---|---|
| `src/features/Dashboard/ClientesPage.tsx` | Sombra não importada. `pages/Dashboard.tsx` importa de `Clientes/ClientesPage.tsx`. |
| `src/pages/home.tsx` | Página antiga de criação de OS, nunca importada por `App.tsx`. |
| `src/pages/StartScreen.tsx` | Tela de início antiga, substituída pelo fluxo `AuthScreen`/`FuncionarioLoginScreen`. |

### Backend

| Arquivo/Diretório removido | Arquivo vivo equivalente |
|---|---|
| `backend/rbac.py` | `backend/orders/rbac.py` (idêntico; importado via `.rbac` relativo) |
| `backend/financial/Financeiroviews.py` + dir `financial/` | `backend/orders/financeiro_views.py` (idêntico; roteado via `orders/urls.py`) |

---

## Correções em arquivos vivos

### `src/features/Dashboard/Icons.tsx`

**Problema:** Ícones `orders` e `home` usavam atributos HTML em vez de JSX (`stroke-linecap`, `stroke-linejoin`, `stroke-width`) e classes Tailwind (`className="w-5 h-5 ..."`) num projeto sem Tailwind configurado. Os atributos eram silenciosamente ignorados pelo React.

**Correção:** Migrado para `strokeLinecap`, `strokeLinejoin`, `strokeWidth` camelCase JSX. Substituído `className` + tamanho implícito por `width="20" height="20"` explícito, alinhando com todos os outros ícones do arquivo.

Para reverter: `git checkout faf511d -- frontend/src/features/Dashboard/Icons.tsx`

---

### `src/features/Dashboard/OrdensPage.tsx`

**Problema 1:** Três imports (`Skeleton`, `Sidebar`/`MobileNav`, `NavPage`) apareciam no meio do arquivo (após definições de função), quebrando a convenção e duplicando o import de `Primitives`.

**Correção:** Imports movidos para o topo do arquivo e consolidados numa única declaração por módulo.

**Problema 2:** `export function TableRow` era exportado mas nenhum arquivo no projeto o importava.

**Correção:** Removido `export` — `TableRow` continua existindo como função interna usada por `OrdensPage`.

Para reverter: `git checkout faf511d -- frontend/src/features/Dashboard/OrdensPage.tsx`

---

### `src/features/Dashboard/Primitives.tsx`

**Problema:** `Donut` e `Sparkline` eram exportados mas usados apenas internamente (por `MetaCard` e `KpiCard`, ambos no mesmo arquivo).

**Correção:** Removido `export` de ambas — permanecem como helpers internos.

Para reverter: `git checkout faf511d -- frontend/src/features/Dashboard/Primitives.tsx`

---

### `src/features/Dashboard/Navigation.tsx`

**Problema:** Fallback `user?.nome ?? 'Lucas Andrelo'` expunha nome de desenvolvedor para usuários reais quando `user` é nulo durante carregamento de auth.

**Correção:** Substituído por `'Usuário'` (fallback neutro), consistente com o padrão de fallback da sidebar (`iniciaisDe` retorna `'OF'` quando nome é indefinido).

Para reverter: `git checkout faf511d -- frontend/src/features/Dashboard/Navigation.tsx`

---

## O que NÃO foi alterado

- `Navigation.tsx` — botão "dicas" no dock aponta para `PlaceholderPage`. Mantido como estava pois é funcionalidade planejada, não código morto.
- `backend/orders/views.py` — todos os imports foram verificados e estão em uso.
- Qualquer lógica de negócio, rota, hook, tipo ou estilo.
