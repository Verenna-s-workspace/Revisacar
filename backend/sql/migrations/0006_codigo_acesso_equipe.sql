-- 0006 — Código de acesso da equipe (login de funcionário em qualquer aparelho)
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente.
--
-- O login de funcionário (nome + PIN) precisa saber de qual oficina listar os nomes. Até aqui isso
-- era o CNPJ digitado e guardado no navegador de cada aparelho. Agora a oficina tem um código curto
-- (8 caracteres, sem 0/O/1/I/L) que vira um link /f/<código>: abrir o link em qualquer computador
-- já deixa o aparelho pronto. O dono gera, renova (o código antigo para de funcionar) ou desativa
-- em Configurações. NULL = a oficina não gerou código (o link não existe).
--
-- Só adiciona uma coluna; nada do que existe muda.

begin;

alter table public.admins add column if not exists codigo_acesso text;

-- Único entre as oficinas; vários NULL são permitidos.
create unique index if not exists admins_codigo_acesso_key
  on public.admins (codigo_acesso) where codigo_acesso is not null;

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0006', 'admins.codigo_acesso: código curto da oficina para o link de acesso da equipe')
on conflict (versao) do nothing;

commit;
