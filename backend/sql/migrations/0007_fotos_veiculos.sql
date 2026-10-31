-- 0007 — Fotos dos veículos (tela Veículos)
-- Rode no SQL Editor do Supabase (ou via Supabase CLI). Idempotente.
--
-- As fotos do veículo (principal + adicionais) não eram gravadas: o backend ignorava os campos e a
-- tela voltava para a imagem padrão da categoria. Passam a ser gravadas do mesmo jeito que a foto dos
-- itens do estoque (`estoque_itens.foto_data_url`): o navegador comprime a imagem e envia como data
-- URL; o backend valida e guarda no próprio registro.
--
-- Colunas novas (em vez de reaproveitar `foto_principal_path`, da 0003, que é reservada a um caminho
-- no Storage e é lida pelo app do cliente):
--   foto_data_url      foto principal (data URL de imagem ou URL https)
--   fotos_adicionais   lista (jsonb) de até 5 fotos no mesmo formato
--
-- A foto do CLIENTE não precisa de coluna nova: usa `customers.avatar_url`, que já existe (e só é
-- gravada para cadastro de balcão; conta do app continua sendo do próprio cliente).
--
-- Só adiciona colunas; nada do que existe muda. Sem rodar este script a tela de Veículos continua
-- funcionando — só não grava foto (a resposta manda rodar a 0007).

begin;

alter table public.customer_vehicles add column if not exists foto_data_url    text;
alter table public.customer_vehicles add column if not exists fotos_adicionais jsonb not null default '[]'::jsonb;

alter table public.customer_vehicles drop constraint if exists customer_vehicles_fotos_adicionais_check;
alter table public.customer_vehicles add  constraint customer_vehicles_fotos_adicionais_check
  check (jsonb_typeof(fotos_adicionais) = 'array' and jsonb_array_length(fotos_adicionais) <= 5);

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0007', 'customer_vehicles.foto_data_url e fotos_adicionais: fotos dos veículos gravadas no banco')
on conflict (versao) do nothing;

commit;
