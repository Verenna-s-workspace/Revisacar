-- ───────────────────────────────────────────────────────────────────────────
-- 0003 — Integração app do cliente ↔ oficina (fase "expandir")
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente.
-- Pré-requisitos: 0000, 0001 e 0002, ordens_oficina.sql, ordens_fotos.sql (ou
-- orcamentos.sql) — este script exige `ordens_oficina_id_uk`. Postgres 15+.
--
-- É a fase "expandir": só ADICIONA e RELAXA. Nada aqui quebra o código atual de
-- nenhum dos dois apps (colunas novas são opcionais; regras novas valem só
-- quando o campo novo é usado). O que aperta de verdade (NOT NULL de
-- appointments.oficina_doc, unicidade de placa, remoção de tabelas) vai na 0004,
-- depois que o código novo estiver no ar.
--
-- ── Modelo ──────────────────────────────────────────────────────────────────
--   customers          a PESSOA. Duas origens:
--                        'app'     — criou conta no app do cliente (tem senha,
--                                    e-mail único no sistema);
--                        'oficina' — cadastrada no balcão por uma oficina, sem
--                                    conta. É PRIVADA daquela oficina: outra
--                                    oficina pode cadastrar o mesmo e-mail/CPF
--                                    sem colidir nem descobrir que existe.
--   oficina_clientes   a PONTE: "este cliente faz parte da carteira desta
--                      oficina". Dados da relação ficam aqui, não em customers.
--                      O vínculo só vira 'ativo' com consentimento do cliente
--                      (convite aceito, pedido aceito, ou ele mesmo pediu) —
--                      exceto cadastro de balcão, onde não existe conta.
--   oficina_convites   link/QR que a oficina entrega; o cliente do app escaneia e
--                      entra na carteira. O código do convite é o próprio `id`
--                      (uuid aleatório); vale poucos dias e é revogável.
--   customer_vehicles  o veículo, com dono (customer_id) e, se foi cadastrado
--                      pela oficina para um cliente sem conta, `oficina_origem_doc`.
--   appointments       pedido/agenda; passa a saber a oficina, o mecânico, a OS.
--   ordens             ganha customer_id/vehicle_id. FK composta
--                      (oficina_doc, customer_id) → oficina_clientes: o banco
--                      impede uma OS apontar para um cliente que não é da oficina.
--
-- Status de appointments (um vocabulário só para os dois apps):
--   pendente → confirmado | recusado ; confirmado → em_andamento →
--   aguardando_pagamento → pronto_retirada → concluido ; cancelado em qualquer
--   ponto antes de concluir. ('agendado' do app do mecânico = 'confirmado'.)
--
-- Tabelas novas: privadas (RLS ligada, sem policy) — só o backend acessa.
-- ───────────────────────────────────────────────────────────────────────────

begin;

-- ── Pré-requisitos ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['admins','ordens','funcionarios','customers','customer_vehicles',
                           'appointments','availability_slots','schema_migrations'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Falta a tabela public.% — rode os scripts/migrations anteriores primeiro.', t;
    end if;
  end loop;
  if (select count(*) from public.schema_migrations
       where versao in ('0001_limpeza_segura', '0002_tabelas_app_cliente')) < 2 then
    raise exception 'Rode (e conclua) a 0001 e a 0002 antes desta.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'ordens_oficina_id_uk' and conrelid = 'public.ordens'::regclass) then
    raise exception 'Falta a constraint ordens_oficina_id_uk em ordens (criada por orcamentos.sql / ordens_fotos.sql).';
  end if;
end $$;

-- Mantém updated_at em dia nas tabelas novas.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ═══ 0) ids gerados pelo banco ═══════════════════════════════════════════
-- Hoje o Django gera o uuid. O backend do mecânico (supabase) também vai gravar
-- nestas três tabelas; com o padrão no banco, qualquer um dos dois pode inserir.
alter table public.customers         alter column id set default gen_random_uuid();
alter table public.customer_vehicles alter column id set default gen_random_uuid();
alter table public.appointments      alter column id set default gen_random_uuid();


