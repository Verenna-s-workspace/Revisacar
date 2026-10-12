-- ─────────────────────────────────────────────────────────────────────────
-- Orçamentos da OS (versões + itens) — Fase 1
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Pré-requisitos: public.admins, public.ordens (rode ordens_oficina.sql antes,
-- pra `ordens.oficina_doc` existir).
--
-- Modelo
--   • Cada OS tem uma ou mais VERSÕES de orçamento (`orcamentos`, versao 1, 2…).
--     Refazer ou editar um orçamento já enviado cria uma versão nova; a anterior
--     vira 'substituido' só quando a nova é ENVIADA.
--   • Status da versão: rascunho → enviado → aprovado | recusado | substituido.
--   • No máximo UM rascunho e UM orçamento ativo (enviado ou aprovado) por OS —
--     garantido por índice único parcial.
--   • `orcamento_itens`: peças e serviços. `preco_unitario` é o que o cliente
--     paga (único valor que vai no PDF); `custo_unitario` é interno (margem).
--   • `estoque_item_id` / `servico_id` ligam o item ao Estoque / Catálogo SEM
--     chave estrangeira de propósito: o item guarda um retrato (descrição, preço)
--     e continua válido se o cadastro original for apagado.
--
-- As mudanças que mexem no orçamento E no status da OS são funções (atômicas,
-- com trava de linha), chamadas pelo backend via supabase.rpc. Quais status de
-- OS aceitam a mudança vem do backend (orders/ordem_status.py) — o SQL não
-- repete essa tabela.
--
-- As travas (CHECK) entram como NOT VALID: valem para o que for gravado daqui
-- pra frente. Tabela nova, então não há histórico a revalidar.
-- ─────────────────────────────────────────────────────────────────────────

-- Permite a chave estrangeira composta (oficina_doc, ordem_id): o orçamento só
-- pode apontar pra uma OS da MESMA oficina.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ordens'::regclass and conname = 'ordens_oficina_id_uk'
  ) then
    alter table public.ordens add constraint ordens_oficina_id_uk unique (oficina_doc, id);
  end if;
end $$;


-- ── Versões do orçamento ─────────────────────────────────────────────────

create table if not exists public.orcamentos (
  id                 uuid primary key default gen_random_uuid(),
  oficina_doc        text not null references public.admins(doc),
  ordem_id           text not null,
  versao             integer not null check (versao > 0),
  status             text not null default 'rascunho'
                       check (status in ('rascunho', 'enviado', 'aprovado', 'recusado', 'substituido')),
  validade_dias      integer not null default 7 check (validade_dias between 1 and 90),
  -- Definida no envio (data do envio + validade_dias, no fuso do usuário).
  validade_ate       date,
  observacoes        text not null default '',
  -- Soma dos itens (quantidade × preço cobrado), recalculada a cada salvamento.
  total              numeric(12,2) not null default 0 check (total >= 0),
  enviado_em         timestamptz,
  aprovado_em        timestamptz,
  aprovado_por_nome  text,
  aprovacao_canal    text check (aprovacao_canal in ('whatsapp', 'presencial', 'telefone', 'app', 'outro')),
  aprovacao_obs      text,
  recusado_em        timestamptz,
  motivo_recusa      text,
  criado_por_nome    text not null default '',
  criado_por_tipo    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,

  constraint orcamentos_oficina_id_uk unique (oficina_doc, id),
  constraint orcamentos_versao_uk unique (oficina_doc, ordem_id, versao),
  -- Apagar a OS leva os orçamentos dela junto (sem OS eles não têm sentido).
  constraint orcamentos_ordem_fk foreign key (oficina_doc, ordem_id)
    references public.ordens (oficina_doc, id) on delete cascade
);

-- Uma OS tem no máximo um rascunho e um orçamento ativo por vez.
create unique index if not exists orcamentos_um_rascunho_idx
  on public.orcamentos (ordem_id) where status = 'rascunho';
