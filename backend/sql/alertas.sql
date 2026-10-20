-- ─────────────────────────────────────────────────────────────────────────
-- Alertas — "cliente avisado" no banco + alertas adiados/dispensados por usuário
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
--   • Tabela `alertas_dispensados`: o que CADA usuário adiou ou dispensou na tela
--     de Alertas. É por usuário (o que o gerente dispensa continua aparecendo pro
--     dono). `usuario_chave` = 'dono' ou 'func:<id do funcionário>'.
--       - `ate` preenchido = ADIADO: o alerta some até esse momento e volta.
--       - `ate` nulo      = DISPENSADO: some até a causa se resolver; quando o
--         alerta deixa de existir a tela apaga a linha, e se ele reaparecer depois
--         volta a ser mostrado.
--     `alerta_id` é o id estável do alerta na tela (ex.: 'estoque_baixo:<item>').
--     A tabela é privada (RLS ligada, sem policy): só o backend (service_role) acessa.
--
-- O endpoint GET /alertas só LÊ tabelas que os outros scripts já criaram
-- (orcamentos, estoque_reservas, financeiro_transacoes); não precisa de nada
-- além disto. Sem este script, "marcar cliente avisado" e "adiar/dispensar"
-- respondem 503 com a instrução de rodá-lo e o resto do sistema segue funcionando.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.ordens add column if not exists cliente_avisado          boolean not null default false;
alter table public.ordens add column if not exists cliente_avisado_em       timestamptz;
alter table public.ordens add column if not exists cliente_avisado_por_nome text;

create table if not exists public.alertas_dispensados (
  oficina_doc   text        not null,
  usuario_chave text        not null,
  alerta_id     text        not null,
  ate           timestamptz,
  criado_em     timestamptz not null default now(),
  primary key (oficina_doc, usuario_chave, alerta_id)
);

alter table public.alertas_dispensados enable row level security;

grant all on public.ordens to service_role;
grant all on public.alertas_dispensados to service_role;

notify pgrst, 'reload schema';
