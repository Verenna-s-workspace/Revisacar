-- 0011 — Placa única por oficina nos veículos cadastrados por ela
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente. Depois da 0003.
--
-- Por que: o checklist (OS) passa a cadastrar o veículo sozinho quando a placa não existe. O backend
-- confere a placa antes de criar, mas dois salvamentos ao mesmo tempo (duplo clique, rascunho + botão,
-- duas abas) podem passar pela conferência juntos e criar o mesmo veículo duas vezes. Este índice faz o
-- banco recusar o segundo (23505); o backend então usa o veículo que já foi criado.
--
-- Escopo: só veículos com `oficina_origem_doc` (os cadastrados pela própria oficina, que é o que o
-- checklist cria) e que não foram excluídos. Veículo de conta do app (`oficina_origem_doc` nulo) não
-- entra: a placa dele já é conferida no backend contra a carteira e pode mudar de dono entre contas.
-- Veículo excluído (soft delete) libera a placa para ser cadastrada de novo.
--
-- Se já existir placa repetida na MESMA oficina, o índice NÃO é criado: o script avisa quais são e termina
-- sem registrar a migration. Resolva (exclua ou corrija o repetido na tela Veículos) e rode de novo.
-- Sem esta migration o cadastro automático continua funcionando; só fica sem a trava do banco.
--
-- Só cria índice; nenhum dado é alterado.

begin;

do $$
declare
  repetidas text;
begin
  select string_agg(format('%s (oficina %s, %s veículos)', plate_norm, oficina_origem_doc, qtd), '; ')
    into repetidas
  from (
    select oficina_origem_doc, plate_norm, count(*) as qtd
    from public.customer_vehicles
    where oficina_origem_doc is not null and deleted is not true
    group by oficina_origem_doc, plate_norm
    having count(*) > 1
  ) d;

  if repetidas is not null then
    raise warning '0011 NÃO aplicada: há placas repetidas na mesma oficina: %. Resolva e rode de novo.', repetidas;
  else
    create unique index if not exists customer_vehicles_placa_oficina_uk
      on public.customer_vehicles (oficina_origem_doc, plate_norm)
      where oficina_origem_doc is not null and deleted is not true;

    insert into public.schema_migrations (versao, descricao)
    values ('0011', 'customer_vehicles: placa única por oficina (veículos cadastrados pela própria oficina)')
    on conflict (versao) do nothing;
  end if;
end $$;

commit;
