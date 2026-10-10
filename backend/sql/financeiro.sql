-- ─────────────────────────────────────────────────────────────────────────
-- Financeiro (lançamentos de entrada e saída por oficina)
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Por quê: a tabela `financeiro_transacoes` existia só "de fato" no banco de
-- quem a criou na mão — o repositório não tinha o script, então ninguém sabia
-- o formato certo, nem tinha índice nem trava de integridade. Este script:
--   • cria a tabela se ela não existir;
--   • se já existir, só acrescenta o que faltar (colunas, travas, índices) —
--     nunca apaga nem altera dado;
--   • trava (CHECK) tipo, status e valor, e liga `oficina_doc` à oficina.
--
-- As travas entram como NOT VALID: valem para tudo que for gravado de agora
-- em diante, mas não revalidam as linhas antigas (assim o script não falha se
-- houver alguma linha fora do padrão). Para conferir o histórico depois:
--   alter table public.financeiro_transacoes validate constraint <nome>;
--
-- Pré-requisito: public.admins (coluna doc UNIQUE).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.financeiro_transacoes (
  id               uuid primary key default gen_random_uuid(),
  oficina_doc      text not null,
  tipo             text not null,
  categoria        text not null,
  descricao        text not null default '',
  valor            numeric(12,2) not null,
  forma_pagamento  text,
  status           text not null default 'pendente',
  data_competencia date not null,
  data_vencimento  date,
  data_pagamento   timestamptz,
  cliente_nome     text not null default '',
  ordem_servico_id text,
  criado_por_nome  text default '',
  criado_por_tipo  text default '',
  created_at       timestamptz not null default now()
);

-- Tabela que já existia: garante as colunas que o backend usa.
alter table public.financeiro_transacoes
  add column if not exists oficina_doc text,
  add column if not exists forma_pagamento text,
  add column if not exists data_vencimento date,
  add column if not exists data_pagamento timestamptz,
  add column if not exists cliente_nome text default '',
  add column if not exists ordem_servico_id text,
  add column if not exists criado_por_nome text default '',
  add column if not exists criado_por_tipo text default '',
  add column if not exists created_at timestamptz default now();

-- ── travas de integridade ───────────────────────────────────────────────
do $$
declare
  tabela constant regclass := 'public.financeiro_transacoes'::regclass;
begin
  if not exists (select 1 from pg_constraint where conrelid = tabela and conname = 'financeiro_tipo_check') then
    alter table public.financeiro_transacoes
      add constraint financeiro_tipo_check check (tipo in ('entrada', 'saida')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = tabela and conname = 'financeiro_status_check') then
    alter table public.financeiro_transacoes
      add constraint financeiro_status_check check (status in ('pendente', 'pago', 'cancelado')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = tabela and conname = 'financeiro_valor_check') then
    alter table public.financeiro_transacoes
      add constraint financeiro_valor_check check (valor > 0) not valid;
  end if;

  -- Cada lançamento pertence a uma oficina que existe (multi-tenant).
  if not exists (select 1 from pg_constraint where conrelid = tabela and conname = 'financeiro_oficina_fk') then
    alter table public.financeiro_transacoes
      add constraint financeiro_oficina_fk foreign key (oficina_doc) references public.admins(doc) not valid;
  end if;
end $$;

-- ── índices ─────────────────────────────────────────────────────────────
-- Listagem, resumo, Relatórios e Visão Geral filtram por oficina + competência.
create index if not exists financeiro_oficina_competencia_idx
  on public.financeiro_transacoes (oficina_doc, data_competencia);

-- "Contas a pagar/receber" olha só os pendentes, sem limite de período.
create index if not exists financeiro_pendentes_idx
  on public.financeiro_transacoes (oficina_doc, data_vencimento)
  where status = 'pendente';

grant all on public.financeiro_transacoes to service_role;

notify pgrst, 'reload schema';
