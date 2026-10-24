-- ───────────────────────────────────────────────────────────────────────────
-- 0000 — Controle de migrations
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente.
--
-- O que faz
--   • Cria `public.schema_migrations`: uma linha por migration aplicada. É assim
--     que o banco passa a "lembrar" o que já rodou (hoje não há registro, e foi
--     daí que veio a divergência entre o banco e o código).
--   • Registra o estado atual como `baseline`: tudo que está em
--     backend/sql/*.sql do mecânico (estoque, servicos, financeiro, orcamentos,
--     orcamento_link, ordens_*, alertas, visao_geral, seguranca_rls) é
--     considerado JÁ APLICADO. Esses scripts continuam no repositório só como
--     histórico; mudanças novas entram aqui, em db/migrations, em ordem numérica.
--
-- Regras de uso
--   1. Uma migration por vez, em ordem (0000, 0001, 0002, …).
--   2. Cada arquivo é idempotente e se registra no final.
--   3. Antes de rodar, confira a lista: select * from public.schema_migrations;
--
-- Tabela privada (RLS ligada, sem policy): só o backend (service_role) acessa.
-- ───────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.schema_migrations (
  versao      text primary key,
  descricao   text not null default '',
  aplicada_em timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.schema_migrations from %I', r);
    end if;
  end loop;
end $$;

insert into public.schema_migrations (versao, descricao) values
  ('baseline', 'Estado do banco em 2026-10-23: scripts backend/sql/*.sql do mecânico já aplicados'),
  ('0000_controle', 'Cria schema_migrations')
on conflict (versao) do nothing;

commit;
