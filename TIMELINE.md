# TIMELINE — RevisaCar (guia de desenvolvimento, um módulo por vez)

Fluxo: analisar → planejar → backend → banco → APIs → frontend → integração → testes → validação.

## Status dos módulos
| Módulo | Status |
|---|---|
| Estoque | 🟡 Backend + SQL + testes prontos; hooks/telas do frontend ajustados (tsc + build ok). Falta: rodar SQL no Supabase e validar fim-a-fim |
| Clientes | ⏸️ Pausado a pedido (backend feito na cópia anterior, fora deste repo) |
| Catálogo (Serviços) | 🟡 Backend + SQL + testes + hook/telas prontos (tsc + build ok). Falta: rodar `servicos.sql`, relogar, validar no navegador |
| Veículos, Agendamentos | 🔴 não iniciados |
| Relatórios | 🟡 Backend + SQL + testes + hook prontos (tsc + build ok). Falta: rodar `ordens_oficina.sql`, relogar, validar no navegador |

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

## Catálogo de Serviços (2026-10-06) — branch feat/catalogo-servicos (parte de feat/estoque-backend)
**Arquivos:** `backend/sql/servicos.sql`, `orders/servicos_views.py`, `ServicoSerializer` em serializers.py, rotas em urls.py, permissões em rbac.py, `tests/test_servicos.py`; frontend: `hooks/useServicos.ts`, `utils/api_erro.ts` (helpers compartilhados com useEstoque), `ServicosPage.tsx`, `Servicos/ServicoFormModal.tsx`, `Servicos/DeleteConfirmModal.tsx`.
**Rotas:** `GET/POST /servicos`, `GET/PATCH/DELETE /servicos/<id>`.
**Decisões**
- Tabela `servicos` multi-tenant (`oficina_doc`), preço ≥ 0 (o modal exige > 0), `duracao` e `categoria` texto livre.
- Novas permissões `servicos.ver` (todos os cargos) e `servicos.editar` (dono e gerente). **Tokens emitidos antes disso não têm as permissões novas: relogar.**
- Excluir é a função SQL `servicos_excluir`: limpa `estoque_kits.servico_id` (texto, sem FK) da mesma oficina e apaga, na mesma transação. Kit nunca fica apontando pra serviço inexistente.
- Frontend igual ao Estoque: com a API no ar mostra só o que o servidor confirmou; erros aparecem no modal (salvar) ou em aviso (excluir/ativar). Demo local só em DEV com API fora.
- Erro 42501 (permissão no banco) vira mensagem clara apontando o supabase.env (também no Estoque).
**Validado:** 86 testes (pytest) contra Postgres real; `tsc --noEmit` e `vite build` limpos. **Não validado:** navegador contra o Supabase real.
**Pendências:** rodar `servicos.sql` (depois de `estoque.sql`); relogar; testar criar/editar/ativar/excluir; botões ainda não são escondidos por permissão na UI (a proteção real é o backend).

## Relatórios (2026-10-07) — branch feat/relatorios-backend (parte de feat/catalogo-servicos)
**O que faltava (diagnóstico)**
1. `ordens` não tinha `oficina_doc` e `/ordens` não filtrava: toda oficina via as OS de todas (inclusive nos relatórios).
2. Relatórios baixava todas as OS e calculava no navegador, sem exigir `relatorios.ver`.
3. Bug: `payload` é `text` no banco e chega como string JSON; `payload.servicos_selecionados` dava `undefined` → "serviços mais realizados" vazio e todo valor caía no ticket fixo (R$ 480). Só funcionava no demo (payload objeto).
4. Faturamento era estimativa fixa (tabela chumbada no front).
5. `created_at` das OS era gravado sem fuso (`datetime.now().isoformat()`).

**Arquivos:** `backend/sql/ordens_oficina.sql`, `orders/relatorios_views.py`, ajustes em `orders/views.py` (ordens escopadas por oficina; `_now()` com fuso), rota em `urls.py`, `tests/test_relatorios.py` (+ stubs de `ordens`/`financeiro_transacoes` no conftest, `lt/lte/neq` no emulador), `tzdata` em requirements.txt; frontend: `types/relatorios.ts`, `utils/api.ts` (`api.relatorios`), `utils/relatorios.ts`, `hooks/useRelatorios.ts`, texto do card em `RelatoriosPage.tsx`.
**Rota:** `GET /relatorios?de&ate[&de_anterior&ate_anterior][&tz]` (permissão `relatorios.ver`: dono e gerente). Devolve `totais` (atual/anterior), `dias` (série esparsa por dia no fuso `tz`), `servicos` (OS finalizadas do período) e `faturamentoOrigem`.
**Decisões**
- Faturamento: se a oficina tem ao menos uma entrada não cancelada no Financeiro → soma das entradas por `data_competencia` (mesma conta de `/financeiro/resumo`, pendentes incluídas); senão estimativa por OS finalizada (tabela de preços + ticket R$ 480, espelho do que o front usava). A tela diz qual está em uso.
- Dia da OS = dia no fuso do navegador (`tz`; padrão America/Sao_Paulo). OS antigas sem fuso são lidas como horário do servidor.
- `anterior = null` quando não há nenhuma OS no período anterior (a tela esconde a variação).
- Semana/mês continuam sendo agrupados no front a partir dos dias; presets de período continuam no front.
- Itens de estoque mais movimentados seguem vindo de `useEstoque` (`GET /estoque/movimentos`), não de `/relatorios`.
- Todas as rotas de `/ordens` filtram por `oficina_doc`; OS de outra oficina = 404. Se a coluna não existe, 503 mandando rodar `ordens_oficina.sql`.
**Validado:** 133 testes (pytest) contra Postgres real; `tsc --noEmit` e `vite build` limpos; série do front confere com os totais. **Não validado:** navegador contra o Supabase real.
**Pendências**
1. Rodar `backend/sql/ordens_oficina.sql` ANTES de subir o backend novo (sem a coluna, `/ordens` responde 503). Com uma oficina só, as OS antigas são associadas sozinhas; com mais de uma, preencher na mão (exemplo no fim do script) — OS sem oficina deixam de aparecer.
2. Relogar (tokens antigos não têm permissões novas).
3. `useDashboard` (Visão Geral) ainda lê `o.payload?.servicos_selecionados` direto: mesmo bug do payload em string (top serviços vazio). Não mexido (fora de Relatórios).
4. `GET /fotos/<path>` não exige login (já era assim).
5. App do cliente / `customers`: continua sem `oficina_doc` (ver `customer_app_oficina_doc.sql`, não aplicado).
