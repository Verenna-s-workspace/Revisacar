-- ─────────────────────────────────────────────────────────────────────────
-- Estoque: itens, kits (receitas) e movimentações
--
-- Rode este script inteiro no SQL Editor do Supabase (o projeto não usa
-- migrations automatizadas). É idempotente: pode rodar de novo sem quebrar
-- nada nem apagar dado (create ... if not exists / create or replace).
--
-- Pré-requisito: public.admins (coluna doc UNIQUE) — já existe.
--
-- Isolamento por oficina (multi-tenant): toda tabela carrega `oficina_doc`
-- e as chaves estrangeiras entre tabelas são COMPOSTAS (oficina_doc, id).
-- Ou seja, mesmo que um bug no backend tentasse ligar um kit de uma oficina
-- a uma peça de outra, o próprio banco recusa.
--
-- Operações que mexem em mais de uma tabela e precisam ser tudo-ou-nada
-- (aplicar kit, ajustar quantidade, salvar kit) são funções Postgres
-- chamadas pelo Django via supabase.rpc(): o supabase-py não tem transação
-- entre chamadas separadas, e baixa de estoque sem trava de linha deixaria
-- duas pessoas aplicando o mesmo kit ao mesmo tempo zerarem a peça duas vezes.
-- ─────────────────────────────────────────────────────────────────────────


-- ── Itens ────────────────────────────────────────────────────────────────

create table if not exists public.estoque_itens (
  id                      uuid primary key default gen_random_uuid(),
  oficina_doc             text not null references public.admins(doc),
  nome                    text not null,
  categoria               text not null,
  quantidade              numeric(12,3) not null default 0 check (quantidade >= 0),
  minimo                  numeric(12,3) not null default 0 check (minimo >= 0),
  preco                   numeric(12,2) not null default 0 check (preco >= 0),
  localizacao             text not null default '',
  descricao               text,
  aplicacao               text,
  -- Foto comprimida no navegador (~480px) guardada como data URL. Simples e
  -- suficiente pro volume de uma oficina; se a lista de itens ficar pesada,
  -- migrar pra Supabase Storage e guardar só o caminho aqui.
  foto_data_url           text,
  status                  text not null default 'ativo' check (status in ('ativo', 'quarentena')),
  quarentena_motivo       text,
  quarentena_fornecedor   text,
  quarentena_data_entrada timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz,

  -- Necessário pras chaves estrangeiras compostas das outras tabelas.
  constraint estoque_itens_oficina_id_uk unique (oficina_doc, id),

  -- Item em quarentena precisa de motivo e fornecedor (mesma regra do modal);
  -- item ativo não pode carregar dados de quarentena de um estado anterior.
  constraint estoque_itens_quarentena_ck check (
    (status = 'quarentena'
       and coalesce(btrim(quarentena_motivo), '') <> ''
       and coalesce(btrim(quarentena_fornecedor), '') <> '')
    or
    (status = 'ativo'
       and quarentena_motivo is null
       and quarentena_fornecedor is null
       and quarentena_data_entrada is null)
  )
);

create index if not exists estoque_itens_oficina_idx
  on public.estoque_itens (oficina_doc, created_at desc);


-- ── Kits (receitas) ──────────────────────────────────────────────────────

create table if not exists public.estoque_kits (
  id            uuid primary key default gen_random_uuid(),
  oficina_doc   text not null references public.admins(doc),
  nome          text not null,
  descricao     text,
  -- Vínculo com um serviço do Catálogo. Sem FK de propósito: o Catálogo
  -- ainda não tem tabela. Quando tiver, adicionar a FK composta aqui.
  servico_id    text,
  foto_data_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,

  constraint estoque_kits_oficina_id_uk unique (oficina_doc, id)
);

create index if not exists estoque_kits_oficina_idx
  on public.estoque_kits (oficina_doc, created_at desc);

