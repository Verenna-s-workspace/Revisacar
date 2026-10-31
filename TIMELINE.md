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
| Orçamento — Fase 0 (status da OS) | 🟡 Backend + SQL + testes + front prontos (tsc + build ok, 296 testes). Falta: rodar `ordens_status.sql` no Supabase e validar no navegador |
| Orçamento — Fase 1 (backend) | 🟡 SQL + API + testes prontos (361 testes). Sem frontend ainda (Fase 2). Falta: rodar `orcamentos.sql` (depois de `ordens_oficina.sql` e `ordens_status.sql`) e validar contra o Supabase real |
| Orçamento — Fase 2 (tela da etapa 3) | 🟡 Frontend pronto (tsc + build ok; smoke no navegador com API simulada: desktop dono/mecânico/atendente, mobile 390px e fluxo entrada→diagnóstico→orçamento). Falta: rodar os SQLs no Supabase e validar contra o backend real |
| Orçamento — Fase 3 (PDF) | 🟡 Backend + front prontos (385 testes; smoke no navegador com API simulada). Falta: `pip install -r requirements.txt` (reportlab, pillow), rodar `orcamentos.sql` de novo (acrescenta 3 colunas) e validar com o Storage real |
| Orçamento — Fase 4 (Financeiro + reserva de estoque) | 🟡 SQL + API + front prontos (403 testes; smoke no navegador com API simulada). Falta: rodar `orcamentos.sql` de novo (precisa de `estoque.sql` e `financeiro.sql` antes) e validar contra o Supabase real |
| Orçamento — Fase 5 (execução e fechamento) | 🟡 SQL + API + front prontos (429 testes; smoke no navegador com API simulada). Falta: rodar `ordens_execucao.sql` (depois de `ordens_status.sql`, `estoque.sql` e `orcamentos.sql`) e validar contra o Supabase real |
| Alertas (tela dedicada) | 🟡 Frontend pronto (tsc + build ok; smoke no navegador com API simulada: lista, filtros, atalhos, vazio, erro, mobile 390px). 4 tipos: OS bloqueada, estoque baixo, cliente a avisar, quarentena. Sem backend novo. Orçamento/financeiro ficam pra depois (ver seção) |
| Alertas — cliente avisado no banco + orçamento/financeiro | 🟡 SQL + API + front prontos (474 testes; smoke no navegador com API simulada: 8 tipos, filtros, atalhos, fallback sem script, migração do navegador, mecânico sem financeiro, mobile). Falta: rodar `alertas.sql` (depois de `ordens_oficina.sql`) e validar contra o Supabase real |
| Alertas — adiar/dispensar | 🟡 SQL + API + front prontos (509 testes; smoke no navegador com API simulada: adiar 1/3/7 dias, dispensar, desfazer, voltar a mostrar, persistência, limpeza quando o problema se resolve, 503, mobile). Falta: rodar `alertas.sql` de novo (acrescenta a tabela `alertas_dispensados`) e validar contra o Supabase real |
| Orçamento — Fase 6A (link público do cliente) | 🟡 SQL + API + front prontos (584 testes; smoke no navegador com API simulada: bloco "Link para o cliente", página pública `/o/<código>` — ver, aprovar, recusar, vencido/aprovado/recusado/substituído, erros 404/410/429/rede, celular 390px — e o grupo de alertas "Clientes que responderam"). Falta: rodar `orcamento_link.sql` (depois de `orcamentos.sql`), garantir que a hospedagem entrega o `index.html` em `/o/*` e validar contra o Supabase real. Conta do cliente (parte B) não iniciada |
| Entrada — fotos obrigatórias | 🟡 SQL + API + front prontos (647 testes; smoke no navegador 390px com API simulada: 5 itens, "3 de 5", refazer, pular com motivo, bloqueio nas duas etapas, reenvio, modo sem script). Falta: rodar `ordens_fotos.sql` (depois de `ordens_oficina.sql`) e validar contra o Supabase/Storage reais |
| Cadastro — etapa 2 (dados da oficina) | 🟡 Front pronto (tsc + build ok; smoke no navegador com API de cadastro simulada: desktop e 390px, validação, gravação em Configurações). Só frontend, grava no `localStorage` como a tela de Configurações. Etapa 3 (boas-vindas) não iniciada |
| Veículos ↔ Clientes (vínculo, fotos, Nova OS) | 🟡 Backend + SQL + testes + front prontos (796 testes; tsc + build ok; smoke no navegador com API simulada, 35 verificações). Falta: rodar `0007_fotos_veiculos.sql` e validar contra o Supabase real |
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

## Orçamento — Fase 0: status da OS (2026-10-12) — branch feat/os-status (parte de feat/financeiro)

**Problema:** salvar o checklist completo marcava a OS como `finalizada` (que conta como faturamento antes do serviço existir) e todo salvamento sobrescrevia o status. "Checklist preenchido" e "serviço concluído" eram a mesma coisa.

**Vocabulário** (`backend/orders/ordem_status.py`, espelho em `frontend/src/utils/ordem_status.ts`): `rascunho`, `em_orcamento`, `pendente_aprovacao`, `aprovada`, `em_execucao`, `aguardando`, `finalizada` (= serviço CONCLUÍDO; nome mantido para não quebrar Relatórios/Visão Geral), `recusada`.

**Transições:** rascunho→{em_orcamento, recusada}; em_orcamento→{rascunho, pendente_aprovacao, aprovada, recusada}; pendente_aprovacao→{em_orcamento, aprovada, recusada}; aprovada→{pendente_aprovacao, em_execucao, recusada}; em_execucao→{aguardando, pendente_aprovacao, finalizada}; aguardando→{em_execucao, rascunho, finalizada}; finalizada→∅; recusada→{em_orcamento}.

**Regras**
- POST/PUT de OS: o front só pode mandar `rascunho`/`em_orcamento` (checklist incompleto/completo) e só enquanto a OS está nessas fases; depois disso o salvamento mantém o status atual. Qualquer outro valor vira `rascunho` (OS nova).
- `PATCH /ordens/<id>/status` (`ordens.editar`): 400 sem status, 422 desconhecido, 404, 409 transição proibida ou OS alterada por outra pessoa (update otimista `.eq("status", atual)`); mesmo status = 200.
- Front: Kanban (fila / em execução / bloqueado / concluído hoje; recusada fora), filtros de Ordens (Em andamento / Aguardando / Concluídas / Recusadas), selos de todos os status; `desbloquear` usa o PATCH (o PUT só com `{status}` sempre dava 422).

**Arquivos:** `backend/orders/ordem_status.py`, `views.py`, `serializers.py`, `backend/sql/ordens_status.sql` (default, NULL→rascunho, CHECK `ordens_status_check` NOT VALID, aviso de linhas fora do vocabulário), `tests/test_ordem_status.py` (~40), ajustes em `tests/test_relatorios.py`; front: `utils/ordem_status.ts`, `useOrdemServico`, `useAtendimento`, `api.definirStatusOrdem`, `Primitives`, `atendimento_utils`, `OSKanbanCard`, `OrdensPage`, `dashboard.css`.

**Pendências**
- Rodar `backend/sql/ordens_status.sql` no Supabase. OS antigas já `finalizada` NÃO são alteradas e seguem contando como concluídas.
- Próxima: Fase 1 (modelos/backend do orçamento) — só quando for pedido.

## Orçamento — Fase 1: modelo e API (2026-10-12) — branch feat/orcamento (parte de feat/os-status)

