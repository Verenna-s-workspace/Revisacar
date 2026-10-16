-- ─────────────────────────────────────────────────────────────────────────
-- Alertas — "cliente avisado" no banco
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Pré-requisito: ordens_oficina.sql (a tabela `ordens` com `oficina_doc`).
--
-- O que faz
--   • `ordens` ganha `cliente_avisado`, `cliente_avisado_em` e
--     `cliente_avisado_por_nome`. Até aqui essa marcação ficava só no
--     navegador de quem clicou (localStorage): sumia ao trocar de aparelho e
--     o resto da equipe não via que o cliente já tinha sido avisado.
--   • Nenhuma OS existente muda: todas começam "não avisado".
--
-- O endpoint GET /alertas só LÊ tabelas que os outros scripts já criaram
-- (orcamentos, estoque_reservas, financeiro_transacoes); não precisa de nada
-- além disto. Sem este script, "marcar cliente avisado" responde 503 com a
-- instrução de rodá-lo e o resto do sistema segue funcionando.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.ordens add column if not exists cliente_avisado          boolean not null default false;
alter table public.ordens add column if not exists cliente_avisado_em       timestamptz;
alter table public.ordens add column if not exists cliente_avisado_por_nome text;

grant all on public.ordens to service_role;

notify pgrst, 'reload schema';
