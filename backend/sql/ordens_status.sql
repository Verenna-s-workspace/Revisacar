-- ─────────────────────────────────────────────────────────────────────────
-- Status da ordem de serviço (ordens.status)
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- O que faz:
--   • OS sem status (NULL) passa a 'rascunho';
--   • trava o vocabulário de status com um CHECK;
--   • avisa (NOTICE) se existir OS com status fora do vocabulário.
--
-- Vocabulário (ver backend/orders/ordem_status.py):
--   rascunho, em_orcamento, pendente_aprovacao, aprovada, em_execucao,
--   aguardando, finalizada (= serviço concluído), recusada
--
-- Nenhuma OS existente muda de status além das que estavam NULL: as
-- 'finalizada' de hoje continuam 'finalizada' (e continuam contando nos
-- Relatórios / Visão Geral). O que muda é o COMPORTAMENTO do backend novo:
-- salvar um checklist completo deixa de marcar a OS como 'finalizada'.
--
-- O CHECK entra NOT VALID: vale para tudo que for gravado de agora em diante,
-- sem revalidar as linhas antigas. Se o aviso abaixo listar status estranhos,
-- corrija-os e depois rode:
--   alter table public.ordens validate constraint ordens_status_check;
-- ─────────────────────────────────────────────────────────────────────────

alter table public.ordens alter column status set default 'rascunho';

update public.ordens set status = 'rascunho' where status is null;

do $$
declare
  fora integer;
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ordens'::regclass and conname = 'ordens_status_check'
  ) then
    alter table public.ordens
      add constraint ordens_status_check
      check (status in ('rascunho', 'em_orcamento', 'pendente_aprovacao', 'aprovada',
                        'em_execucao', 'aguardando', 'finalizada', 'recusada')) not valid;
  end if;

  select count(*) into fora from public.ordens
   where status not in ('rascunho', 'em_orcamento', 'pendente_aprovacao', 'aprovada',
                        'em_execucao', 'aguardando', 'finalizada', 'recusada');
  if fora > 0 then
    raise notice 'ordens: % OS com status fora do vocabulário — corrija antes de validar a constraint.', fora;
  end if;
end $$;

grant all on public.ordens to service_role;

notify pgrst, 'reload schema';