-- ═══ 1) customers: pessoa com ou sem conta ═══════════════════════════════
alter table public.customers add column if not exists origem            text    not null default 'app';
alter table public.customers add column if not exists oficina_origem_doc text   references public.admins(doc);

-- Cliente de balcão não tem senha nem, às vezes, e-mail.
alter table public.customers alter column pwhash drop not null;
alter table public.customers alter column email  drop not null;

alter table public.customers drop constraint if exists customers_origem_check;
alter table public.customers add  constraint customers_origem_check
  check (origem in ('app', 'oficina'));

-- Conta do app exige senha; só o cadastro de balcão pode não ter.
alter table public.customers drop constraint if exists customers_conta_check;
alter table public.customers add  constraint customers_conta_check
  check (pwhash is not null or origem = 'oficina');

-- Cadastro de balcão exige saber qual oficina o criou; conta do app não tem oficina de origem.
alter table public.customers drop constraint if exists customers_origem_doc_check;
alter table public.customers add  constraint customers_origem_doc_check
  check ((origem = 'oficina') = (oficina_origem_doc is not null));

-- E-mail: antes era UNIQUE global. Agora a unicidade vale POR ESCOPO — entre contas
-- do app, e entre cadastros de balcão da MESMA oficina. (Se continuasse global, o
-- cadastro de balcão de uma oficina impediria o cliente de criar conta com aquele
-- e-mail, e revelaria a outras oficinas que ele já existe.)
do $$
declare
  nome text;
begin
  for nome in
    select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.customers'::regclass and c.contype = 'u'
       and array_length(c.conkey, 1) = 1 and a.attname = 'email'
  loop
    execute format('alter table public.customers drop constraint %I', nome);
    raise notice 'Removida a unicidade global do e-mail (%).', nome;
  end loop;
end $$;

create unique index if not exists customers_email_app_uk
  on public.customers (lower(email)) where origem = 'app' and email is not null;
create unique index if not exists customers_email_oficina_uk
  on public.customers (oficina_origem_doc, lower(email)) where origem = 'oficina' and email is not null;
create unique index if not exists customers_cpf_oficina_uk
  on public.customers (oficina_origem_doc, (regexp_replace(cpf, '\D', '', 'g')))
  where origem = 'oficina' and nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') is not null;
-- Busca por CPF/CNPJ (a coluna `cpf` guarda CPF ou CNPJ, só dígitos ou formatado).
create index if not exists customers_documento_idx
  on public.customers ((regexp_replace(cpf, '\D', '', 'g')))
  where nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') is not null;