**Modelo** (`backend/sql/orcamentos.sql`, idempotente): `orcamentos` = uma linha por VERSÃO da OS (`versao` 1, 2…; status `rascunho → enviado → aprovado | recusado | substituido`; validade em dias, total, dados de aprovação/recusa) e `orcamento_itens` (tipo `peca`/`servico`, descrição, marca, quantidade, `preco_unitario` = o que o cliente paga, `custo_unitario` interno, motivo, `estoque_item_id`/`servico_id` SEM FK — o item guarda um retrato e sobrevive se o cadastro for apagado). FK composta `(oficina_doc, ordem_id)` → `ordens` (exige o `unique (oficina_doc, id)` que o script acrescenta em `ordens`); apagar a OS leva os orçamentos. Índices únicos parciais: no máximo 1 rascunho e 1 orçamento ativo (enviado/aprovado) por OS.

**Funções SQL (atômicas, travam OS e orçamento nesta ordem):** `orcamento_criar_versao`, `orcamento_salvar` (troca a lista de itens inteira + recalcula total), `orcamento_enviar`, `orcamento_aprovar`, `orcamento_recusar`. Os status de OS que aceitam cada operação vêm do backend (`ordem_status.origens_para`, `ACEITAM_NOVO_ORCAMENTO`) — a tabela de transições continua só em Python.

**Rotas** (`orders/orcamento_views.py`, JSON camelCase): `GET/POST /ordens/<id>/orcamentos`, `GET/PATCH /orcamentos/<id>`, `POST /orcamentos/<id>/enviar|aprovar|recusar`. Leitura: `ordens.ver`; escrita: `ordens.editar` (atendente só lê). 422 validação / `sem_itens`; 409 estado (`status_invalido`, `os_status`, `rascunho_existente`, `vencido`); 404 outra oficina ou id ruim; 503 sem o script.

**Regras**
- Criar versão copia itens (e custo) e validade da mais recente. Não mexe na OS, exceto OS `recusada` → `em_orcamento` ("refazer"). Aceitam: em_orcamento, pendente_aprovacao, aprovada, em_execucao, recusada. Rascunho (checklist incompleto), aguardando e finalizada → 409.
- Enviar: exige ≥1 item; versões ativas anteriores viram `substituido`; OS → `pendente_aprovacao` (também a partir de aprovada/em_execucao = revisão). Validade = dia do envio no fuso do usuário (`?tz`, padrão America/Sao_Paulo) + `validadeDias` (padrão 7, 1–90).
- Aprovar (mecânico registra a resposta do cliente: `canal` whatsapp|presencial|telefone|app|outro, `observacao`): só `enviado`; **orçamento vencido NÃO aprova** (refazer = nova versão); OS → `aprovada`. Recusar (`motivo` opcional): de `enviado` ou `aprovado`, exceto se a OS já está em execução; OS → `recusada`.
- Editar orçamento aprovado = nova versão; a aprovação antiga segue valendo até a nova ser enviada.
- Custo/margem: `custoUnitario`, `custoTotal`, `margem`, `margemPercentual` só vão pra quem tem `financeiro.ver_margem` (hoje só o dono). Quem edita sem essa permissão não apaga o custo gravado: item com `id` conhecido e sem `custoUnitario` preserva; `null` limpa.
- Totais: por linha `round(qtd × preço, 2)` (meio pra cima), somados — banco e API calculam igual.

**Pendências / decisões**
- Rodar `backend/sql/orcamentos.sql` no Supabase (depois de `ordens_oficina.sql`).
- Fase 4 acrescenta nas funções aprovar/recusar/enviar: lançamento pendente no Financeiro e reserva de estoque (mesma transação). Hoje aprovar NÃO cria entrada no Financeiro nem reserva estoque.
- A validade padrão é fixa em 7 dias por orçamento (configuração da oficina fica pra depois).
- Próxima: Fase 2 (tela da etapa 3) — feita, ver abaixo.

## Orçamento — Fase 2: tela da etapa 3 (2026-10-13) — branch feat/orcamento-front (parte de feat/orcamento)

**Correção estrutural descoberta:** as etapas 1 e 2 não compartilhavam estado (cada uma criava seu `useOrdemServico`) e abrir uma OS existente nunca a carregava. Agora há UMA instância no `App` (`os`), passada para Entrada, Diagnóstico e Orçamento. Efeitos: não cria OS duplicada ao ir da etapa 1 para a 2, abrir OS existente carrega os dados, "nova OS" zera tudo (`novaOrdem()`), e o orçamento enxerga o diagnóstico. `saveOrder()` agora devolve `Promise<boolean>`; o botão "Ir para o orçamento" (último passo do diagnóstico) salva e só navega se salvou. O hook também guarda `ordemStatus`.

**Tela** (`features/Orcamento/`: `OrcamentoPage`, `ItensEditor`, `ItensLeitura`, `VersoesLista`, `DecisaoModais`; `hooks/useOrcamento.ts`, `types/orcamento.ts`, `utils/orcamento_utils.ts`, métodos em `utils/api.ts`): cabeçalho com cliente/veículo/status da OS, versão atual (rascunho editável ou leitura), histórico de versões, resumo com total, validade e observações; modais de enviar/aprovar (canal + observação)/recusar (motivo).

**Regras de pré-preenchimento (sugestões, nada é gravado sem o usuário montar):**
- Peças vêm do diagnóstico (`tabela_pecas` e itens do checklist em atenção/crítico); serviços vêm de sugestões do diagnóstico — **serviços NÃO são preenchidos automaticamente**, só sugeridos.
- Casamento com Estoque/Catálogo é unidirecional: o nome do item de estoque precisa CONTER o digitado (evita "Vela"/"Óleo" genéricos casarem com peças específicas). Sugestão some quando o diagnóstico já citou o item.
- Preço padrão da peça = `preco` do Estoque (Estoque não tem custo separado); do serviço = preço do Catálogo. Sugestões via `datalist`; digitar não desvincula, há botão "desvincular".
- Selo "do diagnóstico" existe só no cliente e some após ir ao servidor (aceito).
- Custo/margem só aparecem para quem tem `financeiro.ver_margem`; quem edita sem a permissão não envia `custoUnitario` (o backend preserva o gravado).
- Atendente só lê (sem botão de montar/editar).

**Limitações / pendências**
- O orçamento ainda não gera lançamento no Financeiro nem reserva estoque (Fase 4); não há PDF (Fase 3).
- Frontend sem runner de testes: utils puros checados por bundle esbuild + node; UI por smoke Playwright com API simulada (fora do repo).
- Rodar `ordens_status.sql` e `orcamentos.sql` no Supabase e validar fim a fim.
- Próxima: Fase 3 (PDF) — feita, ver abaixo.

## Orçamento — Fase 3: PDF (2026-10-13) — branch feat/orcamento-pdf (parte de feat/orcamento-front)

**Gerador** (`orders/orcamento_pdf.py`, reportlab, função pura): cabeçalho (oficina = `admins.nome`, OS, versão, data), status, validade, cliente/veículo (do payload da OS), tabela de itens (descrição, tipo/marca, motivo, qtd, valor un., subtotal), total, observações e bloco de aprovação com a assinatura. **Só o preço cobrado**: quem monta o dict (`_dados_para_pdf`) usa lista branca de campos — custo, margem e vínculos de estoque/catálogo nunca chegam ao gerador (teste confere que o custo não aparece no texto do PDF). Rascunho sai com marca d'água "RASCUNHO".

