-- 0008 — Reserva de caixa (percentual de cada entrada paga guardado à parte)
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente.
-- Pré-requisito: financeiro.sql (e 0000_controle.sql, que cria schema_migrations).
--
-- O que é
--   Algumas oficinas separam um percentual de cada serviço (e/ou peça) recebido num "caixa de
--   emergência". Isto NÃO é desconto: o cliente paga o mesmo valor e a receita continua inteira.
--   A reserva é só uma separação interna do dinheiro que entrou, com saldo e histórico próprios.
--
-- Como funciona
--   • `admins.reserva_config` (jsonb): {"ativa": bool, "percentual": 0-100, "escopo": "servicos"|"pecas"|"ambos"}.
--     Sem valor (NULL) = desligado. É o estado de TODAS as oficinas depois desta migration:
--     nenhuma muda de comportamento até o dono ligar a reserva em Configurações.
--   • `financeiro_reservas`: um lançamento por movimento. 'deposito' nasce sozinho quando uma ENTRADA da
--     categoria do escopo (servicos / pecas) passa a 'pago'; 'retirada' é registrada pelo dono.
--     Os depósitos guardam o percentual e o escopo da época (mudar a configuração depois NÃO reescreve
--     o histórico: vale para os próximos pagamentos).
--   • O gatilho `reserva_sincronizar` em financeiro_transacoes mantém o depósito acompanhando a entrada:
--     valor editado → depósito recalculado; voltou a pendente / cancelada / saiu do escopo → depósito
--     cancelado. Só entradas que passam a 'pago' DEPOIS da reserva ligada geram depósito (editar um
--     pagamento antigo nunca cria reserva retroativa).
--   • Tabelas e consultas que já existem (Resumo, Relatórios, Alertas, Visão Geral) não leem nada daqui.
--
-- Sem rodar este script o sistema segue normal: as rotas /financeiro/reserva* respondem 503 mandando rodar
-- esta migration, e o restante do Financeiro não é afetado.

begin;

-- ── Configuração por oficina ──────────────────────────────────────────────────
alter table public.admins add column if not exists reserva_config    jsonb;
alter table public.admins add column if not exists reserva_config_em timestamptz;

-- ── Movimentos da reserva ─────────────────────────────────────────────────────
create table if not exists public.financeiro_reservas (
  id               uuid primary key default gen_random_uuid(),
  oficina_doc      text not null references public.admins(doc),
  tipo             text not null check (tipo in ('deposito', 'retirada')),
  valor            numeric(12,2) not null check (valor > 0),
  status           text not null default 'ativo' check (status in ('ativo', 'cancelado')),
  -- Só depósito: de qual entrada veio e com que regra foi calculado (snapshot).
  transacao_id     uuid,
  ordem_servico_id text,
  categoria        text,
  percentual       numeric(5,2) check (percentual is null or (percentual > 0 and percentual <= 100)),
  escopo           text check (escopo is null or escopo in ('servicos', 'pecas', 'ambos')),
  base_valor       numeric(12,2),
  descricao        text not null default '',
  criado_por_nome  text not null default '',
  created_at       timestamptz not null default now(),
  constraint financeiro_reservas_deposito_check
    check (tipo <> 'deposito' or (transacao_id is not null and percentual is not null and escopo is not null))
);

-- Uma entrada tem no máximo um depósito vivo.
create unique index if not exists financeiro_reservas_deposito_uq
  on public.financeiro_reservas (transacao_id)
  where tipo = 'deposito' and status = 'ativo';

create index if not exists financeiro_reservas_oficina_idx
  on public.financeiro_reservas (oficina_doc, created_at desc);

-- Tabela privada do backend (service_role): RLS ligada, sem policy, fechada para anon/authenticated.
alter table public.financeiro_reservas enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.financeiro_reservas from %I', r);
    end if;
  end loop;
end $$;

-- ── Escopo → categorias de entrada ────────────────────────────────────────────
create or replace function public.reserva_categorias(p_escopo text) returns text[]
language sql immutable
as $$
  select case p_escopo
    when 'servicos' then array['servicos']
    when 'pecas'    then array['pecas']
    when 'ambos'    then array['servicos', 'pecas']
  end;
$$;

-- ── Gatilho: mantém o depósito acompanhando a entrada ─────────────────────────
-- Caminho rápido: quem não usa a reserva sai nas primeiras linhas (uma consulta por índice parcial).
create or replace function public.reserva_sincronizar() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_dep       public.financeiro_reservas%rowtype;
  v_cfg       jsonb;
  v_pct       numeric;
  v_escopo    text;
  v_valor     numeric;
  v_virou_pago boolean;
