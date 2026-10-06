# TIMELINE — RevisaCar (guia de desenvolvimento, um módulo por vez)

Fluxo: analisar → planejar → backend → banco → APIs → frontend → integração → testes → validação.

## Status dos módulos
| Módulo | Status |
|---|---|
| Estoque | 🟡 Backend + SQL + testes prontos; hooks/telas do frontend ajustados (tsc + build ok). Falta: rodar SQL no Supabase e validar fim-a-fim |
| Clientes | ⏸️ Pausado a pedido (backend feito na cópia anterior, fora deste repo) |
| Veículos, Agendamentos, Catálogo | 🔴 não iniciados |
| Relatórios | 🟡 parcial |

## Estoque — backend (2026-10-04)
**Arquivos:** `backend/sql/estoque.sql`, `backend/orders/estoque_views.py`, seção "Estoque" em `serializers.py`, rotas em `urls.py`, `backend/tests/*`, `requirements-dev.txt`.

**Rotas:** `GET/POST /estoque`, `GET /estoque/movimentos[?desde=ISO]`, `GET/PATCH/DELETE /estoque/<id>`, `GET/POST /kits`, `GET/PATCH/DELETE /kits/<id>`, `POST /kits/<id>/aplicar`.

**Decisões**
- Multi-tenant por `oficina_doc` em toda query; FKs compostas `(oficina_doc, id)` no banco.
- Operações multi-tabela são funções Postgres via `supabase.rpc` (atomicidade + `FOR UPDATE`): `estoque_ajustar_quantidade`, `estoque_aplicar_kit`, `estoque_salvar_kit`.
- JSON camelCase; opcionais vazios são omitidos; PATCH mescla com o estado atual; `null` explícito limpa campo opcional.
- Erros: validação 422; item em kit 409; tabelas ausentes 503 (manda rodar `estoque.sql`); aplicar kit rejeitado = 200 `{ok:false, mensagem}`.
- RBAC: `estoque.ver` lê; `estoque.editar` (dono/gerente) cria/edita/exclui e **aplica kit** (mecânico/atendente não aplicam — decisão pendente do usuário).
- `CATEGORIAS_ESTOQUE` (serializers) deve ficar igual a `CATEGORIA_GRUPOS` do frontend.

**Validado:** 63 testes (`cd backend && pip install -r requirements-dev.txt && pytest`) contra Postgres real descartável, incluindo concorrência e isolamento entre oficinas. As views rodam via emulador do supabase-py (`tests/fake_supabase.py`).
**NÃO validado:** nada contra o Supabase/PostgREST reais (cache de schema, limite de 1000 linhas, chave usada).

## Pendências Estoque
1. Rodar `backend/sql/estoque.sql` no SQL Editor do Supabase.
2. Conferir no `supabase.env` se a chave é `service_role` (se for `anon`, RLS pode bloquear; ver bloco comentado no SQL).
3. ~~Frontend: hooks geram IDs locais~~ FEITO (2026-10-04): `useEstoque` em produção só mostra o que o servidor confirmou (id real, item devolvido, `aplicarKit` usa itens/movimentos da resposta); movimentos recarregados após criar/ajustar. Modo demo (DEV com API fora) mantém a lógica local antiga. Erros do servidor (422/409) aparecem no modal (salvar) ou em aviso na página (excluir). `undefined` em foto/serviço vira `null` no PATCH (senão o backend entende "não mexer"). Falta o mesmo ajuste nos hooks de Clientes.
4. Decidir RBAC de aplicar kit para mecânico.
5. Teste manual fim-a-fim com build de produção (`npm run build && npm run preview`), pois em `npm run dev` o fallback demo mascara erros.

## Estoque — frontend (2026-10-04)
Arquivos: `hooks/useEstoque.ts`, `EstoquePage.tsx`, `Estoque/ProdutoModal.tsx`, `Estoque/CriarKitModal.tsx`, `Estoque/ConfirmDeleteModal.tsx`.
Validado: `tsc --noEmit` limpo e `vite build` ok. NÃO validado: execução no navegador contra o backend (sem testes de frontend no projeto).
Obs.: `useEstoque` é chamado também em Relatórios, Serviços e Atendimento — cada um tem seu próprio estado e carrega por conta própria.
