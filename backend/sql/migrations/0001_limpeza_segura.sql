-- ───────────────────────────────────────────────────────────────────────────
-- 0001 — Limpeza segura
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente.
-- Pré-requisito: 0000_controle.sql.
--
-- Tudo roda dentro de UM ÚNICO bloco DO: ou aplica por inteiro ou nada muda,
-- mesmo em editores que executam cada comando separado (como o do Supabase).
--
-- O que faz (nada aqui apaga dado: toda remoção só acontece se a tabela estiver
-- VAZIA — contagem exata dentro do script — e, se não estiver, a migration
-- inteira é desfeita com uma mensagem dizendo qual tabela e quantas linhas)
--
--   1. Remove as tabelas legadas `clientes`, `kits`, `estoque` (e `estoque_antiga`,
--      se existir). Nenhum código lê nem escreve nelas: o estoque novo é
--      estoque_itens/estoque_kits. As políticas "libera geral", "libera" e
--      "lib" que existiam nelas vão embora junto com as tabelas.
--      Se `estoque` ainda tiver itens, rode antes o
--      backend/sql/estoque_migrar_tabela_antiga.sql.
--   2. Valida as CHECK/FK que foram criadas como NOT VALID
--      (ordens_status_check, orcamentos_aprovacao_canal_check, …). Se alguma
--      linha antiga violar a regra, a validação dessa constraint é pulada com um
--      WARNING dizendo qual (as demais seguem) — aí você corrige a linha e roda
--      de novo.
--   3. Remove `customers.pin_hash`, coluna que nenhum código usa (só se estiver
--      toda nula).
--   4. Torna `ordens.oficina_doc` obrigatório (é a chave do multi-tenant), se não
--      houver OS sem oficina. Se houver, avisa quantas e não mexe.
--   5. Lista no final, como WARNING, as políticas RLS que sobraram no schema
--      public, para você conferir. A política `er` da tabela `admins` NÃO é
--      removida aqui de propósito: antes veja o que ela libera (consulta no fim
--      do arquivo).
--
-- O que NÃO faz (fica para a 0004, depois que o código novo estiver no ar):
--   tabelas estimates/estimate_items/service_history*, tabelas do Django
--   (django_content_type e auth_*) e os NOT NULL que dependem do app do cliente.
-- ───────────────────────────────────────────────────────────────────────────

do $mig$
declare
  t         text;
  n         bigint;
  c         record;
  p         record;
  pendencias text[] := '{}';
begin
  -- ── 1) Tabelas legadas: só removo se estiverem VAZIAS ─────────────────
  foreach t in array array['clientes', 'kits', 'estoque', 'estoque_antiga'] loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'public.% não existe — nada a fazer.', t;
    else
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        raise exception 'public.% tem % linha(s): não vou apagar. Migre ou apague esses dados à mão e rode de novo.', t, n;
      end if;
      execute format('drop table public.%I', t);
      raise notice 'public.% removida (estava vazia).', t;
    end if;
  end loop;

  -- ── 2) Constraints NOT VALID ──────────────────────────────────────────
  for c in
    select conrelid::regclass as tabela, conname
      from pg_constraint
     where connamespace = 'public'::regnamespace and not convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tabela, c.conname);
      raise notice 'Constraint % em % validada.', c.conname, c.tabela;
    exception when check_violation or foreign_key_violation then
      raise warning 'Constraint % em % NÃO validou: há linhas antigas que violam a regra. Corrija-as e rode de novo.', c.conname, c.tabela;
      pendencias := pendencias || format('constraint %s em %s não validada', c.conname, c.tabela);
    end;
  end loop;

  -- ── 3) customers.pin_hash (sem uso) ───────────────────────────────────
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'customers' and column_name = 'pin_hash') then
    execute 'select count(*) from public.customers where pin_hash is not null' into n;
    if n = 0 then
      alter table public.customers drop column pin_hash;
      raise notice 'customers.pin_hash removida (nenhum código usa e estava vazia).';
    else
      raise warning 'customers.pin_hash tem % valor(es): não removi.', n;
      pendencias := pendencias || 'customers.pin_hash com valores';
    end if;
  end if;

  -- ── 4) ordens.oficina_doc obrigatório ─────────────────────────────────
  select count(*) into n from public.ordens where oficina_doc is null;
  if n = 0 then
    alter table public.ordens alter column oficina_doc set not null;
    raise notice 'ordens.oficina_doc agora é NOT NULL.';
  else
    raise warning '% OS sem oficina_doc: preencha (veja o fim de ordens_oficina.sql) e rode de novo. Não alterei a coluna.', n;
    pendencias := pendencias || format('%s OS sem oficina_doc', n);
  end if;

  -- ── 5) Políticas RLS que sobraram ─────────────────────────────────────
  for p in select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2 loop
    raise warning 'Política restante: %.% — confira o que ela libera (consulta no fim do arquivo).', p.tablename, p.policyname;
  end loop;

  -- ── Só registra se nada foi pulado ────────────────────────────────────
  if coalesce(array_length(pendencias, 1), 0) = 0 then
    insert into public.schema_migrations (versao, descricao) values
      ('0001_limpeza_segura', 'Remove legados vazios (clientes/kits/estoque), valida NOT VALID, ordens.oficina_doc NOT NULL')
    on conflict (versao) do nothing;
    raise notice '0001 concluída e registrada.';
  else
    raise warning '0001 aplicada PARCIALMENTE (% pendência/s) — NÃO registrada. Resolva e rode de novo; a 0002 só deve rodar depois.', array_length(pendencias, 1);
  end if;
end
$mig$;

-- ── Consulta para decidir sobre a política `er` de admins ────────────────
-- Rode DEPOIS e me mande o resultado:
--
--   select tablename, policyname, roles, cmd, qual, with_check
--     from pg_policies where schemaname = 'public';
--   select has_table_privilege('anon', 'public.admins', 'select') as anon_le_admins,
--          has_table_privilege('authenticated', 'public.admins', 'select') as auth_le_admins;
--
-- Se alguma das duas respostas for `true` e a política liberar leitura, a
-- tabela admins (com pwhash) está acessível pela chave pública: nesse caso,
-- rode seguranca_rls.sql e depois: drop policy "er" on public.admins;
