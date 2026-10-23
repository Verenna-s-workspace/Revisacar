-- ─────────────────────────────────────────────────────────────────────────
-- Fotos obrigatórias da entrada do veículo (registro de confiabilidade)
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Pré-requisitos: public.admins e public.ordens com `oficina_doc`
-- (rode ordens_oficina.sql antes).
--
-- Modelo
--   • 5 itens fixos por OS (`slot`): hodometro, frente, traseira,
--     lateral_direita, lateral_esquerda. A lista é fixa no código
--     (orders/fotos_obrigatorias.py), sem tabela de configuração por enquanto.
--   • `ordem_fotos` guarda UMA linha por OS e item. O item está resolvido quando
--     tem foto (situacao = 'foto', com `path` no Storage) OU foi pulado com
--     motivo (situacao = 'pulada', com `motivo`). Refazer a foto (ou trocar
--     "pulada" por foto) substitui a linha e soma 1 em `refeitas`.
--   • Quem tirou/pulou e quando: `por_nome`, `por_tipo` (dono/funcionario),
--     `por_id` e `em`. O nome e a hora vêm do TOKEN e do servidor, nunca do
--     que o navegador manda.
--   • As fotos adicionais (livres) continuam em `ordens.fotos_paths`.
--   • Apagar a OS apaga as linhas daqui (a foto no Storage é removida pelo
--     backend, junto com as outras da pasta da OS).
--
-- Regra "sem as 5 resolvidas a OS não sai de rascunho" é do backend
-- (PUT /ordens/<id>); aqui o banco só garante que cada linha faz sentido.
-- ─────────────────────────────────────────────────────────────────────────

-- Permite a chave estrangeira composta (oficina_doc, ordem_id): a foto só pode
-- apontar pra uma OS da MESMA oficina. (Mesmo nome usado por orcamentos.sql.)
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ordens'::regclass and conname = 'ordens_oficina_id_uk'
  ) then
    alter table public.ordens add constraint ordens_oficina_id_uk unique (oficina_doc, id);
  end if;
end $$;

create table if not exists public.ordem_fotos (
  id          uuid primary key default gen_random_uuid(),
  oficina_doc text not null references public.admins(doc),
  ordem_id    text not null,
  slot        text not null
                check (slot in ('hodometro', 'frente', 'traseira', 'lateral_direita', 'lateral_esquerda')),
  situacao    text not null check (situacao in ('foto', 'pulada')),
  -- Caminho no bucket (<ordem_id>/obrig-<slot>-<uuid>.jpg). Só quando situacao = 'foto'.
  path        text,
  -- Motivo curto de não ter tirado a foto. Só quando situacao = 'pulada'.
  motivo      text,
  por_nome    text not null default '',
  por_tipo    text not null default '' check (por_tipo in ('', 'dono', 'funcionario')),
  por_id      text,
  em          timestamptz not null default now(),
  refeitas    integer not null default 0 check (refeitas >= 0),
  constraint ordem_fotos_ordem_fk
    foreign key (oficina_doc, ordem_id) references public.ordens (oficina_doc, id) on delete cascade,
  constraint ordem_fotos_slot_uk unique (ordem_id, slot),
  constraint ordem_fotos_coerente check (
    (situacao = 'foto'   and path is not null and motivo is null)
    or
    (situacao = 'pulada' and path is null and motivo is not null
                         and char_length(btrim(motivo)) between 3 and 120)
  )
);

create index if not exists ordem_fotos_oficina_ordem_idx
  on public.ordem_fotos (oficina_doc, ordem_id);

-- Só o backend (service_role) acessa; sem policy, anon/authenticated não leem nada.
alter table public.ordem_fotos enable row level security;

grant all on public.ordem_fotos to service_role;

notify pgrst, 'reload schema';