create unique index if not exists orcamentos_um_ativo_idx
  on public.orcamentos (ordem_id) where status in ('enviado', 'aprovado');

create index if not exists orcamentos_ordem_idx
  on public.orcamentos (oficina_doc, ordem_id, versao desc);


-- ── Itens ────────────────────────────────────────────────────────────────

create table if not exists public.orcamento_itens (
  id               uuid primary key default gen_random_uuid(),
  orcamento_id     uuid not null,
  oficina_doc      text not null,
  posicao          integer not null default 0,     -- ordem em que o item aparece
  tipo             text not null check (tipo in ('peca', 'servico')),
  descricao        text not null check (btrim(descricao) <> ''),
  marca            text not null default '',
  quantidade       numeric(12,3) not null check (quantidade > 0),
  preco_unitario   numeric(12,2) not null default 0 check (preco_unitario >= 0),
  -- Interno: só aparece pra quem tem financeiro.ver_margem. null = não informado.
  custo_unitario   numeric(12,2) check (custo_unitario >= 0),
  motivo           text not null default '',       -- por que a troca/serviço é necessário
  estoque_item_id  uuid,
  servico_id       uuid,

  foreign key (oficina_doc, orcamento_id)
    references public.orcamentos (oficina_doc, id) on delete cascade
);

create index if not exists orcamento_itens_orcamento_idx
  on public.orcamento_itens (orcamento_id, posicao);


-- ── Função: nova versão (rascunho) ───────────────────────────────────────
-- Cria o rascunho da próxima versão, copiando os itens e a validade da versão
-- mais recente. Se a OS estava 'recusada', reabre pra 'em_orcamento' ("refazer").
-- p_os_permitidos: array jsonb com os status de OS que aceitam um orçamento novo
-- (vem do backend).
-- Retorna jsonb: {ok, codigo, mensagem, orcamento_id, versao, os_status}.

create or replace function public.orcamento_criar_versao(
  p_oficina_doc    text,
  p_ordem_id       text,
  p_os_permitidos  jsonb,
  p_agora          text,
  p_nome           text,
  p_tipo           text
) returns jsonb
language plpgsql
as $$
declare
  v_os_status text;
  v_rascunho  uuid;
  v_ultima    public.orcamentos%rowtype;
  v_novo      uuid;
  v_versao    integer;
begin
  select status into v_os_status
    from public.ordens
   where id = p_ordem_id and oficina_doc = p_oficina_doc
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'OS não encontrada.');
  end if;

  if not (p_os_permitidos ? coalesce(v_os_status, 'rascunho')) then
    return jsonb_build_object('ok', false, 'codigo', 'os_status', 'os_status', v_os_status,
      'mensagem', 'A OS está em "' || coalesce(v_os_status, 'rascunho') || '" e não aceita um novo orçamento agora.');
  end if;

  select id into v_rascunho
    from public.orcamentos
   where ordem_id = p_ordem_id and oficina_doc = p_oficina_doc and status = 'rascunho';
  if found then
    return jsonb_build_object('ok', false, 'codigo', 'rascunho_existente', 'orcamento_id', v_rascunho,
      'mensagem', 'Já existe um rascunho de orçamento para esta OS.');
  end if;

  select * into v_ultima
    from public.orcamentos
   where ordem_id = p_ordem_id and oficina_doc = p_oficina_doc
   order by versao desc
   limit 1;

  v_versao := coalesce(v_ultima.versao, 0) + 1;

  insert into public.orcamentos (oficina_doc, ordem_id, versao, validade_dias, observacoes,
                                 criado_por_nome, criado_por_tipo, created_at)
  values (p_oficina_doc, p_ordem_id, v_versao, coalesce(v_ultima.validade_dias, 7), coalesce(v_ultima.observacoes, ''),
          coalesce(p_nome, ''), coalesce(p_tipo, ''), now())
  returning id into v_novo;

  if v_ultima.id is not null then
    insert into public.orcamento_itens (orcamento_id, oficina_doc, posicao, tipo, descricao, marca,
                                        quantidade, preco_unitario, custo_unitario, motivo,
                                        estoque_item_id, servico_id)
    select v_novo, oficina_doc, posicao, tipo, descricao, marca,
           quantidade, preco_unitario, custo_unitario, motivo, estoque_item_id, servico_id
      from public.orcamento_itens
     where orcamento_id = v_ultima.id;

    update public.orcamentos
       set total = (select coalesce(sum(round(quantidade * preco_unitario, 2)), 0)
                      from public.orcamento_itens where orcamento_id = v_novo)
     where id = v_novo;
  end if;

  -- Orçamento recusado e refeito: a OS volta a ser "em orçamento".
  if v_os_status = 'recusada' then
    update public.ordens set status = 'em_orcamento', updated_at = p_agora
     where id = p_ordem_id and oficina_doc = p_oficina_doc;
    v_os_status := 'em_orcamento';
  end if;

  return jsonb_build_object('ok', true, 'orcamento_id', v_novo, 'versao', v_versao, 'os_status', v_os_status);
