# TIMELINE — RevisaCar (guia de desenvolvimento, um módulo por vez)

Fluxo: analisar → planejar → backend → banco → APIs → frontend → integração → testes → validação.

## Status dos módulos
| Módulo | Status |
|---|---|
| Estoque | 🟡 Backend + SQL + testes prontos; hooks/telas do frontend ajustados (tsc + build ok). Falta: rodar SQL no Supabase e validar fim-a-fim |
| Clientes | ⏸️ Pausado a pedido (backend feito na cópia anterior, fora deste repo) |
| Catálogo (Serviços) | 🟡 Backend + SQL + testes + hook/telas prontos (tsc + build ok). Falta: rodar `servicos.sql`, relogar, validar no navegador |
| Visão Geral | 🟡 Backend + SQL + testes + frontend prontos (tsc + build ok, smoke no navegador com API simulada). Falta: rodar `visao_geral.sql`, relogar, validar contra o Supabase real |
| Financeiro | 🟡 Backend + SQL + testes + hook/telas prontos (tsc + build ok, smoke no navegador com API simulada). Falta: rodar `financeiro.sql`, validar contra o Supabase real |
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

## Visão Geral (2026-10-09) — branch feat/visao-geral (parte de feat/relatorios-backend)
**O que estava errado**
1. Mesmo bug do `payload` em string: Top serviços vazio fora do demo.
2. Faturamento = nº de OS finalizadas × R$ 480 (contradizia os Relatórios); mês parcial comparado com o mês anterior INTEIRO.
3. Meta mensal fixa em R$ 20.000, sem onde editar.
4. Resumo Financeiro: custos e lucro sempre 0; frase "seu lucro aumentou X%" inventada (usava % de receita, `Math.abs`, sempre "aumentou").
5. Alertas fictícios ("aguardando aprovação" contava rascunhos) — a sidebar já tinha os reais (`useAlertasResumo`).
6. Mapa de calor: 6 colunas (sem domingo), rótulos "Seg Ter Qua Qux Sáb Dom" (sem Sex, "Qux") → tudo deslocado.
7. Selects do gráfico (7/30 dias/mês) e do Top serviços não faziam nada.
8. Mecânico/atendente viam faturamento. Saudação com nome fixo ("Lucas Andrelo"). Eixo Y quebrado (`${v/1000}.000` → "0.48.000"). Falha da API virava zeros silenciosos.

**Arquivos:** `backend/sql/visao_geral.sql`, `orders/visao_geral_views.py`, `MetaMensalSerializer`, rotas em `urls.py`, `tests/test_visao_geral.py` (45), refatoração mínima em `relatorios_views.py` (`_buscar_lancamentos`); frontend: `types/visao_geral.ts`, `utils/visao_geral.ts`, `hooks/useVisaoGeral.ts`, `hooks/useOrdens.ts` (lista de OS; `useDashboard.ts` removido), `pages/Dashboard.tsx`, `Primitives.tsx` (MetaCard editável, heatmap 7 colunas), `FaturamentoChart.tsx`, `utils/dashboard.ts` (HEAT_DAYS), `ClientesPage`/`ClientDetailsModal` (imports), `utils/api.ts`.
**Rotas:** `GET /visao-geral[?tz]` (qualquer usuário logado), `PUT /visao-geral/meta` (`configuracoes.editar`, `{"valor": n|null}`).
**Decisões**
- Blocos de dinheiro só vêm pra quem pode: `faturamento`/`meta`/`serie[].faturamento`/`servicos[].valorEstimado` (relatorios.ver ou financeiro.ver), `financeiro` (financeiro.ver), `financeiro.lucro*` (financeiro.ver_margem). A UI desenha pela presença do bloco; sem dinheiro, o gráfico vira "Ordens por dia" e o Top serviços mostra quantidade.
- Mês = dia 1 até hoje × MESMO trecho do mês anterior. Faturamento igual ao dos Relatórios (entradas do Financeiro, senão estimativa por OS).
- Resumo Financeiro = lançamentos do Financeiro no mês (receitas/custos); sem nenhum lançamento mostra "lance no Financeiro" em vez de zeros. Variação do lucro só quando há lucro anterior ≠ 0.
- Top serviços: OS **finalizadas** dos últimos 30 dias (antes: todas as OS, desde sempre); valor é ESTIMADO (tabela de preços × quantidade; fora da tabela = R$ 200) — cabeçalho "Fat. est.". Ordenação Faturamento/Quantidade funciona. Dia da semana: 0 = segunda.
- Série de 31 dias (o "Este mês" no dia 31 precisa do dia 1); o front recorta 7/30/mês.
- Meta por oficina em `admins.meta_mensal` (null = não definida). Sem a coluna a tela segue, só sem meta editável (PUT responde 503 com instrução).
- Alertas = os da sidebar (`useAlertasResumo`). Sem dados demo na Visão Geral: API fora do ar = erro com "tentar novamente".
**Validado:** 178 testes (pytest) contra Postgres real; `tsc` e `vite build` limpos; smoke no Chromium com API simulada (dono e mecânico; definir meta envia o valor certo). **Não validado:** contra o Supabase real.
**Pendências**
1. Rodar `backend/sql/visao_geral.sql` (depois de `ordens_oficina.sql`); relogar.
2. Alertas: `useAlertasResumo` é chamado na sidebar e na página (2 buscas de ordens/estoque); dá pra compartilhar depois.
3. `GET /ordens` ainda devolve TODAS as OS (com payload) pro "Ordens recentes", Ordens e Clientes — paginar é trabalho futuro.
4. "Gastos estimados" no perfil do cliente ainda usa OS finalizadas × R$ 480 (fora da Visão Geral).