-- Componentes de cada kit. Kit não tem quantidade própria: é só a receita.
create table if not exists public.estoque_kit_itens (
  kit_id      uuid not null,
  item_id     uuid not null,
  oficina_doc text not null,
  quantidade  numeric(12,3) not null check (quantidade > 0),
  posicao     integer not null default 0,   -- preserva a ordem em que a receita foi montada

  primary key (kit_id, item_id),
  -- Apagar o kit leva a receita junto; apagar um ITEM que está numa receita
  -- é recusado (o backend avisa em qual kit ele está, antes de chegar aqui).
  foreign key (oficina_doc, kit_id)  references public.estoque_kits  (oficina_doc, id) on delete cascade,
  foreign key (oficina_doc, item_id) references public.estoque_itens (oficina_doc, id) on delete restrict
);

create index if not exists estoque_kit_itens_item_idx
  on public.estoque_kit_itens (item_id);


-- ── Movimentações (log) ──────────────────────────────────────────────────
-- tipo: 'entrada' (cadastro inicial), 'saida' (uso/kit), 'ajuste' (correção
-- manual de quantidade). `quantidade` é sempre positiva; o sinal é o tipo.
-- Apagar um item leva o histórico dele junto: o relatório de itens mais
-- movimentados já ignora movimento de item que não existe mais.

create table if not exists public.estoque_movimentos (
  id               uuid primary key default gen_random_uuid(),
  oficina_doc      text not null,
  item_id          uuid not null,
  tipo             text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade       numeric(12,3) not null check (quantidade > 0),
  motivo           text not null default '',
  -- Reservado (peça sob encomenda ligada a uma OS). ordens.id é text e a
  -- tabela ordens ainda não tem oficina_doc, então sem FK por enquanto.
  ordem_servico_id text,
  criado_em        timestamptz not null default now(),

  foreign key (oficina_doc, item_id) references public.estoque_itens (oficina_doc, id) on delete cascade
);

create index if not exists estoque_movimentos_oficina_idx
  on public.estoque_movimentos (oficina_doc, criado_em desc);
create index if not exists estoque_movimentos_item_idx
  on public.estoque_movimentos (item_id);


-- ── updated_at automático ────────────────────────────────────────────────
-- Fica null até a primeira edição (o frontend trata updatedAt como opcional).

create or replace function public.estoque_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists estoque_itens_updated_at on public.estoque_itens;
create trigger estoque_itens_updated_at
  before update on public.estoque_itens
  for each row execute function public.estoque_set_updated_at();

drop trigger if exists estoque_kits_updated_at on public.estoque_kits;
create trigger estoque_kits_updated_at
  before update on public.estoque_kits
  for each row execute function public.estoque_set_updated_at();


-- ── Função: ajustar quantidade manualmente ───────────────────────────────
-- Trava a linha, grava a nova quantidade e o log 'ajuste' na mesma transação.
-- Não-op (sem log) se a quantidade não mudou.

create or replace function public.estoque_ajustar_quantidade(
  p_oficina_doc     text,
  p_item_id         uuid,
  p_nova_quantidade numeric
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item   public.estoque_itens%rowtype;
  v_antes  numeric;
  v_novo   jsonb;
  v_mov    jsonb;
begin
  if p_nova_quantidade is null or p_nova_quantidade < 0 then
    return jsonb_build_object('ok', false, 'codigo', 'quantidade_invalida',
                              'mensagem', 'A quantidade não pode ser negativa.');
  end if;

  select * into v_item
    from public.estoque_itens
   where id = p_item_id and oficina_doc = p_oficina_doc
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado',
                              'mensagem', 'Item não encontrado.');
  end if;

  v_antes := v_item.quantidade;

  if v_antes = p_nova_quantidade then
    return jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'movimento', null);
  end if;

  update public.estoque_itens
     set quantidade = p_nova_quantidade
   where id = p_item_id
  returning to_jsonb(estoque_itens.*) into v_novo;

  insert into public.estoque_movimentos (oficina_doc, item_id, tipo, quantidade, motivo)
  values (
    p_oficina_doc, p_item_id, 'ajuste', abs(p_nova_quantidade - v_antes),
    format('Ajuste manual: %s → %s', trim_scale(v_antes), trim_scale(p_nova_quantidade))
  )
  returning to_jsonb(estoque_movimentos.*) into v_mov;

  return jsonb_build_object('ok', true, 'item', v_novo, 'movimento', v_mov);
