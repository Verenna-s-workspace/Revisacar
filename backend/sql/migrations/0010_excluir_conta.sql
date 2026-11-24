-- 0010 — Excluir a conta da oficina (dono): apaga a oficina e TODOS os dados dela, de uma vez
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente (só cria/atualiza a função).
-- Pré-requisitos: 0003 (carteira), 0004 (auth), 0008 (reserva de caixa) e os scripts de estoque, serviços,
-- financeiro, orçamentos, fotos e alertas — todos já aplicados em produção.
--
-- Por que uma função: a conta do dono (`admins`) é referenciada por quase todas as tabelas (e várias têm
-- chave estrangeira composta (oficina_doc, id)). Apagar pelo PostgREST seriam ~25 chamadas separadas e, se
-- uma falhasse no meio, sobraria uma oficina pela metade. Dentro da função é UMA transação: ou apaga tudo
-- ou não apaga nada (qualquer chave estrangeira inesperada desfaz tudo e o backend responde "tente de novo").
--
-- O que é apagado (tudo da oficina `p_oficina_doc`)
--   ordens, fotos obrigatórias, orçamentos (itens, links públicos), reservas de estoque, estoque (itens, kits,
--   movimentos), catálogo de serviços, financeiro (lançamentos e reserva de caixa), agenda (agendamentos e
--   horários), convites, carteira, funcionários, sessões/tokens e a própria conta.
--
-- O que NÃO é apagado (é de outra pessoa)
--   • Contas do app do cliente (customers.origem = 'app') e os veículos delas: só o VÍNCULO com a oficina
--     some (oficina_clientes). Um veículo que a oficina cadastrou para um cliente do app continua com o cliente,
--     apenas sem a marca de "cadastrado por esta oficina".
--   • Cadastros de balcão (customers.origem = 'oficina') SÃO apagados: eram privados da oficina e sem conta.
--
-- Os arquivos do Storage (fotos e PDFs, sempre em `<ordem_id>/...`) não são do banco: o backend os remove
-- depois que esta função conclui.
--
-- Devolve {ordens, funcionarios, clientes} (quantos foram apagados), só para log.
-- Erros: P0002 = oficina não encontrada; 22023 = parâmetro vazio.

begin;

create or replace function public.conta_excluir_oficina(p_oficina_doc text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_func_ids  text[];
  v_emails    text[];
  v_cli_ids   uuid[];
  v_ordens    integer;
  v_funcs     integer;
  v_clientes  integer;
begin
  if p_oficina_doc is null or btrim(p_oficina_doc) = '' then
    raise exception 'Informe a oficina.' using errcode = '22023';
  end if;

  -- Trava a conta: dois pedidos de exclusão ao mesmo tempo não se atropelam.
  perform 1 from public.admins where doc = p_oficina_doc for update;
  if not found then
    raise exception 'Oficina não encontrada.' using errcode = 'P0002';
  end if;

  -- O que precisa ser lembrado antes de apagar: sessões e contadores de tentativa apontam para
  -- o id/e-mail dos funcionários e do dono, sem chave estrangeira.
  select coalesce(array_agg(id::text), '{}') into v_func_ids
    from public.funcionarios where oficina_doc = p_oficina_doc;
  select coalesce(array_agg(lower(e)) filter (where e is not null), '{}') into v_emails
    from (select email as e from public.funcionarios where oficina_doc = p_oficina_doc
          union all
          select email from public.admins where doc = p_oficina_doc) t;
  select coalesce(array_agg(id), '{}') into v_cli_ids
    from public.customers where origem = 'oficina' and oficina_origem_doc = p_oficina_doc;

  -- ── Orçamentos, estoque e OS ────────────────────────────────────────────
  delete from public.orcamento_links   where oficina_doc = p_oficina_doc;
  delete from public.estoque_reservas  where oficina_doc = p_oficina_doc;
  delete from public.orcamento_itens   where oficina_doc = p_oficina_doc;
  delete from public.orcamentos        where oficina_doc = p_oficina_doc;
  delete from public.ordem_fotos       where oficina_doc = p_oficina_doc;

  -- ── Financeiro (reserva de caixa antes dos lançamentos que a originam) ──
  delete from public.financeiro_reservas    where oficina_doc = p_oficina_doc;
  delete from public.financeiro_transacoes  where oficina_doc = p_oficina_doc;

  -- ── Agenda ──────────────────────────────────────────────────────────────
  delete from public.appointments       where oficina_doc = p_oficina_doc;
  delete from public.availability_slots where oficina_doc = p_oficina_doc;

  -- ── Estoque e catálogo (kit_itens e movimentos antes dos itens: FK restrita) ──
  delete from public.estoque_kit_itens  where oficina_doc = p_oficina_doc;
  delete from public.estoque_kits       where oficina_doc = p_oficina_doc;
  delete from public.estoque_movimentos where oficina_doc = p_oficina_doc;
  delete from public.estoque_itens      where oficina_doc = p_oficina_doc;
  delete from public.servicos           where oficina_doc = p_oficina_doc;

  delete from public.ordens where oficina_doc = p_oficina_doc;
  get diagnostics v_ordens = row_count;

  -- ── Carteira: convites, vínculos, veículos e cadastros de balcão ────────
  delete from public.oficina_convites where oficina_doc = p_oficina_doc;

  -- Veículos que só existiam por causa desta oficina: de cliente de balcão ou sem dono nenhum.
  delete from public.customer_vehicles
   where customer_id = any (v_cli_ids)
      or (oficina_origem_doc = p_oficina_doc and customer_id is null);
  -- Veículo de conta do app que a oficina cadastrou: fica com o cliente, só perde a marca da oficina.
  update public.customer_vehicles set oficina_origem_doc = null
   where oficina_origem_doc = p_oficina_doc;

  delete from public.oficina_clientes where oficina_doc = p_oficina_doc;

  delete from public.customers where id = any (v_cli_ids);
  get diagnostics v_clientes = row_count;

  -- ── Equipe e sessões ────────────────────────────────────────────────────
  delete from public.funcionarios where oficina_doc = p_oficina_doc;
  get diagnostics v_funcs = row_count;

  delete from public.alertas_dispensados where oficina_doc = p_oficina_doc;
  delete from public.auth_refresh_tokens where doc = p_oficina_doc or funcionario_id = any (v_func_ids);
  delete from public.auth_reset_tokens   where doc = p_oficina_doc;
  delete from public.auth_rate_limit     where bucket = any (v_func_ids || v_emails)
                                            or bucket = 'conta:' || p_oficina_doc;

  -- ── A conta ─────────────────────────────────────────────────────────────
  delete from public.admins where doc = p_oficina_doc;

  return jsonb_build_object('ordens', v_ordens, 'funcionarios', v_funcs, 'clientes', v_clientes);
end;
$$;

comment on function public.conta_excluir_oficina(text) is
  'Apaga a oficina e todos os dados dela numa transação (ver 0010_excluir_conta.sql). Só o backend (service_role) chama.';

-- Função destrutiva: nunca exposta a anon/authenticated (PostgREST /rpc).
revoke execute on function public.conta_excluir_oficina(text) from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.conta_excluir_oficina(text) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.conta_excluir_oficina(text) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0010', 'conta_excluir_oficina(): exclusão atômica da conta do dono e de todos os dados da oficina')
on conflict (versao) do nothing;

commit;