**Quando é gerado/guardado:** ao ENVIAR (documento enviado ao cliente) e REFEITO ao APROVAR (com aprovação e assinatura). Arquivo em `<ordem_id>/orcamento-vN.pdf` (e `-assinatura.png`) no mesmo bucket das fotos — apagar a OS já apaga junto (teste). Colunas novas em `orcamentos`: `pdf_path`, `pdf_gerado_em`, `assinatura_path` (idempotente em `orcamentos.sql`). Falha no Storage/PDF NÃO desfaz envio nem aprovação: a resposta traz `pdfGerado`/`assinaturaSalva` = false (a tela mostra aviso) e o `GET /pdf` gera na hora e tenta guardar de novo. Rascunho: `GET /pdf` gera pré-visualização sem guardar.

**Rota:** `GET /orcamentos/<id>/pdf` (`ordens.ver`; 404 outra oficina/id ruim; 422 sem itens). `application/pdf`, `Cache-Control: private, no-store`. API de orçamento ganha `pdfDisponivel` e `assinado`.

**Assinatura:** `POST /orcamentos/<id>/aprovar` aceita `assinatura` (data URL PNG do canvas, opcional). Validação: só PNG, ≤400 KB, 20–1600 × 10–800 px; é reencodada (fundo branco, sem metadados); traço em branco = sem assinatura; inválida → 422 e a aprovação NÃO acontece. É a assinatura do CLIENTE, desenhada na tela (sem validade jurídica — fora de escopo).

**Frontend:** `components/AssinaturaPad.tsx` (pointer events, funciona em touch); modal de aprovação ganha o campo de assinatura; botão "Baixar PDF" / "Pré-visualizar PDF" (rascunho salvo) na tela do orçamento; avisos quando o PDF/assinatura não foi guardado.

**Pendências / decisões**
- Instalar dependências novas (`reportlab`, `pillow`; `pypdf` só nos testes) e rodar `orcamentos.sql` de novo.
- O PDF de versão `recusado`/`substituido` fica como foi enviado (reflete o estado do envio/aprovação).
- Não há envio automático do PDF ao cliente (WhatsApp/e-mail) nem link público — Fase 6 (app do cliente) consome pela API.
- Próxima: Fase 4 — feita, ver abaixo.

## Orçamento — Fase 4: Financeiro + reserva de estoque (2026-10-13) — branch feat/orcamento-financeiro (parte de feat/orcamento-pdf)

Tudo em `backend/sql/orcamentos.sql` (idempotente; agora exige `estoque.sql` e `financeiro.sql` rodados antes) e dentro das MESMAS funções/transações de enviar/aprovar/recusar — não existe estado "aprovou mas o lançamento não foi criado".

**Financeiro** (`financeiro_transacoes` ganha `origem` e `orcamento_id`; índice único parcial: 1 lançamento vivo por OS+categoria de orçamento):
- **Aprovar** → até 2 lançamentos de ENTRADA `pendente`, ligados à OS (`ordem_servico_id`): categoria `pecas` e `servicos` (cada um com a soma `round(qtd×preço,2)` dos itens do tipo; categoria com total 0 não gera). Competência = dia da aprovação (fuso do usuário), cliente = da OS, descrição "OS-77 · Peças (orçamento v1)". Total do orçamento = soma dos lançamentos (teste).
- **Revisar** (nova versão de orçamento aprovado) → ao ENVIAR a versão nova, os lançamentos pendentes passam a refletir o novo total (categoria que zerou é cancelada), a OS volta a `pendente_aprovacao`; reaprovar não duplica.
- **Recusar/cancelar** (também da revisão) → lançamentos pendentes viram `cancelado`. **Lançamento já PAGO nunca é alterado**: vira o aviso `lancamento_pago` (ajuste manual no Financeiro). Apagar a OS faz o mesmo cancelamento.
- Editar/excluir o lançamento à mão no Financeiro vale até a próxima sincronização (nova versão enviada sobrescreve o valor dos pendentes).

**Estoque** (`estoque_reservas`, única por OS+item; some com a OS ou com o item): só itens ligados ao Estoque (`estoqueItemId`) reservam. Aprovar/enviar revisão REFAZ as reservas da OS a partir do orçamento. **Reservar além do que há não bloqueia** (a peça pode ser comprada): a resposta traz `efeitos.faltas` (reservado × disponível, descontando reservas de outras OS) e a tela avisa. `GET /estoque` traz `reservado` por item (omitido se 0; funciona sem o script). A BAIXA real do estoque é da Fase 5 (conclusão do serviço) — hoje a reserva não altera `quantidade`.

**API:** respostas de enviar/aprovar/recusar trazem `efeitos` (omitido se nada mudou): `financeiro[{categoria, acao: criado|atualizado|cancelado, valor}]`, `reservas`, `liberadas`, `faltas[{itemId, nome, reservado, disponivel}]`, `avisos[{codigo, categoria}]`. `orcamento_enviar` ganhou o parâmetro `p_nome` (o script remove a assinatura antiga da função).

**Frontend:** caixa de resumo na tela do orçamento depois de cada operação (verde; amarela quando há falta de estoque ou lançamento pago); "N reservado" no card do Estoque e no seletor de peças do orçamento.

**Pendências / decisões**
- Rodar de novo `backend/sql/orcamentos.sql` (e antes `estoque.sql`, `financeiro.sql` se ainda não rodou).
- Os lançamentos entram como PENDENTES por competência na data da aprovação, então Relatórios/Visão Geral já os contam como faturamento (regra atual: entradas não canceladas). Se for melhor contar só o pago, é ajuste nessas telas — não feito.
- A tela do Financeiro ainda não marca visualmente "veio de orçamento" (o campo `origem` já vem na API).
- Próxima: Fase 5 — feita, ver abaixo.

## Orçamento — Fase 5: execução e fechamento (2026-10-14) — branch feat/orcamento-fechamento (parte de feat/orcamento-financeiro)

Novo script `backend/sql/ordens_execucao.sql` (idempotente; exige `ordens_status.sql`, `estoque.sql` e `orcamentos.sql` rodados antes).

**Conclusão atômica** (`ordem_concluir`, via RPC; trava a OS e os itens de estoque): status → `finalizada` e BAIXA do estoque o que a OS reservou (1 movimento de `saida` por item, ligado à OS; reserva liberada). Se reservado > quantidade física, **nada muda** e a API responde 409 `estoque_insuficiente` com `faltas`; com `ignorarFaltas: true` baixa só o que existe (estoque nunca negativo) e informa o que faltou em `baixasFeitas`. Concluir de novo é 409 (não baixa duas vezes). `ordens` ganha `concluida_em`, `concluida_por_nome`, `obs_conclusao`.
- `POST /ordens/<id>/concluir` `{observacao, ignorarFaltas}` (permissão `ordens.editar`).
- `PATCH /ordens/<id>/status` com `finalizada` passa pelo MESMO caminho (não há como finalizar sem baixar o estoque).
- `GET /ordens/<id>/fechamento`: orçamento aprovado, reservas (com `falta`), baixas e, só com `financeiro.ver`, os lançamentos da OS. Custo/margem só com `financeiro.ver_margem`.
- **Concluir NÃO recebe pagamento**: os lançamentos pendentes continuam pendentes até alguém registrar o recebimento no Financeiro.
- **Relatórios e Visão Geral usam os valores reais** do orçamento aprovado (serviços e `valorReal`); nome do serviço agrupado é determinístico.