end;
$$;


-- ── Função: salvar rascunho ──────────────────────────────────────────────
-- Troca validade, observações e a lista de itens inteira, na mesma transação,
-- e recalcula o total. Só aceita rascunho.
-- p_itens: array jsonb de {posicao, tipo, descricao, marca, quantidade,
--   preco_unitario, custo_unitario, motivo, estoque_item_id, servico_id}.
-- Retorna jsonb: {ok, codigo, mensagem, status, total}.

create or replace function public.orcamento_salvar(
  p_oficina_doc  text,
  p_orcamento_id uuid,
  p_validade_dias integer,
  p_observacoes  text,
  p_itens        jsonb,
  p_agora        timestamptz
) returns jsonb
language plpgsql
as $$
declare
  v_status text;
  v_total  numeric(12,2);
begin
  select status into v_status
    from public.orcamentos
   where id = p_orcamento_id and oficina_doc = p_oficina_doc
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Orçamento não encontrado.');
  end if;
  if v_status <> 'rascunho' then
    return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_status,
      'mensagem', 'Só dá pra editar um orçamento em rascunho. Crie uma nova versão.');
  end if;

  delete from public.orcamento_itens where orcamento_id = p_orcamento_id;

  insert into public.orcamento_itens (orcamento_id, oficina_doc, posicao, tipo, descricao, marca,
                                      quantidade, preco_unitario, custo_unitario, motivo,
                                      estoque_item_id, servico_id)
  select p_orcamento_id, p_oficina_doc, coalesce(x.posicao, 0), x.tipo, x.descricao, coalesce(x.marca, ''),
         x.quantidade, coalesce(x.preco_unitario, 0), x.custo_unitario, coalesce(x.motivo, ''),
         x.estoque_item_id, x.servico_id
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
           posicao integer, tipo text, descricao text, marca text, quantidade numeric,
           preco_unitario numeric, custo_unitario numeric, motivo text,
           estoque_item_id uuid, servico_id uuid);

  select coalesce(sum(round(quantidade * preco_unitario, 2)), 0) into v_total
    from public.orcamento_itens where orcamento_id = p_orcamento_id;

  update public.orcamentos
     set validade_dias = p_validade_dias,
         observacoes   = coalesce(p_observacoes, ''),
         total         = v_total,
         updated_at    = p_agora
   where id = p_orcamento_id;

  return jsonb_build_object('ok', true, 'status', v_status, 'total', v_total);
end;
$$;


-- ── Função: enviar ao cliente ────────────────────────────────────────────
-- rascunho → enviado. As versões anteriores ativas (enviado/aprovado) viram
-- 'substituido' e a OS vai pra p_os_novo (pendente_aprovacao), tudo junto.
-- A validade vale até p_hoje (data do envio no fuso do usuário) + validade_dias.
-- Retorna jsonb: {ok, codigo, mensagem, os_status, validade_ate}.

