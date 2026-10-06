-- ─────────────────────────────────────────────────────────────────────────
-- Catálogo de Serviços
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Pré-requisitos: public.admins (coluna doc UNIQUE) e, pra limpar o vínculo
-- Kit ↔ Serviço ao excluir, public.estoque_kits (rode estoque.sql antes).
--
-- Isolamento por oficina (multi-tenant): a tabela carrega `oficina_doc` e o
-- backend filtra por ela em toda consulta.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.servicos (
  id           uuid primary key default gen_random_uuid(),
  oficina_doc  text not null references public.admins(doc),
  nome         text not null check (btrim(nome) <> ''),
  categoria    text not null check (btrim(categoria) <> ''),   -- texto livre, sem taxonomia fixa
  preco        numeric(12,2) not null default 0 check (preco >= 0),
  duracao      text not null default '',                       -- texto livre ("45 min", "1h 30min")
  descricao    text not null default '',
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  -- Fica null até a primeira edição (o frontend trata updatedAt como opcional).
  updated_at   timestamptz,

  -- Pra futuras chaves estrangeiras compostas (ex.: ordem de serviço → serviço).
  constraint servicos_oficina_id_uk unique (oficina_doc, id)
);

create index if not exists servicos_oficina_idx
  on public.servicos (oficina_doc, created_at desc);

create or replace function public.servicos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists servicos_updated_at on public.servicos;
create trigger servicos_updated_at
  before update on public.servicos
  for each row execute function public.servicos_set_updated_at();


-- ── Função: excluir serviço ──────────────────────────────────────────────
-- O vínculo do kit com o serviço (estoque_kits.servico_id) é texto sem chave
-- estrangeira. Pra não deixar kit apontando pra serviço que não existe mais,
-- limpa o vínculo e apaga o serviço na mesma transação.
-- Retorna jsonb: {ok, codigo, mensagem, kits_desvinculados}.

create or replace function public.servicos_excluir(
  p_oficina_doc text,
  p_servico_id  uuid
) returns jsonb
language plpgsql
as $$
declare
  v_desvinculados int := 0;
begin
  perform 1 from public.servicos
   where id = p_servico_id and oficina_doc = p_oficina_doc
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Serviço não encontrado.');
  end if;

  if to_regclass('public.estoque_kits') is not null then
    update public.estoque_kits
       set servico_id = null
     where oficina_doc = p_oficina_doc and servico_id = p_servico_id::text;
    get diagnostics v_desvinculados = row_count;
  end if;

  delete from public.servicos where id = p_servico_id and oficina_doc = p_oficina_doc;

  return jsonb_build_object('ok', true, 'kits_desvinculados', v_desvinculados);
end;
$$;


-- O backend usa a chave service_role. Projetos novos do Supabase podem não
-- liberar tabelas criadas pelo SQL Editor sem GRANT explícito.
grant all on public.servicos to service_role;
grant execute on function public.servicos_excluir(text, uuid) to service_role;

-- Pede pro PostgREST recarregar o cache de tabelas e funções.
notify pgrst, 'reload schema';