-- ═══ 2) oficina_clientes: a ponte ════════════════════════════════════════
create table if not exists public.oficina_clientes (
  id              uuid primary key default gen_random_uuid(),
  oficina_doc     text not null references public.admins(doc),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  origem          text not null check (origem in ('oficina', 'cliente', 'convite')),
  status          text not null default 'ativo'
                  check (status in ('pendente_cliente', 'ativo', 'revogado')),
  observacoes     text not null default '',
  criado_por_nome text not null default '',
  confirmado_em   timestamptz,
  revogado_em     timestamptz,
  revogado_por    text check (revogado_por in ('oficina', 'cliente')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint oficina_clientes_oficina_cliente_uk unique (oficina_doc, customer_id),
  constraint oficina_clientes_oficina_id_uk      unique (oficina_doc, id),
  -- Vínculo ativo sempre registra QUANDO foi consentido; revogado, quando e por quem.
  constraint oficina_clientes_ativo_check    check (status <> 'ativo'    or confirmado_em is not null),
  constraint oficina_clientes_revogado_check check (status <> 'revogado' or (revogado_em is not null and revogado_por is not null))
);

create index if not exists oficina_clientes_customer_idx on public.oficina_clientes (customer_id);
create index if not exists oficina_clientes_status_idx   on public.oficina_clientes (oficina_doc, status);

drop trigger if exists oficina_clientes_touch on public.oficina_clientes;
create trigger oficina_clientes_touch before update on public.oficina_clientes
  for each row execute function public.touch_updated_at();

-- Cadastro de balcão já nasce na carteira da oficina que o criou.
create or replace function public.customers_vincula_oficina_origem()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.origem = 'oficina' then
    insert into public.oficina_clientes (oficina_doc, customer_id, origem, status, confirmado_em)
    values (new.oficina_origem_doc, new.id, 'oficina', 'ativo', now())
    on conflict (oficina_doc, customer_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_vincula_oficina_origem on public.customers;
create trigger customers_vincula_oficina_origem after insert on public.customers
  for each row execute function public.customers_vincula_oficina_origem();


-- ═══ 3) oficina_convites: link/QR para o cliente entrar ═════════════════
create table if not exists public.oficina_convites (
  id              uuid primary key default gen_random_uuid(),
  oficina_doc     text not null references public.admins(doc),
  criado_por_nome text not null default '',
  created_at      timestamptz not null default now(),
  expira_em       timestamptz not null,
  revogado_em     timestamptz,
  usos            integer not null default 0 check (usos >= 0),
  max_usos        integer check (max_usos is null or max_usos >= 1)
);

create index if not exists oficina_convites_oficina_idx on public.oficina_convites (oficina_doc, created_at desc);


-- ── Função: o cliente do app usa um convite e entra na carteira ──────────
-- Escanear o convite É o consentimento: o vínculo nasce (ou volta a ficar) ativo.
-- Se foi a PRÓPRIA oficina que revogou o vínculo, o convite não reativa.
-- Retorna jsonb: {ok, codigo, mensagem, novo, oficina_doc, vinculo}.
create or replace function public.oficina_convite_usar(p_convite_id uuid, p_customer_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_conv public.oficina_convites%rowtype;
  v_cli  public.customers%rowtype;
  v_vinc public.oficina_clientes%rowtype;
  v_novo boolean := false;
begin
  select * into v_conv from public.oficina_convites where id = p_convite_id for update;
  if not found or v_conv.revogado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'convite_invalido', 'mensagem', 'Convite inválido ou cancelado.');
  end if;
  if v_conv.expira_em <= now() then
    return jsonb_build_object('ok', false, 'codigo', 'convite_expirado', 'mensagem', 'Este convite expirou. Peça um novo à oficina.');
  end if;
  if v_conv.max_usos is not null and v_conv.usos >= v_conv.max_usos then
    return jsonb_build_object('ok', false, 'codigo', 'convite_esgotado', 'mensagem', 'Este convite já foi usado o máximo de vezes.');
  end if;

  select * into v_cli from public.customers where id = p_customer_id;
  if not found or v_cli.origem <> 'app' then
    return jsonb_build_object('ok', false, 'codigo', 'cliente_invalido', 'mensagem', 'Só contas do app podem usar um convite.');
  end if;

  select * into v_vinc from public.oficina_clientes
   where oficina_doc = v_conv.oficina_doc and customer_id = p_customer_id for update;

  if found then
    if v_vinc.status = 'ativo' then
      return jsonb_build_object('ok', true, 'novo', false, 'codigo', 'ja_vinculado',
        'oficina_doc', v_conv.oficina_doc, 'vinculo', to_jsonb(v_vinc));
    end if;
    if v_vinc.status = 'revogado' and v_vinc.revogado_por = 'oficina' then
      return jsonb_build_object('ok', false, 'codigo', 'vinculo_bloqueado',
        'mensagem', 'Não foi possível entrar nesta oficina com este convite.');
    end if;
    update public.oficina_clientes
       set status = 'ativo', origem = 'convite', confirmado_em = now(), revogado_em = null, revogado_por = null
     where id = v_vinc.id
    returning * into v_vinc;
  else
    insert into public.oficina_clientes (oficina_doc, customer_id, origem, status, confirmado_em)
    values (v_conv.oficina_doc, p_customer_id, 'convite', 'ativo', now())
    returning * into v_vinc;
    v_novo := true;
  end if;

  update public.oficina_convites set usos = usos + 1 where id = v_conv.id;

  return jsonb_build_object('ok', true, 'novo', v_novo, 'oficina_doc', v_conv.oficina_doc, 'vinculo', to_jsonb(v_vinc));
end;
$$;


-- ── Função: o cliente aceita ou recusa um pedido de vínculo da oficina ───
-- A oficina cria a linha com status 'pendente_cliente' (origem 'oficina');
-- só o próprio cliente consegue ativá-la. Retorna jsonb: {ok, codigo, mensagem, vinculo}.
create or replace function public.oficina_vinculo_responder(
  p_vinculo_id  uuid,
  p_customer_id uuid,
  p_aceitar     boolean
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_vinc public.oficina_clientes%rowtype;
begin
  select * into v_vinc from public.oficina_clientes
   where id = p_vinculo_id and customer_id = p_customer_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Pedido não encontrado.');
  end if;
  if v_vinc.status <> 'pendente_cliente' then
    return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_vinc.status,
      'mensagem', 'Este pedido não está mais pendente.');
  end if;

  if p_aceitar then
    update public.oficina_clientes set status = 'ativo', confirmado_em = now()
     where id = v_vinc.id returning * into v_vinc;
  else
    update public.oficina_clientes set status = 'revogado', revogado_em = now(), revogado_por = 'cliente'
     where id = v_vinc.id returning * into v_vinc;
  end if;

  return jsonb_build_object('ok', true, 'vinculo', to_jsonb(v_vinc));
end;
$$;


-- ═══ 4) customer_vehicles: campos do mecânico + origem ═══════════════════
alter table public.customer_vehicles add column if not exists categoria           text;
alter table public.customer_vehicles add column if not exists cambio              text;
alter table public.customer_vehicles add column if not exists portas              integer check (portas is null or portas between 1 and 8);
alter table public.customer_vehicles add column if not exists motor               text;
alter table public.customer_vehicles add column if not exists foto_principal_path text;  -- caminho no Storage (não guarde base64 no banco)
alter table public.customer_vehicles add column if not exists oficina_origem_doc  text references public.admins(doc);
-- Placa normalizada (sem hífen/espaço, maiúscula): base para busca e para a unicidade da 0004.
alter table public.customer_vehicles add column if not exists plate_norm text
  generated always as (upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))) stored;