create or replace function public.orcamento_enviar(
  p_oficina_doc   text,
  p_orcamento_id  uuid,
  p_os_permitidos jsonb,
  p_os_novo       text,
  p_hoje          date,
  p_agora         text
) returns jsonb
language plpgsql
as $$
declare
  v_ordem_id  text;
  v_status    text;
  v_itens     integer;
  v_os_status text;
begin
  -- Trava na mesma ordem em todas as funções: primeiro a OS, depois o orçamento.
  select ordem_id into v_ordem_id
    from public.orcamentos where id = p_orcamento_id and oficina_doc = p_oficina_doc;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Orçamento não encontrado.');
  end if;

  select status into v_os_status from public.ordens
   where id = v_ordem_id and oficina_doc = p_oficina_doc for update;
  select status into v_status from public.orcamentos
   where id = p_orcamento_id and oficina_doc = p_oficina_doc for update;

  if v_status <> 'rascunho' then
    return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_status,
      'mensagem', 'Só dá pra enviar um orçamento em rascunho.');
  end if;

  select count(*) into v_itens from public.orcamento_itens where orcamento_id = p_orcamento_id;
  if v_itens = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'sem_itens',
      'mensagem', 'Adicione ao menos um item antes de enviar o orçamento.');
  end if;

  if not (p_os_permitidos ? coalesce(v_os_status, 'rascunho')) then
    return jsonb_build_object('ok', false, 'codigo', 'os_status', 'os_status', v_os_status,
      'mensagem', 'A OS está em "' || coalesce(v_os_status, 'rascunho') || '" e não pode ir para aprovação agora.');
  end if;

  update public.orcamentos
     set status = 'substituido', updated_at = now()
   where ordem_id = v_ordem_id and oficina_doc = p_oficina_doc
     and id <> p_orcamento_id and status in ('enviado', 'aprovado');

  update public.orcamentos
     set status = 'enviado', enviado_em = now(), validade_ate = p_hoje + validade_dias, updated_at = now()
   where id = p_orcamento_id;

  if v_os_status is distinct from p_os_novo then
    update public.ordens set status = p_os_novo, updated_at = p_agora
     where id = v_ordem_id and oficina_doc = p_oficina_doc;
  end if;

  return jsonb_build_object('ok', true, 'os_status', p_os_novo,
    'validade_ate', (select validade_ate from public.orcamentos where id = p_orcamento_id));
end;
$$;


-- ── Função: registrar aprovação do cliente ───────────────────────────────
-- enviado → aprovado (o mecânico registra o que o cliente respondeu, ex. por
-- WhatsApp). Orçamento vencido não pode ser aprovado: refaça e envie de novo.
-- Retorna jsonb: {ok, codigo, mensagem, os_status}.

create or replace function public.orcamento_aprovar(
  p_oficina_doc   text,
  p_orcamento_id  uuid,
  p_os_permitidos jsonb,
  p_os_novo       text,
  p_hoje          date,
  p_canal         text,
  p_obs           text,
  p_nome          text,
  p_agora         text
) returns jsonb
language plpgsql
as $$
declare
  v_ordem_id  text;
  v_orc       public.orcamentos%rowtype;
  v_os_status text;