begin
  if new.tipo is distinct from 'entrada' then
    return new;
  end if;

  v_virou_pago := new.status = 'pago' and (tg_op = 'INSERT' or old.status is distinct from 'pago');

  select * into v_dep from public.financeiro_reservas
   where transacao_id = new.id and tipo = 'deposito' and status = 'ativo';
  if not found and not v_virou_pago then
    return new;
  end if;

  -- Serializa por oficina: depósitos, cancelamentos e retiradas conferem o saldo na mesma fila.
  perform pg_advisory_xact_lock(hashtext('reserva:' || new.oficina_doc));

  select * into v_dep from public.financeiro_reservas
   where transacao_id = new.id and tipo = 'deposito' and status = 'ativo'
   for update;

  if found then
    -- A reserva já existe: acompanha a entrada, com a regra da época em que nasceu.
    if new.status = 'pago' and new.categoria = any (public.reserva_categorias(v_dep.escopo)) then
      v_valor := round(new.valor * v_dep.percentual / 100, 2);
      if v_valor <= 0 then
        update public.financeiro_reservas set status = 'cancelado' where id = v_dep.id;
      elsif v_valor is distinct from v_dep.valor or new.categoria is distinct from v_dep.categoria then
        update public.financeiro_reservas
           set valor = v_valor, base_valor = new.valor, categoria = new.categoria
         where id = v_dep.id;
      end if;
    else
      update public.financeiro_reservas set status = 'cancelado' where id = v_dep.id;
    end if;
    return new;
  end if;

  -- Sem reserva ainda: só nasce quando a entrada ACABOU de ser paga.
  if not v_virou_pago then
    return new;
  end if;

  select reserva_config into v_cfg from public.admins where doc = new.oficina_doc;
  if v_cfg is null or coalesce(v_cfg->>'ativa', '') <> 'true' then
    return new;
  end if;
  -- Leitura defensiva: um jsonb editado à mão nunca pode derrubar o lançamento financeiro.
  v_pct := case when coalesce(v_cfg->>'percentual', '') ~ '^[0-9]+(\.[0-9]+)?$'
                then (v_cfg->>'percentual')::numeric end;
  v_escopo := v_cfg->>'escopo';
  if v_pct is null or v_pct <= 0 or v_pct > 100
     or v_escopo is null or public.reserva_categorias(v_escopo) is null
     or not (new.categoria = any (public.reserva_categorias(v_escopo))) then
    return new;
  end if;

  v_valor := round(new.valor * v_pct / 100, 2);
  if v_valor <= 0 then
    return new;
  end if;

  insert into public.financeiro_reservas (
    oficina_doc, tipo, valor, transacao_id, ordem_servico_id, categoria,
    percentual, escopo, base_valor, descricao
  ) values (
    new.oficina_doc, 'deposito', v_valor, new.id, new.ordem_servico_id, new.categoria,
    round(v_pct, 2), v_escopo, new.valor, coalesce(new.descricao, '')
  );
  return new;
end;
$$;

drop trigger if exists reserva_sincronizar_trg on public.financeiro_transacoes;
create trigger reserva_sincronizar_trg
  after insert or update of status, valor, categoria on public.financeiro_transacoes
  for each row execute function public.reserva_sincronizar();

-- ── Retirada: confere o saldo sob trava, na mesma transação ───────────────────
-- Retorna jsonb: {ok: true, id, saldo} ou {ok: false, codigo: 'saldo_insuficiente', saldo}.
create or replace function public.reserva_retirar(
  p_oficina_doc text,
  p_valor       numeric,
  p_descricao   text,
  p_nome        text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_saldo numeric;
  v_id    uuid;
begin
  perform pg_advisory_xact_lock(hashtext('reserva:' || p_oficina_doc));

  select coalesce(sum(case tipo when 'deposito' then valor else -valor end), 0) into v_saldo
    from public.financeiro_reservas
   where oficina_doc = p_oficina_doc and status = 'ativo';

  if p_valor > v_saldo then
    return jsonb_build_object('ok', false, 'codigo', 'saldo_insuficiente', 'saldo', v_saldo);
  end if;

  insert into public.financeiro_reservas (oficina_doc, tipo, valor, descricao, criado_por_nome)
  values (p_oficina_doc, 'retirada', p_valor, coalesce(p_descricao, ''), coalesce(p_nome, ''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'saldo', v_saldo - p_valor);
end;
$$;

-- As funções ficam chamáveis só pelo backend.
revoke execute on function public.reserva_retirar(text, numeric, text, text) from public;
revoke execute on function public.reserva_sincronizar() from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.reserva_retirar(text, numeric, text, text) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.financeiro_reservas to service_role;
    grant execute on function public.reserva_retirar(text, numeric, text, text) to service_role;
    grant execute on function public.reserva_categorias(text) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0008', 'reserva de caixa: admins.reserva_config, financeiro_reservas e gatilho em financeiro_transacoes')
on conflict (versao) do nothing;

commit;