**Frontend:** tela `Fechamento` (etapa 4, opcional): Iniciar execução (aprovada), Pausar/Retomar (em_execucao/aguardando), Concluir serviço com observação e aviso de estoque insuficiente ("Tentar de novo" / "Concluir mesmo assim"); depois de concluída mostra quem/quando, baixas e lançamentos. Botão "Fechamento" na tela do orçamento; OS em execução/aguardando/finalizada abre direto no fechamento. Atendente só consulta.

**Pendências / decisões**
- Rodar `ordens_execucao.sql` no Supabase (e os anteriores se faltar algum).
- Não há reabrir OS finalizada nem estorno da baixa (ajuste manual no Estoque).
- Itens do orçamento sem vínculo com o Estoque não baixam nada (só os ligados via `estoqueItemId`).
- Fase 6 (cliente aprova pelo link) → ver a seção "Orçamento — Fase 6A" no fim. Conta/app do cliente (parte B) segue pendente.

## Alertas — tela dedicada (2026-10-15) — branch feat/alertas (parte de feat/orcamento-fechamento)

Só frontend; nenhum SQL/endpoint novo. Antes, o sino/bloco da sidebar levavam ao Atendimento (provisório) e o sino do cabeçalho desktop mostrava um "8" fixo.

- **Tela `Alertas`** (`NavPage 'alertas'`, `features/Dashboard/Alertas/AlertasPage.tsx`): alertas agrupados por tipo, com filtro Todos/Urgentes/Atenção, "Atualizar", estado "Tudo em dia" e erro com "Tentar de novo" (falha de API nunca vira "nenhum alerta"). Cada alerta tem um botão de ação (ex.: "Ver no Estoque" já abre o Estoque com a busca no item) e, nos de OS, "Abrir OS". Entrada: sino (desktop e mobile — no mobile agora sempre visível), bloco da sidebar e card "Alertas importantes" do painel (inclusive "Ver todas" e cada linha, que antes não faziam nada).
- **Regra em um lugar só:** `utils/alertas.ts`. `useAlertas` entrega a lista; `useAlertasResumo` virou só uma contagem por cima dela (sidebar, sino e tela nunca divergem). Buscas simultâneas de ordens/estoque são compartilhadas.
- **Tipos atuais (mesmas regras de antes):** OS bloqueada (status `aguardando`, com motivo e há quanto tempo), estoque baixo (ativo, mínimo > 0 e quantidade ≤ mínimo), cliente a avisar (finalizada hoje e não avisada) e item em quarentena. Ordem dos grupos = ordem em `FONTES_ALERTA`.
- **Como incluir um tipo novo (orçamento vencido, lançamento pendente…):** 1) acrescentar o id em `FonteAlertaId`; 2) acrescentar a fonte em `FONTES_ALERTA` (`gerar` devolve `AlertaItem[]` com título, detalhe e `acao`); 3) se precisar de dado novo, pôr o campo em `ContextoAlertas` e buscá-lo em `hooks/useAlertas.ts`. A tela não muda. Candidatos já mapeados: orçamento enviado sem resposta/vencido, peça reservada sem estoque pra concluir, lançamento pendente de OS concluída.

**Pendências / decisões**
- ~~Os alertas de "cliente a avisar" dependem do overlay local~~ → resolvido na seção abaixo (vai pro banco).
- Não há "dispensar/adiar" alerta (o `id` de cada alerta já é estável pra isso).
- A tela de Alertas, como a de Atendimento, não tem o cabeçalho com sino no desktop (só a sidebar).

## Alertas — cliente avisado no banco + alertas de orçamento/financeiro (2026-10-17) — branch feat/alertas-backend

**Passo do usuário:** rodar `backend/sql/alertas.sql` no Supabase SQL Editor (depois de `ordens_oficina.sql`). Sem ele nada quebra: o front mostra um aviso e segue com os 4 alertas locais.

- **Cliente avisado no banco:** `alertas.sql` acrescenta `ordens.cliente_avisado` (bool, default false), `cliente_avisado_em`, `cliente_avisado_por_nome`. `PATCH /ordens/<id>/cliente-avisado` `{avisado: bool}` grava (quem tem `ordens.ver`). Quando a coluna existe, **o banco é a fonte da verdade**; o overlay local (`revisacar:atendimento-overlay`) só vale se o banco não respondeu (script não rodado). Marcações antigas do navegador sobem uma única vez pro banco (sem repetir). "Finalizada hoje" agora usa `concluida_em ?? updated_at` (editar a OS não "refinaliza" mais).
- **`GET /alertas`** (blocos independentes; o que o usuário não pode ver vem omitido e o que depende de script ausente vem em `indisponiveis`): `orcamentosSemResposta` (orçamento `enviado` vencido por `validade_ate` ou há ≥ 2 dias), `aprovadasParadas` (OS `aprovada` há ≥ 1 dia do aceite, execução não iniciada), `reservasSemEstoque` (por item, reservas somadas > quantidade em estoque, lista as OS), `semPagamento` (entrada pendente de OS `finalizada` há ≥ 1 dia; `vencido` se `data_vencimento` < hoje; **só dono/gerente**, exige `financeiro.ver`).
- **Front:** 8 fontes em `FONTES_ALERTA` (4 locais + 4 do backend). Severidade do grupo = a do item mais grave; sem pagamento vira urgente com ≥ 7 dias (`DIAS_PAGAMENTO_URGENTE`) ou vencido. Atalhos: Abrir orçamento, Abrir OS, Ver no Financeiro/Estoque/Atendimento. Falha parcial do `/alertas` mostra aviso e mantém os alertas locais.
- **Testes:** `tests/test_alertas.py` (44), suíte total 474.

**Pendências / decisões**
- Limiares (2 dias orçamento, 1 dia aprovada/pagamento, 7 dias urgência) são constantes — ajustar se a oficina quiser.
- Alerta de pagamento só considera lançamentos com `ordem_servico_id`; lançamentos avulsos não entram.
- O passo 3 (dispensar/adiar) está na seção abaixo. Ideias não pedidas: auto-atualizar, alertas por papel.

## Alertas — adiar e dispensar (2026-10-18) — branch feat/alertas-backend

**Passo do usuário:** rodar `backend/sql/alertas.sql` de novo no Supabase (idempotente; agora também cria `alertas_dispensados`, com RLS ligada e sem policy — só o backend acessa). Sem ele, esconder um alerta responde 503 com essa instrução e o resto da tela segue normal.

- **Por usuário, no banco:** cada um esconde só pra si (o que o gerente dispensa continua aparecendo pro dono). Chave = oficina + usuário (`dono` ou `func:<id>`) + id do alerta (`<fonte>:<id do objeto>`). Vale em qualquer aparelho. Qualquer cargo pode (é preferência do próprio usuário, não precisa de permissão).
- **Dois jeitos:** *Adiar* (1, 3 ou 7 dias; a API aceita 1–30): some até o prazo e volta sozinho. *Dispensar*: some até a causa se resolver — quando o alerta deixa de existir, a tela apaga o registro (`POST /alertas/dispensados/limpar`), então, se o problema voltar, o alerta reaparece.
- **Quando NÃO limpa o dispensado:** se o bloco do banco falhou, se o usuário não tem a permissão do bloco (ex.: mecânico e financeiro) ou se o script daquela origem não rodou — `fontesCompletas` em `utils/alertas.ts`. Evita apagar o que foi dispensado por causa de uma falha momentânea.
- **API:** `GET /alertas` traz `dispensados` (adiados vigentes + dispensados); `PUT /alertas/dispensados/<id>` `{modo:'adiar',dias}` | `{modo:'dispensar'}`; `DELETE` volta a mostrar (204, idempotente); `POST .../limpar {ids}` (até 200; só apaga dispensados). Id validado (`<fonte conhecida>:<id>`). Escrever apaga de passagem os adiados vencidos do usuário.
- **Tela:** cada alerta tem "Adiar ou dispensar" (abre 1 dia / 3 dias / 7 dias / Dispensar / Cancelar). Depois de esconder, aviso com **Desfazer** por 8 s. Seção "Adiados e dispensados · N" no fim, com "Voltar a mostrar" e "Adiado até dd/mm às hh:mm". O número da sidebar, do sino, do painel e dos filtros já desconta o que está escondido (estado único em `useAlertas`). Esconde na hora e desfaz sozinho se o servidor recusar (mostra o erro).
- **Testes:** 35 novos em `tests/test_alertas.py` (509 no total); `fake_supabase` ganhou `upsert`.

