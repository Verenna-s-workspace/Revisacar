-- ─────────────────────────────────────────────────────────────────────────
-- Ordens de serviço por oficina (multi-tenant)
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Por quê: até agora `public.ordens` não sabia de qual oficina era cada OS,
-- então toda oficina via as ordens de todas as outras (inclusive nos
-- Relatórios). Este script adiciona `oficina_doc` e preenche as OS antigas.
--
-- Pré-requisito: public.admins (coluna doc UNIQUE).
--
-- ATENÇÃO — depois de rodar o backend novo, OS com `oficina_doc` vazio
-- NÃO aparecem mais pra ninguém. O bloco "preencher OS antigas" abaixo
-- resolve sozinho quando existe UMA oficina só; com mais de uma, ele avisa
-- e você preenche na mão (exemplo comentado no fim).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.ordens
  add column if not exists oficina_doc text references public.admins(doc);

-- Relatórios e a listagem filtram por oficina + data de criação.
create index if not exists ordens_oficina_created_idx
  on public.ordens (oficina_doc, created_at);

-- ── preencher OS antigas ────────────────────────────────────────────────
do $$
declare
  qtd_admins integer;
  qtd_sem_oficina integer;
begin
  select count(*) into qtd_sem_oficina from public.ordens where oficina_doc is null;
  if qtd_sem_oficina = 0 then
    return;
  end if;

  select count(*) into qtd_admins from public.admins;
  if qtd_admins = 1 then
    update public.ordens
       set oficina_doc = (select doc from public.admins limit 1)
     where oficina_doc is null;
    raise notice 'ordens: % OS antigas associadas à única oficina cadastrada.', qtd_sem_oficina;
  else
    raise notice 'ordens: % OS sem oficina e % oficinas cadastradas — preencha manualmente (veja o exemplo no fim do arquivo).',
      qtd_sem_oficina, qtd_admins;
  end if;
end $$;

grant all on public.ordens to service_role;

notify pgrst, 'reload schema';

-- Exemplo de preenchimento manual (troque pelo doc da oficina dona das OS):
--   update public.ordens set oficina_doc = '00000000000191' where oficina_doc is null;