end;
$$;


-- ── Função: aplicar kit (baixa automática) ───────────────────────────────
-- Tudo-ou-nada: valida TODOS os componentes (existe, não está em quarentena,
-- tem quantidade) antes de baixar qualquer um, e só então baixa e grava o
-- log de saída de cada componente. As linhas dos itens são travadas antes da
-- validação, na mesma ordem sempre (por id), então duas aplicações
-- simultâneas ou esperam uma pela outra, nunca baixam a mesma peça duas
-- vezes nem deixam estoque negativo, e não travam uma à outra.
-- Rejeição de regra de negócio volta como {ok:false, mensagem} (sem erro HTTP).

create or replace function public.estoque_aplicar_kit(
  p_oficina_doc text,
  p_kit_id      uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_kit    public.estoque_kits%rowtype;
  v_rec    record;
  v_item   public.estoque_itens%rowtype;
  v_itens  jsonb := '[]'::jsonb;
  v_movs   jsonb := '[]'::jsonb;
  v_linha  jsonb;
begin
  select * into v_kit
    from public.estoque_kits
   where id = p_kit_id and oficina_doc = p_oficina_doc
     for share;                         -- impede apagar o kit no meio da baixa

  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Kit não encontrado.');
  end if;

  if not exists (select 1 from public.estoque_kit_itens where kit_id = p_kit_id) then
    return jsonb_build_object('ok', false, 'codigo', 'kit_vazio',
                              'mensagem', 'Este kit não tem componentes cadastrados.');
  end if;

  -- 1) trava todos os itens da receita, sempre na mesma ordem
  perform 1
     from public.estoque_itens i
    where i.oficina_doc = p_oficina_doc
      and i.id in (select ki.item_id from public.estoque_kit_itens ki where ki.kit_id = p_kit_id)
    order by i.id
      for update;

  -- 2) valida tudo, na ordem da receita (a primeira falha é a mensagem)
  for v_rec in
    select ki.item_id, ki.quantidade
      from public.estoque_kit_itens ki
     where ki.kit_id = p_kit_id
     order by ki.posicao, ki.item_id
  loop
    select * into v_item
      from public.estoque_itens
     where id = v_rec.item_id and oficina_doc = p_oficina_doc;

    if not found then
      return jsonb_build_object('ok', false, 'codigo', 'item_inexistente',
                                'mensagem', 'Um dos componentes do kit não existe mais no estoque.');
    end if;

    if v_item.status = 'quarentena' then
      return jsonb_build_object('ok', false, 'codigo', 'quarentena',
                                'mensagem', format('%s está em quarentena e não pode ser usado.', v_item.nome));
    end if;

    if v_item.quantidade < v_rec.quantidade then
      return jsonb_build_object('ok', false, 'codigo', 'estoque_insuficiente',
                                'mensagem', format('Estoque insuficiente de %s (precisa de %s, disponível %s).',
                                                   v_item.nome, trim_scale(v_rec.quantidade), trim_scale(v_item.quantidade)));
    end if;
  end loop;

  -- 3) baixa + log
  for v_rec in
    select ki.item_id, ki.quantidade
      from public.estoque_kit_itens ki
     where ki.kit_id = p_kit_id
     order by ki.posicao, ki.item_id
  loop
    update public.estoque_itens
       set quantidade = quantidade - v_rec.quantidade
     where id = v_rec.item_id
    returning to_jsonb(estoque_itens.*) into v_linha;
    v_itens := v_itens || jsonb_build_array(v_linha);

    insert into public.estoque_movimentos (oficina_doc, item_id, tipo, quantidade, motivo)
    values (p_oficina_doc, v_rec.item_id, 'saida', v_rec.quantidade, 'Kit: ' || v_kit.nome)
    returning to_jsonb(estoque_movimentos.*) into v_linha;
    v_movs := v_movs || jsonb_build_array(v_linha);
  end loop;

  return jsonb_build_object('ok', true, 'itens', v_itens, 'movimentos', v_movs);
end;
$$;