**Pendências / decisões**
- Um alerta adiado/dispensado **não volta se piorar** (ex.: estoque baixo que zerou, orçamento que venceu). Dá pra fazer "volta se a severidade subir" depois.
- Adiar é em dias corridos a partir de agora (não "até amanhã 8h").
- Dois alertas com o mesmo título (ex.: "Filtro de óleo" em reserva e em estoque baixo) são independentes — esconder um não esconde o outro.

## Orçamento — Fase 6A: link público do cliente (2026-10-18) — branch feat/alertas-backend

O cliente **não precisa de conta nem de app**: a oficina gera um link, manda (copiar ou WhatsApp) e o cliente abre no celular, vê os valores e aprova ou recusa. Parte B (conta/app do cliente) **não foi iniciada**.

**Passos do usuário**
1. Rodar `backend/sql/orcamento_link.sql` no Supabase SQL Editor, **depois** de `orcamentos.sql` (idempotente; RLS ligada e sem policy — só o backend acessa). Sem ele, o bloco do link na tela do orçamento mostra a instrução (503) e o resto segue normal; o alerta de resposta do cliente fica fora até o script rodar.
2. **Hospedagem:** o painel não tem roteador; a página pública é montada pelo `main.tsx` quando o caminho é `/o/<código>`. O host precisa devolver o `index.html` para `/o/*` (Vercel: rewrite no `vercel.json`; Netlify: `_redirects`). O repo não tem nenhum desses arquivos e a hospedagem não foi verificada. O `sw.js` já cai no `/index.html` em navegações.

**Como funciona**
- **Código do link** = `<id>.<HMAC>` derivado do `id` da tabela `orcamento_links` com a `SECRET_KEY` do servidor. **O código não fica no banco** (vazar o banco não dá link nenhum) e a oficina consegue ver o mesmo link de novo. Código malformado ou com assinatura errada é rejeitado **antes de tocar no banco**, com 404 uniforme (não dá pra distinguir "não existe" de "assinatura errada").
- **Um link ativo por orçamento** (índice único parcial). Só orçamento **enviado** tem link. O link vale 30 dias (`LINK_DIAS`); aprovar só dentro da validade do orçamento. "Gerar link novo" revoga o anterior (o antigo passa a dizer "link substituído", 410); "Desativar" revoga sem criar outro. Orçamento já respondido, vencido ou substituído **continua abrindo, mas só mostra a situação** e não deixa responder de novo.
- **Oficina** (`ordens.ver` pra ver, `ordens.editar` pra gerar/renovar/desativar): `GET|POST|DELETE /orcamentos/<id>/link`. A tela do orçamento (versão enviada e atual) ganha o bloco **Link para o cliente**: copiar, "Enviar por WhatsApp" (mensagem pronta com nome, veículo e link; só monta o número com DDD brasileiro válido — sem telefone válido o WhatsApp abre pra escolher o contato), quantas vezes o cliente abriu e quando, "Gerar link novo", "Desativar link", "Ver se o cliente abriu". Quando o cliente responde, o bloco mostra "O cliente aprovou/recusou pelo link" e **Atualizar o orçamento**. **Nada é enviado automaticamente.**
- **Cliente** (sem login; `GET /publico/orcamentos/<código>`, `/pdf`, `POST .../aprovar`, `.../recusar`): só recebe o preço cobrado (**nunca custo, margem, status interno da OS, ids ou scripts**). Aprovar exige **nome (≥ 2 letras) + caixa "Li e aceito"**; guarda data/hora, **IP**, nome e observação. Recusar aceita motivo opcional. Os dois reaproveitam `orcamento_aprovar`/`orcamento_recusar` (mesmos efeitos de Financeiro, reserva de Estoque e status da OS) com trava extra: pelo link **não dá pra recusar um orçamento já aprovado**. Ordem de trava no banco: OS → orçamento → link (sem deadlock). Aprovado pelo link grava `aprovacao_canal = 'link'` (a oficina vê "Aprovado pelo cliente … pelo link do orçamento").
- **Abuso:** limite por IP (120 req/min; 20 códigos inválidos/10 min; 10 decisões/10 min) e por link (20 decisões/10 min) → 429. IP = último salto do `X-Forwarded-For`. Erros públicos nunca vazam detalhe interno (mensagens amigáveis; 404/410/429/409/422).
- **Página pública** (`features/OrcamentoPublico/OrcamentoPublicoPage.tsx`): uma coluna, botões ≥ 44 px, campos 16 px (sem zoom no iPhone), sem rolagem horizontal em 390 px; **fora** do `AuthProvider`/`App` (não lê a sessão da oficina nem manda `Authorization`); `noindex` e `referrer: no-referrer`; estados aprovado/recusado/vencido/substituído mostram a situação e escondem os botões; 409/410 ao responder recarrega e mostra a situação real; falha de rede/500 mantém o formulário.
- **Alertas:** novo grupo **"Clientes que responderam"** (aprovado = informativo, recusado = atenção, com motivo; some depois de 3 dias — `respostaClienteDias`) e os "Orçamentos sem resposta" passam a dizer "link enviado, ainda não aberto" / "link aberto pelo cliente". Bloco `respostasDoCliente` no `GET /alertas` (permissão `ordens.ver`; script ausente vai em `indisponiveis`).
- **Testes:** `tests/test_orcamento_link.py` (~75: token, rotas da oficina, vazamento na rota pública, decisões, abuso/limites, script ausente, alertas); suíte total **584**. Front: sem runner — checagens de funções puras via esbuild+node e `smoke12.py` no navegador com API simulada (124 verificações) + regressão dos smokes 5–11.

**Pendências / decisões**
- Aprovação pelo link **não tem assinatura desenhada** (o registro é nome + caixa + data/hora + IP); a oficina ainda pode aprovar com assinatura na tela de sempre.
- **Limite de requisições é em memória, por processo**: com vários workers cada um conta o seu (e zera no reinício). Pra rigor total, mover pro banco/Redis.
- A "validade" que o cliente vê usa o dia de hoje em America/Sao_Paulo.
- O painel da oficina **não atualiza sozinho** quando o cliente responde: vale o alerta (ao abrir/atualizar a tela de Alertas) ou "Ver se o cliente abriu".
- Link expirado/revogado não é reativável: gerar um novo.
- Parte B (conta do cliente, histórico de orçamentos no app) não iniciada.

## Auditoria QA (17/10) — itens 1 e 2 do roteiro (2026-10-20) — branch feat/alertas-backend

