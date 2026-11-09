-- 0009 — Taxa da maquininha nas entradas do Financeiro + reserva de caixa sobre o LÍQUIDO
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente.
-- Pré-requisitos: financeiro.sql e 0008_reserva_caixa.sql.
--
-- O que muda
--   • `financeiro_transacoes.taxa` (R$): quanto a maquininha (ou o meio de pagamento) descontou de uma
--     ENTRADA. O sistema não estima nada — cada oficina tem a sua maquininha e a sua tabela de taxas —,
--     quem informa é o dono, olhando o extrato. Padrão 0: lançamento sem taxa se comporta como antes.
--   • `valor` continua sendo o que o cliente PAGOU (bruto). O líquido é `valor - taxa`, calculado na leitura
--     (nunca gravado, para não existirem dois números que podem divergir).
--   • A reserva de caixa passa a incidir sobre o líquido: `reserva = (valor - taxa) × percentual`, porque a
--     taxa é dinheiro que nunca chegou à conta da oficina. `financeiro_reservas.base_valor` passa a guardar
--     esse líquido. O gatilho também recalcula o depósito quando a taxa é editada depois.
--   • Depósitos que já existem NÃO são reescritos: continuam como foram calculados (sobre o bruto) até a
--     entrada ser editada (valor, categoria ou taxa), quando o depósito é recalculado pela regra nova.
--
-- Sem rodar este script o sistema segue normal: o backend só grava `taxa` quando ela é maior que zero, e
-- o Resumo cai de volta para "sem taxa" se a coluna ainda não existir.

begin;

-- ── Coluna e travas ───────────────────────────────────────────────────────────
alter table public.financeiro_transacoes
  add column if not exists taxa numeric(12,2) not null default 0;

alter table public.financeiro_transacoes drop constraint if exists financeiro_taxa_check;
alter table public.financeiro_transacoes add constraint financeiro_taxa_check
  check (
    taxa >= 0
    and taxa < valor                       -- a taxa nunca come o valor inteiro
    and (tipo = 'entrada' or taxa = 0)     -- só entrada tem taxa de maquininha
  );

comment on column public.financeiro_transacoes.taxa is
  'Taxa (R$) descontada pela maquininha/meio de pagamento numa ENTRADA. Informada pelo dono; líquido = valor - taxa.';

-- ── Gatilho da reserva: base = valor líquido ─────────────────────────────────
create or replace function public.reserva_sincronizar() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_dep       public.financeiro_reservas%rowtype;
  v_cfg       jsonb;
  v_pct       numeric;
  v_escopo    text;
  v_liquido   numeric;
  v_valor     numeric;
  v_virou_pago boolean;
begin
  if new.tipo is distinct from 'entrada' then
    return new;
  end if;

  v_virou_pago := new.status = 'pago' and (tg_op = 'INSERT' or old.status is distinct from 'pago');
  -- O que de fato entrou na conta: o que o cliente pagou menos a taxa da maquininha.
  v_liquido := new.valor - coalesce(new.taxa, 0);

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
      v_valor := round(v_liquido * v_dep.percentual / 100, 2);
      if v_valor <= 0 then
        update public.financeiro_reservas set status = 'cancelado' where id = v_dep.id;
      elsif v_valor is distinct from v_dep.valor
         or new.categoria is distinct from v_dep.categoria
         or v_liquido is distinct from v_dep.base_valor then
        update public.financeiro_reservas
           set valor = v_valor, base_valor = v_liquido, categoria = new.categoria
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

  v_valor := round(v_liquido * v_pct / 100, 2);
  if v_valor <= 0 then
    return new;
  end if;

  insert into public.financeiro_reservas (
    oficina_doc, tipo, valor, transacao_id, ordem_servico_id, categoria,
    percentual, escopo, base_valor, descricao
  ) values (
    new.oficina_doc, 'deposito', v_valor, new.id, new.ordem_servico_id, new.categoria,
    round(v_pct, 2), v_escopo, v_liquido, coalesce(new.descricao, '')
  );
  return new;
end;
$$;

-- O gatilho também escuta `taxa`: corrigir a taxa depois recalcula o depósito.
drop trigger if exists reserva_sincronizar_trg on public.financeiro_transacoes;
create trigger reserva_sincronizar_trg
  after insert or update of status, valor, categoria, taxa on public.financeiro_transacoes
  for each row execute function public.reserva_sincronizar();

-- `create or replace` mantém os privilégios, mas reafirma: só o backend executa.
revoke execute on function public.reserva_sincronizar() from public;

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0009', 'taxa da maquininha em financeiro_transacoes e reserva de caixa calculada sobre o valor líquido')
on conflict (versao) do nothing;

commit;