## Financeiro (2026-10-11) — branch feat/financeiro (parte de feat/visao-geral)

**Problemas achados:** (1) a tabela `financeiro_transacoes` não tinha script no repositório (sem índices, travas nem FK); (2) listagem e resumo sem paginação — o Supabase corta em 1000 linhas e os totais ficavam errados; `/resumo` baixava o histórico inteiro da oficina; (3) `de`/`ate` sem validação; "hoje" (período padrão e `vencido`) vinha do relógio do servidor; (4) erros do banco viravam 500 sem explicação; (5) PATCH buscava por id e só depois checava a oficina, devolvia só "Atualizado" e dava 422 em linha antiga com `descricao` nula; voltar para pendente mantinha `data_pagamento`; (6) front: data padrão do lançamento e limites do período usavam `toISOString()` (UTC — depois das 21h no Brasil viravam o dia seguinte), erros genéricos, sem edição de lançamento, resposta antiga podia sobrescrever a nova.

**Arquivos:** `backend/sql/financeiro.sql` (idempotente: cria a tabela ou só completa colunas; CHECKs de tipo/status/valor e FK da oficina como NOT VALID; índices por oficina+competência e pendentes), `orders/financeiro_views.py` (reescrito), limites de tamanho em `FinanceiroTransacaoSerializer`, `tests/test_financeiro.py` (76 testes; conftest roda `financeiro.sql` 2×); frontend: `hooks/useFinanceiro.ts`, `FinanceiroPage.tsx`, `Financeiro/TransacaoModal.tsx` (criar/editar), `utils/financeiro_utils.ts` (`isoLocal`/`hojeLocal`), `utils/api.ts` (`tz`).

**Regras:**
- Respostas continuam em snake_case (formato que o front já usava). PATCH/POST devolvem a linha completa.
- `de`+`ate` juntos ou nenhum (aí é o mês atual no fuso `?tz`, padrão America/Sao_Paulo); inválido/invertido/maior que 800 dias → 422. `vencido` = pendente com vencimento antes de "hoje" no fuso do usuário.
- Pendente nunca guarda `data_pagamento`; marcar pago grava agora; voltar a pendente apaga. Não se cria lançamento já cancelado; cancelado não se edita (409); cancelar é `DELETE` (soft, idempotente). `tipo` não muda.
- `/resumo`: totais do período por `data_competencia` (pendentes contam como faturamento, igual Relatórios/Visão Geral); `a_receber/a_pagar/vencido_*` são a dívida em aberto agora, sem corte de período; soma em Decimal; lucro/margem só com `financeiro.ver_margem`.
- Tabela ausente/coluna faltando → 503 mandando rodar `financeiro.sql`; chave sem service_role → 500 apontando o `supabase.env`.

**Pendências / decisões:**
- Rodar `backend/sql/financeiro.sql` no Supabase (as travas entram NOT VALID; para checar o histórico: `alter table ... validate constraint <nome>`).
- OS finalizada ainda NÃO gera entrada no Financeiro (`ordem_servico_id` fica vazio). Gerar automático mudaria o faturamento de Relatórios/Visão Geral (regra "tem ≥1 entrada → só entradas") — decisão de produto.
- `saldo` = recebido − saídas pagas por competência (não por data de pagamento).