Base: relatório "Avaliação de Qualidade & Segurança" (só o lado da oficina; o app do cliente ficou de fora). Pendentes do roteiro, nesta ordem: #17 estado de login no banco, #18 isolamento entre oficinas no banco, #21 refresh token em cookie httpOnly, #22 README + testes de front, #23 limpeza.

**#19 — CI roda o pytest.** Novo job `backend-tests` em `.github/workflows/ci.yml` (instala `requirements-dev.txt`, que traz o Postgres descartável dos testes). O lint passou a usar `backend/.flake8`: ele já falhava (292 avisos); corrigidos os reais (imports sem uso, linhas em branco, fim de arquivo) e silenciados os que são estilo/idioma do pytest (`l` como nome de variável, fixtures importadas nos testes, imports no meio de `views.py`/`serializers.py`). **O CI só roda em pull request para `main`** — ele só será exercitado de verdade quando o PR for aberto.

**#20 — configuração de produção** (`DjangoSet/setting.py`):
- `DEBUG` agora é **falso por padrão** (aceita true/1/yes/on). Para desenvolver, `DEBUG=True` no `supabase.env`.
- `ALLOWED_HOSTS` é **obrigatório** em produção e não aceita `*` (o servidor nem inicia). O `RENDER_EXTERNAL_HOSTNAME` que o Render injeta é aceito sozinho. Em desenvolvimento sem a variável vale localhost/127.0.0.1/testserver.
- `SecurityMiddleware` + `XFrameOptionsMiddleware` (nosniff, referrer-policy, COOP, X-Frame-Options DENY). Só em produção: `SECURE_PROXY_SSL_HEADER` (HTTPS do Render), HSTS de 30 dias (`SECURE_HSTS_SECONDS`; subir pra 31536000 depois de confirmar) e `SECURE_SSL_REDIRECT` opcional (desligado: o Render já redireciona).
- **Antes de subir no Render confira as variáveis:** `DEBUG` (pode ficar sem ou `False`), `DJANGO_SECRET_KEY` (se não existir o deploy não sobe), `ALLOWED_HOSTS`. Atenção: sem `DJANGO_SECRET_KEY` o sistema antes usava uma chave de desenvolvimento pública — que também assina os links de orçamento; defina uma chave nova e secreta.
- Testes: `tests/test_settings.py` (9). Suíte total: 593.

## Segurança do banco — RLS em todas as tabelas (2026-10-21) — PR #25

