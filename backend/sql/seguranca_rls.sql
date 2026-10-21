-- ─────────────────────────────────────────────────────────────────────────
-- Segurança do banco — liga o RLS em TODAS as tabelas do schema public e fecha
-- o acesso direto pela API REST do Supabase (chaves anon/authenticated).
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente.
--
-- ⚠️ ANTES DE RODAR: confirme que o SUPABASE_KEY do backend (Render) é a chave
-- *service_role* (JWT com "role":"service_role" ou a "secret key" sb_secret_…).
-- Se for a anon/publishable, o sistema PARA de funcionar depois deste script
-- (e, antes dele, qualquer pessoa com a chave anon já lê e escreve em tudo).
-- Troque a chave no Render primeiro.
--
-- O que faz
--   • `enable row level security` em toda tabela de `public`, SEM policies: a
--     chave anon e a authenticated ficam sem acesso a linha nenhuma. O
--     service_role (backend das duas apps) ignora RLS, então nada muda pra elas.
--   • Tira dos papéis anon/authenticated os privilégios de tabela, sequência e
--     FUNÇÃO (as funções de orçamento/estoque ficam chamáveis só pelo backend).
--   • Ajusta os privilégios padrão pra que tabelas/funções criadas no futuro
--     (por scripts novos) já nasçam fechadas.
--   • NÃO usa FORCE: o dono (postgres) continua passando por cima do RLS — é o
--     que o app do cliente (Django, DATABASE_URL como postgres) usa hoje.
--   • Não mexe nos schemas do Supabase (auth, storage…): o bucket de fotos e PDFs
--     tem suas próprias regras.
--
-- Para desfazer uma tabela: alter table public.<tabela> disable row level security;
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables    in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables    from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;

-- Funções nascem com EXECUTE liberado pra PUBLIC (todo mundo): fecha isso também.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges revoke execute on functions from public;   -- o EXECUTE-pra-todos implícito só sai nesta forma (sem 'in schema')

-- O backend continua com tudo (service_role já tem grants explícitos nos outros scripts;
-- aqui só garante pras tabelas/funções que algum script antigo esqueceu).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables    in schema public to service_role;
    grant all on all sequences in schema public to service_role;
    grant execute on all functions in schema public to service_role;
    alter default privileges in schema public grant all on tables    to service_role;
    alter default privileges in schema public grant all on sequences to service_role;
    alter default privileges in schema public grant execute on functions to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Conferência (rode depois): deve voltar 0 linhas.
--   select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
