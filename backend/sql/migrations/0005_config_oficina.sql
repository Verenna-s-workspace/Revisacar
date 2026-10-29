-- 0005 — Dados da oficina (tela Configurações) no banco
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente.
--
-- Nome comercial, telefone, e-mail de atendimento, endereço, taxa de mão de obra e horário de
-- funcionamento ficavam só no navegador (localStorage 'oficina_config'): outro aparelho não via, e
-- o horário da Agenda podia ser diferente em cada um. Passam a ficar na linha da oficina em
-- `admins`, como a meta mensal (visao_geral.sql). O formato é o JSON da API (ver
-- orders/oficina_config_views.py); o CNPJ continua sendo `admins.doc` e não entra aqui.

begin;

alter table public.admins add column if not exists config_oficina    jsonb;
alter table public.admins add column if not exists config_oficina_em timestamptz;

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0005', 'admins.config_oficina: dados da oficina da tela Configurações')
on conflict (versao) do nothing;

commit;
