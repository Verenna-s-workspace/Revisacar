-- ─────────────────────────────────────────────────────────────────────────
-- Link público do orçamento — Fase 6 (parte A)
--
-- Rode este script inteiro no SQL Editor do Supabase. É idempotente: pode
-- rodar de novo sem quebrar nada nem apagar dado.
--
-- Pré-requisito: orcamentos.sql (e, antes dele, ordens_oficina.sql etc.).
--
-- O que faz
--   • `orcamento_links`: um link por orçamento ENVIADO. O cliente abre o link no
--     celular (sem conta), vê o orçamento e aprova ou recusa.
--   • O TOKEN do link NÃO fica no banco: ele é derivado do `id` desta tabela com
--     uma chave secreta do servidor (HMAC). Quem vazar o banco não consegue
--     montar nenhum link; a oficina ainda pode ver o mesmo link de novo.
--   • Só UM link ativo (não revogado) por orçamento. Gerar um novo revoga o anterior.
--   • Guarda quantos acessos teve, quando abriu pela primeira/última vez e a
--     decisão do cliente (aprovou/recusou, com nome e IP) — a oficina vê isso e
--     a tela de Alertas usa.
--   • `orcamentos.aprovacao_canal` passa a aceitar 'link' (aprovado pelo cliente
--     no link). O "Aprovar" da própria oficina continua usando os outros canais.
--   • Três funções (atômicas, com trava de linha, na mesma ordem de trava das
--     de orcamentos.sql: OS → orçamento → link, pra nunca dar deadlock):
--       orcamento_link_criar   gera (ou devolve o ativo; ou renova)
--       orcamento_link_acessou conta um acesso
--       orcamento_link_decidir aprova ou recusa pelo link, reaproveitando
--                              orcamento_aprovar / orcamento_recusar (mesmos
--                              efeitos: Financeiro, reserva de Estoque, status da OS)
--
-- Tabela privada (RLS ligada, sem policy): só o backend (service_role) acessa.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Canal 'link' na aprovação ────────────────────────────────────────────
-- (a trava original é de coluna, com nome automático)
alter table public.orcamentos drop constraint if exists orcamentos_aprovacao_canal_check;
alter table public.orcamentos add constraint orcamentos_aprovacao_canal_check
  check (aprovacao_canal in ('whatsapp', 'presencial', 'telefone', 'app', 'link', 'outro')) not valid;


-- ── Links ────────────────────────────────────────────────────────────────

create table if not exists public.orcamento_links (
  id                 uuid primary key default gen_random_uuid(),
  oficina_doc        text not null references public.admins(doc),
  orcamento_id       uuid not null references public.orcamentos(id) on delete cascade,
  criado_por_nome    text not null default '',
  created_at         timestamptz not null default now(),
  -- Limite de vida do link (além da validade do próprio orçamento).
  expira_em          timestamptz not null,
  revogado_em        timestamptz,
  acessos            integer not null default 0,
  primeiro_acesso_em timestamptz,
  ultimo_acesso_em   timestamptz,
  decidido_em        timestamptz,
  decisao            text check (decisao in ('aprovado', 'recusado')),
  decisao_nome       text,
  decisao_ip         text
);

create index if not exists orcamento_links_orcamento_idx on public.orcamento_links (orcamento_id);
create index if not exists orcamento_links_oficina_decisao_idx
  on public.orcamento_links (oficina_doc, decidido_em) where decidido_em is not null;
-- No máximo um link ativo por orçamento.
create unique index if not exists orcamento_links_ativo_uk
  on public.orcamento_links (orcamento_id) where revogado_em is null;

alter table public.orcamento_links enable row level security;


-- ── Função: criar / devolver / renovar o link ────────────────────────────
-- Só orçamento ENVIADO tem link. Com um link ativo e dentro do prazo, devolve o
-- mesmo (`criado` = false) — a menos que p_renovar: aí revoga e cria outro.
-- Retorna jsonb: {ok, codigo, mensagem, criado, link: {…linha…}}.

create or replace function public.orcamento_link_criar(
  p_oficina_doc text,
  p_orcamento_id uuid,
  p_nome        text,
  p_dias        integer,
  p_renovar     boolean
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ordem_id text;
  v_status   text;
  v_link     public.orcamento_links%rowtype;
  v_criado   boolean := false;
begin
  select ordem_id into v_ordem_id
    from public.orcamentos where id = p_orcamento_id and oficina_doc = p_oficina_doc;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado', 'mensagem', 'Orçamento não encontrado.');
  end if;

  -- Mesma ordem de trava das funções de aprovar/recusar: OS → orçamento → link.
  perform 1 from public.ordens where id = v_ordem_id and oficina_doc = p_oficina_doc for update;
  select status into v_status from public.orcamentos
   where id = p_orcamento_id and oficina_doc = p_oficina_doc for update;

  if v_status <> 'enviado' then
    return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_status,
      'mensagem', 'Só dá pra gerar o link de um orçamento que já foi enviado ao cliente.');
  end if;

  select * into v_link from public.orcamento_links
   where orcamento_id = p_orcamento_id and revogado_em is null for update;

  if found and (p_renovar or v_link.expira_em <= now() or v_link.decidido_em is not null) then
    update public.orcamento_links set revogado_em = now() where id = v_link.id;
    v_link := null;
  end if;

  if v_link.id is null then
    insert into public.orcamento_links (oficina_doc, orcamento_id, criado_por_nome, expira_em)
    values (p_oficina_doc, p_orcamento_id, coalesce(p_nome, ''), now() + make_interval(days => p_dias))
    returning * into v_link;
    v_criado := true;
  end if;

  return jsonb_build_object('ok', true, 'criado', v_criado, 'link', to_jsonb(v_link));