Novo script `backend/sql/seguranca_rls.sql` (idempotente; testado num Postgres descartável). Liga o RLS em toda tabela de `public` **sem policies** e tira de `anon`/`authenticated` o acesso a tabelas, sequências e funções (inclusive as de orçamento/estoque, que por padrão ficam executáveis por todos). O `service_role` (backend das duas apps) ignora RLS: nada muda pra elas. Não usa FORCE (o app do cliente conecta como `postgres`, dono). **Pré-requisito:** o `SUPABASE_KEY` do Render ser a chave `service_role` — senão o sistema para. Ligar o RLS por oficina (policies) fica como etapa futura (item #18 da auditoria).

## Entrada — fotos obrigatórias (2026-10-22) — branch feat/fotos-obrigatorias (parte de main)

**Pedido:** na tela de fotos da entrada, 5 fotos obrigatórias fixas (hodômetro com o painel aceso mostrando os avisos, frente, traseira, lateral direita, lateral esquerda) + fotos adicionais livres; não avançar ao diagnóstico sem as 5 resolvidas; saída "Não consigo tirar esta foto" com motivo curto; registrar quem e quando; comprimir antes de enviar; usável com uma mão em 390px.

**Como era:** `ordens.fotos_paths` (lista de caminhos `<ordem_id>/<uuid>.<ext>` no bucket `test-bucket`) sem nenhuma informação de qual foto é, quem tirou ou quando; as fotos só subiam em lote no `saveOrder()`; só a câmera (`CameraCapture`) comprimia; nenhum bloqueio.

**Passo do usuário:** rodar `backend/sql/ordens_fotos.sql` no SQL Editor do Supabase (idempotente, depois de `ordens_oficina.sql`; RLS ligada e sem policy — só o backend acessa). Sem ele nada quebra: a tela avisa, não exige as 5 e as fotos adicionais seguem como antes.

**Banco** (`ordem_fotos`, uma linha por OS+item): `slot` (CHECK nos 5 ids), `situacao` (`foto`|`pulada`), `path` ou `motivo` (CHECK de coerência: foto exige caminho e proíbe motivo; pulada exige motivo de 3–120 caracteres e proíbe caminho), `por_nome`/`por_tipo`/`por_id`/`em`, `refeitas`. FK composta `(oficina_doc, ordem_id)` → `ordens` com `on delete cascade`. As fotos adicionais continuam em `fotos_paths`.

**Rotas** (`orders/fotos_obrigatorias.py`, JSON camelCase): `GET /ordens/<id>/fotos-obrigatorias` (`ordens.ver`) → `itens`, `total`, `resolvidas`, `completo`, `faltam`; `PUT .../<slot>` (multipart, campo `file`, uma foto por vez) e `POST .../<slot>/pular` `{motivo}` (`ordens.editar` OU `ordens.criar`, como o "cliente avisado": o atendente cria OS). Respondem com o `item` alterado + o resumo, pra tela atualizar o "3 de 5" sem outra chamada.

**Regras**
- Quem e quando vêm do TOKEN e do relógio do servidor, nunca do corpo. Tirar de novo substitui a linha, apaga a foto velha do Storage e soma 1 em `refeitas`; pular um item que tinha foto também a remove. Se o banco recusa depois do upload, o arquivo novo é removido (sem órfão); se falha o upload, nada é gravado (502).
- Arquivos em `<ordem_id>/obrig-<slot>-<uuid>.<ext>`, na pasta da OS: apagar a OS já limpa tudo. Validação por magic bytes (JPEG/PNG/WebP/HEIC), máx 5 MB.
- **Bloqueio no servidor:** `PUT /ordens/<id>` com a OS em `rascunho` só sobe para `em_orcamento` com as 5 resolvidas. Faltando, o salvamento NÃO falha: grava tudo, a OS fica em rascunho e a resposta traz `fotos_obrigatorias_pendentes`. OS que já passou da entrada NÃO é cobrada (decisão do usuário: só rascunho). Só dá pra mexer nos itens enquanto a OS é rascunho/em_orcamento (409 `os_status` depois disso; ler continua valendo).
- Frontend: o bloqueio vale no botão "Encerramento" da tela de fotos, nas abas da entrada e no "Próxima etapa" do encerramento (que também mostra um aviso com atalho "Ir para as fotos").

**Frontend:** `useFotosObrigatorias` (dentro de `useOrdemServico`, estado único), `utils/fotos_obrigatorias.ts` (espelho dos 5 ids/limites do backend — manter igual), `utils/imagem.ts` (compressão), `Steps/Initial/StepPhoto.tsx` reescrito + `FotosObrigatorias/` (`FotoObrigatoriaItem`, `PularFotoSheet`, ícones). Ao chegar nas fotos sem OS, salva o rascunho (um salvamento por vez: `saveOrder` agora reaproveita o que já está em curso, senão dois disparos criariam duas OS). Cada foto sobe na hora; se a internet cair a foto já comprimida fica guardada pra "Tentar enviar de novo". Mantido o `react-webcam` (decisão do usuário: no iOS a câmera nativa devolve a foto sozinha e aqui dá pra tirar em sequência e controlar a qualidade). Compressão: lado maior 1600 px, JPEG 0,75 — vale também pras fotos adicionais. As 5 entram no PDF da OS antes das adicionais, com o nome do item.

**Correções feitas no caminho**
- `api.ts` fixava `Content-Type: application/json` em todo `authFetch`, inclusive em upload `FormData` (o navegador precisa montar o boundary). Agora ignora o fixo quando o corpo é `FormData`.
- O `StepWrapper` usa `will-change: transform`, o que prende elementos `position: fixed` ao tamanho da PÁGINA e não da tela. A câmera e a folha do motivo agora renderizam por portal no `<body>`.

**Validado:** 647 testes (pytest, Postgres real descartável; 54 novos em `tests/test_fotos_obrigatorias.py`; o teste de status ganhou as 5 fotos resolvidas, pois a regra mudou de propósito) e lint limpo; `tsc` + `vite build` limpos; funções puras do front (esbuild + node); smoke no Chromium em 390px com API simulada e câmera falsa (fluxo completo, bloqueio por botão e por aba, refazer, motivo por atalho e texto livre, falha de rede + reenvio, 4 de 5, modo sem script, alvos ≥ 44 px, sem rolagem horizontal, câmera/folha dentro da tela). **NÃO validado:** nada contra o Supabase/Storage reais nem em celular de verdade (câmera do iPhone/Android, permissão, EXIF/rotação reais).

**Pendências / decisões**
- Rodar `ordens_fotos.sql`; testar no celular com o build de produção (`npm run build && npm run preview`).
- A faixa de abas (`StepTabs`) fica mais larga que 390 px com a aba "Encerramento" ativa (já era assim; não mexido).
- Lista de itens fixa no código (sem configuração por oficina, como pedido). Se virar configurável, é tabela nova + o espelho do front sai.
- `GET /fotos/<path>` continua sem login (já anotado) — as 5 fotos usam o mesmo endpoint pra miniatura.
- Foto escolhida da galeria só existe nas adicionais; as 5 obrigatórias são sempre pela câmera (evita foto antiga fora do registro de confiabilidade).
- Itens "pulados" não têm prazo nem alerta pra serem refeitos depois; o motivo fica visível na tela de fotos e no registro, mas ainda não aparece no PDF.

## Cadastro — etapa 2: dados da oficina (2026-10-25, branch `feat/cadastro-etapa-2-dados-oficina`)
O cadastro do dono tem 3 etapas no painel da marca (`authFlows.ts`): 1 Registre sua conta, 2 Cadastre as informações da sua oficina, 3 Seja bem-vindo ao Revisacar. Antes só a 1 existia e `criarAdmin` já autenticava direto. Esta entrega faz a **etapa 2**; a 3 fica pra depois.

**Arquivos:** `pages/auth/OficinaStep.tsx` (novo, formulário), `utils/oficina_config.ts` (novo, validação + gravação), `pages/AuthScreen.tsx`, `pages/AuthPage.tsx`.

**Fluxo:** etapa 1 → `criarAdmin` cria a conta, mas o `AuthScreen` guarda o resultado em vez de chamar `onAuthenticated` → etapa 2 (painel acende o quadrado 2, o 1 vira ✓) → ao continuar, grava os dados e só então chama `onAuthenticated` e cai no dashboard. Campos: nome da oficina, telefone/WhatsApp, endereço, taxa de mão de obra (R$/hora), abre às/fecha às (padrão 08:00–19:00). Todos obrigatórios; fechamento tem que ser depois da abertura (mesma regra de Configurações).

**Onde grava:** no blob `oficina_config` do `localStorage`, o mesmo que a tela de Configurações lê/grava e de onde `horario_funcionamento.ts` lê o horário (a etapa avisa as telas de Agendamento por `notificarHorarioAtualizado`). CNPJ e e-mail vêm da etapa 1, então Configurações já abre com os dados reais e não com os de exemplo (`WORKSHOP_DEFAULTS`).

**Decisões**
- Sem etapa 2 não há sessão: o login só é efetivado ao concluí-la. O seletor Dono/Funcionário some enquanto a etapa 2 está ativa (trocar de lado desmontaria o formulário e perderia a sessão recém-criada).
- Sem botão "voltar": a conta já existe.

**Validado:** `tsc` + `vite build` limpos; smoke no Chromium (API de cadastro simulada, desktop 1440 e mobile 390): conta criada sem sessão, quadrado 2 aceso, 4 erros ao tentar continuar vazio, horário inválido recusado, gravação completa em `oficina_config`, sessão só depois da etapa 2, Configurações exibindo nome/CNPJ/e-mail/telefone/endereço/taxa/horário cadastrados, sem erro de JS e sem rolagem horizontal. **NÃO validado:** contra o backend/Supabase reais.

**Pendências / decisões**
- Os dados ficam só no navegador (como Configurações já fazia): não vão pro banco nem acompanham a conta em outro dispositivo. Levar `oficina_config` pro backend é um passo à parte, e vale pra Configurações inteira.
- Se a pessoa fechar a aba entre as etapas 1 e 2, a conta existe mas sem dados da oficina: ela entra pelo login normal e Configurações abre com os valores de exemplo até ela preencher.
- Etapa 3 (boas-vindas): quando existir, `onConcluir` em `AuthScreen.tsx` passa a avançar pra ela (`onProgress('cadastro', 2)`) em vez de autenticar direto (há um TODO no lugar).

## Cabeçalho com o cargo e fim do "modo demonstração" (2026-10-30, branch `feat/cabecalho-cargo-sem-demo`)
- **Cargo no cabeçalho:** o canto superior direito do painel mostrava "Administrador" para todo mundo. Agora mostra o cargo de quem está logado (Dono, Gerente, Mecânico, Atendente) via `utils/cargo.ts` (`rotuloDoCargo`). Sessões antigas sem `cargo` caem no `tipo` (Dono / Funcionário).
- **Modo demonstração removido.** Em desenvolvimento, qualquer falha de API (backend local fora do ar, `VITE_API_URL` errada) trocava a tela por dados fictícios e mostrava o selo "dados de demonstração". Agora a falha mostra o erro real, em todos os ambientes. Saíram o fallback dos hooks (Estoque, Financeiro, Relatórios, Serviços, Veículos, Clientes, Agendamentos, Atendimento, Alertas), o selo das 7 telas e os geradores de dados falsos (`buildSeed*`, `agregarOrdensLocal`, ~900 linhas); o `useEstoque` também perdeu os caminhos de escrita locais do modo demo.
- **Consequência:** sem backend, as telas mostram erro/vazio em vez de dados de exemplo. Pra desenvolver, suba o backend local (o `API_BASE` cai em `http://127.0.0.1:8000`).
- **Validado:** `tsc` + `vite build` limpos (cópia temporária com os conflitos de merge da `main` resolvidos), "demonstração" ausente do bundle, helper de cargo testado em Node. **NÃO validado:** no navegador contra o backend real.
- **Não mexido:** nos hooks de Veículos/Clientes/Agendamentos/Serviços o ramo de escrita "sem API" (`usingApi` falso) continua; só deixou de ser alcançado por dados fictícios. A barra lateral e o menu mobile ainda rotulam o nome como "Oficina", inclusive para funcionário.
## Acesso da equipe — login de funcionário em qualquer aparelho (2026-10-29, branch `feat/acesso-equipe-link`)
**Problema:** o login de funcionário (nome + PIN) depende do CNPJ da oficina guardado no `localStorage` do aparelho (`revisacarDeviceOficinaDoc`). Funcionário e PIN já ficavam no banco, mas num computador novo ele caía em "Configurar este dispositivo" e tinha que saber o CNPJ de cabeça. E não havia como trocar a oficina pareada: um CNPJ digitado errado prendia o aparelho.

**Entrega**
- **Código da oficina + link `/f/<código>`.** Migração `0006_codigo_acesso_equipe.sql` (`admins.codigo_acesso`, único). Código de 8 caracteres sem 0/O/1/I/L (≈ 8,5e11 combinações), gerado com `secrets`. Em Configurações, o card "Acesso da equipe" (`AcessoEquipeCard.tsx`, só com `funcionarios.gerenciar`, ou seja, o dono) gera o código, copia código/link, manda por WhatsApp, gera um novo (o antigo para de valer) ou desativa o link.
- **Backend** (`orders/acesso_equipe_views.py`): `GET/POST/DELETE /oficina/acesso-equipe` (login + `funcionarios.gerenciar`) e `GET /publico/oficina/<código>` (sem login) → `{oficinaDoc, nome}`. Formato inválido é descartado antes de tocar no banco; código errado e desativado respondem o mesmo 404; limite de 30 consultas/min por IP; `Cache-Control: no-store` e `noindex`. Coluna ausente (0006 não rodada) → 503 com mensagem clara.
- **Frontend:** `/f/<código>` (`features/AcessoEquipe/AcessoEquipePage.tsx`, montada no `main.tsx`) troca o código pela oficina, grava a mesma chave que o login já lia e abre o login no lado do funcionário, já com a lista de nomes. Link inválido/desativado explica e deixa seguir pro login normal.
- **Tela do funcionário:** o pareamento pede o código da oficina (CNPJ continua como alternativa) e o seletor ganhou "Não é a sua oficina? Trocar". No login do dono entrou "É funcionário? Entre com seu PIN".

**Arquivos:** backend `orders/acesso_equipe_views.py`, `orders/urls.py`, `sql/migrations/0006_codigo_acesso_equipe.sql`, `tests/test_acesso_equipe.py` (21 testes), `tests/conftest.py`. Frontend `utils/acesso_equipe_utils.ts`, `utils/api.ts`, `main.tsx`, `App.tsx`, `pages/AuthPage.tsx`, `pages/AuthScreen.tsx`, `pages/FuncionarioLogin/FuncionarioLoginScreen.tsx`, `features/Dashboard/Configuracoes/AcessoEquipeCard.tsx`, `features/Dashboard/ConfiguracoesPage.tsx`.

**Rodar no Supabase antes de usar:** `backend/sql/migrations/0006_codigo_acesso_equipe.sql` (idempotente).

**Validado:** testes do backend (21 novos, Postgres real descartável; suíte inteira 774 passando); `tsc` e `vite build` limpos numa cópia temporária com os conflitos de merge abaixo resolvidos; funções puras do código/link conferidas em Node. **NÃO validado:** fluxo no navegador contra o backend/Supabase reais (link aberto em outro computador, WhatsApp, cópia pro clipboard).

**Decisões e pendências**
- O código dá acesso só ao que o CNPJ já dá (nome da oficina e a lista nome/cargo). O PIN segue protegido pelo bloqueio anti-força-bruta. Desativar o link não desfaz aparelhos já configurados nem o pareamento por CNPJ: o que protege o acesso é o PIN, e `ativo=false` no funcionário.
- Sem QR code por enquanto (exigiria uma dependência nova); copiar link e WhatsApp resolvem. Fácil de somar depois.
- O host precisa devolver o `index.html` para `/f/*`, como já precisa para `/o/*` (ver Fase 6A). O `vite preview` já faz isso.
- **`main` com conflitos de merge commitados** (commit `96dfcf2`): `frontend/index.html` (linhas 17–21) e `frontend/src/components/Topbar.tsx` (linhas 199–234) têm `<<<<<<<`/`>>>>>>>`, então `npm run build` falha na `main` hoje. Não mexido nesta entrega (é escolher entre os dois lados); precisa resolver antes do próximo deploy.
- Falha pré-existente na `main`: `tests/test_estoque_sql.py::test_item_que_esta_numa_receita_nao_pode_ser_apagado`. Não mexido.

## Veículos ↔ Clientes: vínculo, fotos e "Nova OS" (2026-10-31)
**Arquivos:** backend `orders/carteira.py`, `orders/clientes_views.py`, `orders/veiculos_views.py`, `sql/migrations/0007_fotos_veiculos.sql`, `tests/test_carteira.py` (+21), `tests/conftest.py`. Frontend `features/Dashboard/Veiculos/OwnerPicker.tsx` (novo), `VehicleFormModal.tsx`, `ChangeOwnerModal.tsx`, `VeiculosPage.tsx`, `features/Dashboard/Clientes/ClientFormModal.tsx`, `ClientesPage.tsx`, `hooks/useVeiculos.ts`, `hooks/useClientes.ts`, `utils/veiculos_utils.ts`, `utils/clientes_utils.ts`, `pages/InitialChecklist.tsx`, `pages/Dashboard.tsx`, `types/*`.

**Vínculo veículo ↔ cliente.** O backend/banco já tinham (`customer_vehicles.customer_id`, `proprietario.clienteId` conferido contra a carteira); faltava a tela: o formulário só aceitava texto e dizia "em breve". Agora `OwnerPicker` (cadastro/edição do veículo e "Alterar proprietário") escolhe um cliente da carteira (manda `clienteId`) ou cadastra um novo (texto, como antes). Na edição, o dono só é reenviado se mudou. A tela de Clientes passa a cruzar veículos pelo `clienteId` (antes só por nome).

**Fotos.** Estavam sendo ignoradas pelo backend (cliente e veículo) e o formulário mandava o arquivo cru. Agora seguem o estoque: comprime no navegador (cliente 480px; veículo 800px/640px), envia data URL, backend valida (jpeg/png/webp/gif ou https, ≤ 700 mil caracteres) e grava. Cliente em `customers.avatar_url` (sem migration; conta do app continua sendo do próprio cliente → 403 se a oficina tentar trocar); veículo em `foto_data_url` + `fotos_adicionais` (máx. 5), migration 0007. `null` limpa; chave ausente não mexe. **Salvar veículo sem foto não depende da 0007.**

**"Nova OS" a partir do veículo.** `veiculoParaPrefill` + `OSPrefillInput.apenasPreencher`: com proprietário preenche cliente (nome, CPF/CNPJ, telefone, e-mail) e veículo (modelo, placa, ano, cor, combustível, chassi); sem proprietário, só o veículo. Só preenche — a OS é criada quando o mecânico salvar (o "Iniciar Atendimento" continua criando na hora, como antes). Não leva a quilometragem cadastrada (o Km da entrada é o do hodômetro de agora).

**Rodar no Supabase antes de usar fotos de veículo:** `backend/sql/migrations/0007_fotos_veiculos.sql` (idempotente).

**Decisões e pendências**
- Fotos ficam no próprio registro (como o estoque), então `GET /veiculos` e `GET /clientes` devolvem todas. Com a frota crescendo, vale migrar para o Storage (a coluna `foto_principal_path` da 0003 já está reservada para isso).
- `foto_principal_path` não foi reaproveitada: é caminho de Storage lido pelo app do cliente.
- `ProdutoModal.tsx` (Estoque) ainda exibe "A foto fica salva só nesta sessão", o que já não é verdade. Não mexido.