create index if not exists customer_vehicles_plate_norm_idx on public.customer_vehicles (plate_norm);
create index if not exists customer_vehicles_customer_idx   on public.customer_vehicles (customer_id);


-- ═══ 5) appointments: oficina, mecânico, OS, remarcação ══════════════════
alter table public.appointments add column if not exists oficina_doc          text references public.admins(doc);
alter table public.appointments add column if not exists hora_fim             time without time zone;
alter table public.appointments add column if not exists mecanico_id          uuid references public.funcionarios(id) on delete set null;
alter table public.appointments add column if not exists ordem_id             text;
alter table public.appointments add column if not exists confirmado_em        timestamptz;
alter table public.appointments add column if not exists confirmado_por_nome  text;
alter table public.appointments add column if not exists reagend_data_anterior date;
alter table public.appointments add column if not exists reagend_hora_anterior time without time zone;
alter table public.appointments add column if not exists reagend_motivo       text;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add  constraint appointments_status_check
  check (status in ('pendente', 'confirmado', 'em_andamento', 'aguardando_pagamento',
                    'pronto_retirada', 'concluido', 'recusado', 'cancelado'));

alter table public.appointments drop constraint if exists appointments_hora_fim_check;
alter table public.appointments add  constraint appointments_hora_fim_check
  check (hora_fim is null or hora_fim > time_slot);

-- A OS ligada precisa ser da MESMA oficina; se a OS for apagada, o agendamento fica sem OS.
alter table public.appointments drop constraint if exists appointments_ordem_fk;
alter table public.appointments add  constraint appointments_ordem_fk
  foreign key (oficina_doc, ordem_id) references public.ordens (oficina_doc, id)
  on delete set null (ordem_id);