end;
$$;


-- ── Função: contar um acesso ─────────────────────────────────────────────

create or replace function public.orcamento_link_acessou(p_link_id uuid)
returns void
language sql
set search_path = public
as $$
  update public.orcamento_links
     set acessos = acessos + 1,
         primeiro_acesso_em = coalesce(primeiro_acesso_em, now()),
         ultimo_acesso_em = now()
   where id = p_link_id;
$$;


-- ── Função: decidir pelo link ────────────────────────────────────────────
-- p_decisao: 'aprovar' | 'recusar'. Só decide orçamento ENVIADO, com link
-- ativo e dentro do prazo (e, pra aprovar, dentro da validade do orçamento).
-- Reusa orcamento_aprovar / orcamento_recusar, então os efeitos são os mesmos
-- de quando a oficina aprova. Quais status de OS aceitam a mudança vem do backend.
-- Retorna o jsonb da função reaproveitada (+ oficina_doc e orcamento_id quando ok)
-- ou {ok:false, codigo: link_invalido | link_revogado | link_expirado | …}.

create or replace function public.orcamento_link_decidir(
  p_link_id       uuid,
  p_decisao       text,
  p_os_permitidos jsonb,
  p_os_novo       text,
  p_hoje          date,
  p_nome          text,
  p_obs           text,
  p_ip            text,
  p_agora         text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_link      public.orcamento_links%rowtype;
  v_ordem_id  text;
  v_status    text;
  v_resultado jsonb;
begin
  select * into v_link from public.orcamento_links where id = p_link_id;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'link_invalido', 'mensagem', 'Link inválido.');
  end if;

  select ordem_id into v_ordem_id from public.orcamentos
   where id = v_link.orcamento_id and oficina_doc = v_link.oficina_doc;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'link_invalido', 'mensagem', 'Link inválido.');
  end if;

  -- OS → orçamento → link (ver orcamento_link_criar).
  perform 1 from public.ordens where id = v_ordem_id and oficina_doc = v_link.oficina_doc for update;
  select status into v_status from public.orcamentos where id = v_link.orcamento_id for update;
  select * into v_link from public.orcamento_links where id = p_link_id for update;

  if v_link.revogado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'link_revogado',
      'mensagem', 'Este link foi substituído. Peça um novo à oficina.');
  end if;
  if v_link.expira_em <= now() then
    return jsonb_build_object('ok', false, 'codigo', 'link_expirado',
      'mensagem', 'Este link expirou. Peça um novo à oficina.');
  end if;

  if p_decisao = 'aprovar' then
    v_resultado := public.orcamento_aprovar(
      v_link.oficina_doc, v_link.orcamento_id, p_os_permitidos, p_os_novo, p_hoje,
      'link', p_obs, p_nome, p_agora);
  elsif p_decisao = 'recusar' then
    -- orcamento_recusar também recusa um orçamento já aprovado; pelo link só vale enquanto está "enviado".
    if v_status <> 'enviado' then
      return jsonb_build_object('ok', false, 'codigo', 'status_invalido', 'status', v_status,
        'mensagem', 'Este orçamento já foi respondido.');
    end if;
    v_resultado := public.orcamento_recusar(
      v_link.oficina_doc, v_link.orcamento_id, p_os_permitidos, p_os_novo, p_obs, p_agora);
  else
    return jsonb_build_object('ok', false, 'codigo', 'decisao_invalida', 'mensagem', 'Decisão inválida.');
  end if;

  if (v_resultado ->> 'ok')::boolean then
    update public.orcamento_links
       set decidido_em = now(),
           decisao = case when p_decisao = 'aprovar' then 'aprovado' else 'recusado' end,
           decisao_nome = nullif(p_nome, ''),
           decisao_ip = nullif(p_ip, '')
     where id = p_link_id;
    v_resultado := v_resultado || jsonb_build_object(
      'oficina_doc', v_link.oficina_doc, 'orcamento_id', v_link.orcamento_id);
  end if;
  return v_resultado;
end;
$$;


grant all on public.orcamento_links to service_role;
grant execute on function public.orcamento_link_criar(text, uuid, text, integer, boolean) to service_role;
grant execute on function public.orcamento_link_acessou(uuid) to service_role;
grant execute on function public.orcamento_link_decidir(uuid, text, jsonb, text, date, text, text, text, text) to service_role;

-- Pede pro PostgREST recarregar o cache de tabelas e funções.
notify pgrst, 'reload schema';
