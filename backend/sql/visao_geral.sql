-- ─────────────────────────────────────────────────────────────────────────
-- Visão Geral: meta mensal por oficina
--
-- Rode este script no SQL Editor do Supabase. É idempotente.
--
-- A meta mensal do card da Visão Geral era fixa (R$ 20.000) no código.
-- Agora cada oficina guarda a sua em `admins.meta_mensal` (null = ainda não
-- definida). Pré-requisito: public.admins.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.admins
  add column if not exists meta_mensal numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admins_meta_mensal_check') then
    alter table public.admins
      add constraint admins_meta_mensal_check check (meta_mensal is null or meta_mensal >= 0);
  end if;
end $$;

grant all on public.admins to service_role;

notify pgrst, 'reload schema';