-- O cliente do agendamento precisa estar na carteira da oficina (vale quando oficina_doc é preenchido).
alter table public.appointments drop constraint if exists appointments_vinculo_fk;
alter table public.appointments add  constraint appointments_vinculo_fk
  foreign key (oficina_doc, customer_id) references public.oficina_clientes (oficina_doc, customer_id);

create index if not exists appointments_oficina_data_idx on public.appointments (oficina_doc, date);
create index if not exists appointments_customer_idx     on public.appointments (customer_id);
create index if not exists appointments_ordem_idx        on public.appointments (ordem_id) where ordem_id is not null;


-- ═══ 6) availability_slots: agenda por oficina ═══════════════════════════
alter table public.availability_slots add column if not exists oficina_doc text references public.admins(doc);
create unique index if not exists availability_slots_oficina_data_hora_uk
  on public.availability_slots (oficina_doc, date, time_slot) where oficina_doc is not null;


-- ═══ 7) ordens: ligação com cliente e veículo ════════════════════════════
alter table public.ordens add column if not exists customer_id uuid;
alter table public.ordens add column if not exists vehicle_id  uuid references public.customer_vehicles(id) on delete set null;

-- A OS só aponta para cliente que é da carteira da própria oficina.
alter table public.ordens drop constraint if exists ordens_vinculo_fk;
alter table public.ordens add  constraint ordens_vinculo_fk
  foreign key (oficina_doc, customer_id) references public.oficina_clientes (oficina_doc, customer_id);

create index if not exists ordens_oficina_customer_idx on public.ordens (oficina_doc, customer_id) where customer_id is not null;
create index if not exists ordens_vehicle_idx          on public.ordens (vehicle_id) where vehicle_id is not null;


-- ═══ 8) Fechar o acesso direto ═══════════════════════════════════════════
alter table public.oficina_clientes enable row level security;
alter table public.oficina_convites enable row level security;

do $$
declare
  r text;
  t text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      foreach t in array array['oficina_clientes', 'oficina_convites'] loop
        execute format('revoke all on public.%I from %I', t, r);
      end loop;
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.oficina_clientes, public.oficina_convites to service_role;
  end if;
end $$;

revoke execute on function public.oficina_convite_usar(uuid, uuid)                  from public;
revoke execute on function public.oficina_vinculo_responder(uuid, uuid, boolean)    from public;
revoke execute on function public.customers_vincula_oficina_origem()                from public;
revoke execute on function public.touch_updated_at()                                from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.oficina_convite_usar(uuid, uuid)               to service_role;
    grant execute on function public.oficina_vinculo_responder(uuid, uuid, boolean) to service_role;
  end if;
end $$;


-- ═══ 9) Documentação no próprio banco ════════════════════════════════════
comment on table  public.oficina_clientes is 'Carteira: cliente (customers) que faz parte de uma oficina. Vínculo ativo = consentido.';
comment on column public.oficina_clientes.status is 'pendente_cliente: oficina pediu, cliente ainda não aceitou · ativo · revogado';
comment on table  public.oficina_convites is 'Convite (link/QR) para o cliente do app entrar na carteira. O código do convite é o próprio id (uuid aleatório); expira e pode ser revogado.';
comment on column public.customers.origem is 'app: conta criada no app do cliente · oficina: cadastro de balcão, privado da oficina_origem_doc, sem senha';
comment on column public.customers.cpf    is 'CPF ou CNPJ (só dígitos ou formatado). Compare sempre com regexp_replace(cpf, ''\D'', '''', ''g'').';
comment on column public.customer_vehicles.oficina_origem_doc is 'Preenchido quando a oficina cadastrou o veículo para um cliente sem conta (cadastro privado da oficina).';
comment on column public.appointments.service_type is 'Título do agendamento (o app do mecânico chama de `titulo`).';
comment on column public.appointments.service_description is 'Descrição do agendamento (o app do mecânico chama de `descricao`).';

insert into public.schema_migrations (versao, descricao) values
  ('0003_integracao_cliente_oficina', 'customers com/sem conta, oficina_clientes, oficina_convites, veículos e agendamentos por oficina, ordens.customer_id/vehicle_id')
on conflict (versao) do nothing;

commit;
