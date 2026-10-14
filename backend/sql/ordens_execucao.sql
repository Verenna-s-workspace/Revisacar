-- ─────────────────────────────────────────────────────────────────────────
-- Execução e conclusão da OS — Fase 5 do orçamento
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Pré-requisitos (rode antes): ordens_status.sql, estoque.sql e orcamentos.sql
-- (que cria `estoque_reservas`).
--
-- O que faz
--   • `ordens` ganha `concluida_em`, `concluida_por_nome` e `obs_conclusao`;
--   • `ordem_concluir(...)`: conclui o serviço (status → 'finalizada') e BAIXA
--     DO ESTOQUE o que a OS tinha reservado, tudo numa transação só:
--       - trava a OS e os itens de estoque envolvidos;
--       - se faltar peça física (reservado > quantidade em estoque) e o chamador
--         não pediu pra ignorar, NADA muda e a função devolve as `faltas`;
--       - com `p_ignorar_faltas`, baixa só o que existe (o estoque nunca fica
--         negativo) e informa o que faltou em cada baixa;
--       - grava um movimento 'saida' por item (ligado à OS) e libera a reserva.
--   • Os lançamentos pendentes do Financeiro NÃO mudam aqui: concluir o serviço
--     não é receber o pagamento (isso é o Financeiro).
--
-- Quais status de OS aceitam a conclusão vem do backend (ordem_status.py).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.ordens add column if not exists concluida_em        timestamptz;
alter table public.ordens add column if not exists concluida_por_nome  text;
alter table public.ordens add column if not exists obs_conclusao       text;

-- Retorna jsonb:
--   {ok: true, os_status, concluida_em, baixas: [{item_id, nome, reservado, baixado, faltou}]}
--   {ok: false, codigo: nao_encontrado | os_status | estoque_insuficiente,
--    mensagem, os_status?, faltas?: [{item_id, nome, necessario, disponivel}]}

create or replace function public.ordem_concluir(
  p_oficina_doc    text,
  p_ordem_id       text,
  p_os_permitidos  jsonb,
  p_os_novo        text,
  p_ignorar_faltas boolean,
  p_obs            text,
  p_nome           text,
  p_agora          text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_os_status text;
  v_os_num    text;
  v_faltas    jsonb;
  v_baixas    jsonb := '[]'::jsonb;
  v_rec       record;
  v_baixar    numeric;
  v_motivo    text;
  v_versao    integer;
  v_agora     timestamptz := now();
begin
  select status, os_num into v_os_status, v_os_num from public.ordens
   where id = p_ordem_id and oficina_doc = p_oficina_doc for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'OS não encontrada.');
  end if;

  if not (p_os_permitidos ? coalesce(v_os_status, 'rascunho')) then
    return jsonb_build_object('ok', false, 'codigo', 'os_status', 'os_status', v_os_status,
      'mensagem', 'A OS está em "' || coalesce(v_os_status, 'rascunho') || '" e não pode ser concluída agora.');
  end if;

  -- Trava os itens de estoque reservados (sempre na mesma ordem: por id).
  perform 1 from public.estoque_itens e
    where e.oficina_doc = p_oficina_doc
      and e.id in (select item_id from public.estoque_reservas
                    where oficina_doc = p_oficina_doc and ordem_id = p_ordem_id)
    order by e.id for update;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', r.item_id, 'nome', e.nome, 'necessario', r.quantidade, 'disponivel', e.quantidade
         ) order by e.nome), '[]'::jsonb)
    into v_faltas
    from public.estoque_reservas r
    join public.estoque_itens e on e.oficina_doc = r.oficina_doc and e.id = r.item_id
   where r.oficina_doc = p_oficina_doc and r.ordem_id = p_ordem_id and r.quantidade > e.quantidade;

  if jsonb_array_length(v_faltas) > 0 and not coalesce(p_ignorar_faltas, false) then
    return jsonb_build_object('ok', false, 'codigo', 'estoque_insuficiente', 'faltas', v_faltas,
      'mensagem', 'Não há estoque suficiente de alguma peça reservada para esta OS.');
  end if;

  select o.versao into v_versao
    from public.orcamentos o
   where o.oficina_doc = p_oficina_doc and o.ordem_id = p_ordem_id and o.status = 'aprovado'
   order by o.versao desc limit 1;
  v_motivo := format('%s%s', coalesce(v_os_num, p_ordem_id),
                     case when v_versao is null then '' else format(' (orçamento v%s)', v_versao) end);

  for v_rec in
    select r.item_id, e.nome, r.quantidade as reservado, e.quantidade as fisico
      from public.estoque_reservas r
      join public.estoque_itens e on e.oficina_doc = r.oficina_doc and e.id = r.item_id
     where r.oficina_doc = p_oficina_doc and r.ordem_id = p_ordem_id
     order by e.nome
  loop
    v_baixar := least(v_rec.reservado, v_rec.fisico);
    if v_baixar > 0 then
      update public.estoque_itens set quantidade = quantidade - v_baixar
       where oficina_doc = p_oficina_doc and id = v_rec.item_id;
      insert into public.estoque_movimentos (oficina_doc, item_id, tipo, quantidade, motivo, ordem_servico_id)
      values (p_oficina_doc, v_rec.item_id, 'saida', v_baixar, v_motivo, p_ordem_id);
    end if;
    v_baixas := v_baixas || jsonb_build_object(
      'item_id', v_rec.item_id, 'nome', v_rec.nome, 'reservado', v_rec.reservado,
      'baixado', v_baixar, 'faltou', v_rec.reservado - v_baixar);
  end loop;

  delete from public.estoque_reservas where oficina_doc = p_oficina_doc and ordem_id = p_ordem_id;

  update public.ordens
     set status = p_os_novo, updated_at = p_agora, concluida_em = v_agora,
         concluida_por_nome = nullif(p_nome, ''), obs_conclusao = nullif(btrim(coalesce(p_obs, '')), '')
   where id = p_ordem_id and oficina_doc = p_oficina_doc;

  return jsonb_build_object('ok', true, 'os_status', p_os_novo, 'concluida_em', v_agora, 'baixas', v_baixas);
end;
$$;

grant all on public.ordens to service_role;
grant execute on function public.ordem_concluir(text, text, jsonb, text, boolean, text, text, text) to service_role;

notify pgrst, 'reload schema';