-- ── Função: salvar kit (criar ou editar, com a receita inteira) ──────────
-- p_kit_id nulo = cria. Senão, edita e SUBSTITUI a receita. Tudo numa
-- transação: se algo falhar, a receita antiga continua intacta (apagar e
-- reinserir em chamadas separadas poderia deixar o kit sem componentes).
-- p_itens: [{"item_id": "<uuid>", "quantidade": 2}, ...] na ordem desejada.

create or replace function public.estoque_salvar_kit(
  p_oficina_doc   text,
  p_kit_id        uuid,
  p_nome          text,
  p_descricao     text,
  p_servico_id    text,
  p_foto_data_url text,
  p_itens         jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_kit_id uuid;
  v_kit    jsonb;
  v_rec    jsonb;
  v_pos    integer := 0;
  v_itens  jsonb;
begin
  if coalesce(btrim(p_nome), '') = '' then
    return jsonb_build_object('ok', false, 'codigo', 'nome_obrigatorio', 'mensagem', 'Informe o nome do kit.');
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'kit_vazio', 'mensagem', 'Adicione ao menos um componente ao kit.');
  end if;

  -- valida antes de escrever qualquer coisa
  if exists (
    select 1
      from jsonb_array_elements(p_itens) e
     where not exists (
       select 1 from public.estoque_itens i
        where i.id = (e->>'item_id')::uuid and i.oficina_doc = p_oficina_doc
     )
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'item_inexistente',
                              'mensagem', 'Um dos componentes escolhidos não existe no estoque.');
  end if;

  if p_kit_id is null then
    insert into public.estoque_kits (oficina_doc, nome, descricao, servico_id, foto_data_url)
    values (p_oficina_doc, btrim(p_nome), p_descricao, p_servico_id, p_foto_data_url)
    returning id into v_kit_id;
  else
    update public.estoque_kits
       set nome = btrim(p_nome), descricao = p_descricao,
           servico_id = p_servico_id, foto_data_url = p_foto_data_url
     where id = p_kit_id and oficina_doc = p_oficina_doc
    returning id into v_kit_id;

    if v_kit_id is null then
      return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Kit não encontrado.');
    end if;

    delete from public.estoque_kit_itens where kit_id = v_kit_id;
  end if;

  for v_rec in select * from jsonb_array_elements(p_itens)
  loop
    insert into public.estoque_kit_itens (kit_id, item_id, oficina_doc, quantidade, posicao)
    values (v_kit_id, (v_rec->>'item_id')::uuid, p_oficina_doc, (v_rec->>'quantidade')::numeric, v_pos);
    v_pos := v_pos + 1;
  end loop;

  select to_jsonb(k) into v_kit from public.estoque_kits k where k.id = v_kit_id;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', ki.item_id, 'quantidade', ki.quantidade)
                            order by ki.posicao), '[]'::jsonb)
    into v_itens
    from public.estoque_kit_itens ki
   where ki.kit_id = v_kit_id;

  return jsonb_build_object('ok', true, 'kit', v_kit, 'itens', v_itens);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- Opcional — NÃO aplicado por padrão.
--
-- Endurecimento: só vale se a SUPABASE_KEY do backend for a chave
-- service_role (que ignora RLS e pode executar as funções). Se for a chave
-- anon, NÃO rode isto — o backend deixaria de enxergar as tabelas. Confira
-- qual chave está no supabase.env antes.
--
--   alter table public.estoque_itens     enable row level security;
--   alter table public.estoque_kits      enable row level security;
--   alter table public.estoque_kit_itens enable row level security;
--   alter table public.estoque_movimentos enable row level security;
--
--   revoke execute on function public.estoque_ajustar_quantidade(text, uuid, numeric) from public, anon, authenticated;
--   revoke execute on function public.estoque_aplicar_kit(text, uuid)                 from public, anon, authenticated;
--   revoke execute on function public.estoque_salvar_kit(text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
-- ─────────────────────────────────────────────────────────────────────────

-- Pede pro PostgREST (a API do Supabase) recarregar o cache de tabelas e
-- funções, pra o backend enxergar o que acabou de ser criado sem esperar.
notify pgrst, 'reload schema';