begin
  select ordem_id into v_ordem_id
    from public.orcamentos where id = p_orcamento_id and oficina_doc = p_oficina_doc;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Orçamento não encontrado.');
  end if;

  select status into v_os_status from public.ordens
   where id = v_ordem_id and oficina_doc = p_oficina_doc for update;
  select * into v_orc from public.orcamentos
   where id = p_orcamento_id and oficina_doc = p_oficina_doc for update;

  if v_orc.status <> 'enviado' then
    return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_orc.status,
      'mensagem', 'Só dá pra aprovar um orçamento que foi enviado ao cliente.');
  end if;
  if v_orc.validade_ate is not null and v_orc.validade_ate < p_hoje then
    return jsonb_build_object('ok', false, 'codigo', 'vencido', 'validade_ate', v_orc.validade_ate,
      'mensagem', 'O orçamento venceu. Crie uma nova versão e envie de novo.');
  end if;
  if not (p_os_permitidos ? coalesce(v_os_status, 'rascunho')) then
    return jsonb_build_object('ok', false, 'codigo', 'os_status', 'os_status', v_os_status,
      'mensagem', 'A OS está em "' || coalesce(v_os_status, 'rascunho') || '" e não pode ser aprovada agora.');
  end if;

  update public.orcamentos
     set status = 'aprovado', aprovado_em = now(), aprovado_por_nome = nullif(p_nome, ''),
         aprovacao_canal = p_canal, aprovacao_obs = nullif(p_obs, ''), updated_at = now()
   where id = p_orcamento_id;

  if v_os_status is distinct from p_os_novo then
    update public.ordens set status = p_os_novo, updated_at = p_agora
     where id = v_ordem_id and oficina_doc = p_oficina_doc;
  end if;

  return jsonb_build_object('ok', true, 'os_status', p_os_novo);
end;
$$;


-- ── Função: registrar recusa ─────────────────────────────────────────────
-- enviado | aprovado → recusado, com o motivo; a OS vai pra p_os_novo (recusada).
-- Retorna jsonb: {ok, codigo, mensagem, os_status}.

create or replace function public.orcamento_recusar(
  p_oficina_doc   text,
  p_orcamento_id  uuid,
  p_os_permitidos jsonb,
  p_os_novo       text,
  p_motivo        text,
  p_agora         text
) returns jsonb
language plpgsql
as $$
declare
  v_ordem_id  text;
  v_status    text;
  v_os_status text;
begin
  select ordem_id into v_ordem_id
    from public.orcamentos where id = p_orcamento_id and oficina_doc = p_oficina_doc;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Orçamento não encontrado.');
  end if;

  select status into v_os_status from public.ordens
   where id = v_ordem_id and oficina_doc = p_oficina_doc for update;
  select status into v_status from public.orcamentos
   where id = p_orcamento_id and oficina_doc = p_oficina_doc for update;

  if v_status not in ('enviado', 'aprovado') then
    return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_status,
      'mensagem', 'Só dá pra recusar um orçamento enviado ou aprovado.');
  end if;
  if not (p_os_permitidos ? coalesce(v_os_status, 'rascunho')) then
    return jsonb_build_object('ok', false, 'codigo', 'os_status', 'os_status', v_os_status,
      'mensagem', 'A OS está em "' || coalesce(v_os_status, 'rascunho') || '" e não pode ser recusada agora.');
  end if;

  update public.orcamentos
     set status = 'recusado', recusado_em = now(), motivo_recusa = nullif(p_motivo, ''), updated_at = now()
   where id = p_orcamento_id;

  if v_os_status is distinct from p_os_novo then
    update public.ordens set status = p_os_novo, updated_at = p_agora
     where id = v_ordem_id and oficina_doc = p_oficina_doc;
  end if;

  return jsonb_build_object('ok', true, 'os_status', p_os_novo);
end;
$$;


-- O backend usa a chave service_role. Projetos novos do Supabase podem não
-- liberar tabelas criadas pelo SQL Editor sem GRANT explícito.
grant all on public.orcamentos to service_role;
grant all on public.orcamento_itens to service_role;
grant execute on function public.orcamento_criar_versao(text, text, jsonb, text, text, text) to service_role;
grant execute on function public.orcamento_salvar(text, uuid, integer, text, jsonb, timestamptz) to service_role;
grant execute on function public.orcamento_enviar(text, uuid, jsonb, text, date, text) to service_role;
grant execute on function public.orcamento_aprovar(text, uuid, jsonb, text, date, text, text, text, text) to service_role;
grant execute on function public.orcamento_recusar(text, uuid, jsonb, text, text, text) to service_role;

-- Pede pro PostgREST recarregar o cache de tabelas e funções.
notify pgrst, 'reload schema';
