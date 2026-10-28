-- 0004 — Persistência de sessões e rate-limiting de autenticação
-- Rode no SQL editor do Supabase (ou via Supabase CLI). Idempotente.
--
-- Substitui os dicionários em memória que viviam em orders/views.py
-- (REFRESH_TOKENS, PASSWORD_RESET_TOKENS, PIN_ATTEMPTS, RESET_REQUESTS).
-- Guardamos apenas o hash SHA-256 dos tokens — nunca o token em texto.

-- ── Refresh tokens (sessões) ────────────────────────────────────────────────
create table if not exists public.auth_refresh_tokens (
    token_hash      text primary key,
    tipo            text not null,            -- 'dono' | 'funcionario'
    doc             text,                     -- CNPJ da oficina (dono)
    funcionario_id  text,                     -- id do funcionário (funcionario)
    nome            text,
    email           text,
    expires_at      double precision not null,-- epoch (segundos)
    created_at      timestamptz default now()
);
create index if not exists idx_refresh_doc on public.auth_refresh_tokens (doc);
create index if not exists idx_refresh_funcionario on public.auth_refresh_tokens (funcionario_id);
create index if not exists idx_refresh_expires on public.auth_refresh_tokens (expires_at);

-- ── Tokens de reset de senha ────────────────────────────────────────────────
create table if not exists public.auth_reset_tokens (
    token_hash  text primary key,
    doc         text,
    email       text,
    expires_at  double precision not null,
    used        boolean default false,
    created_at  timestamptz default now()
);
create index if not exists idx_reset_expires on public.auth_reset_tokens (expires_at);

-- ── Rate limiting (tentativas de PIN e pedidos de reset) ────────────────────
create table if not exists public.auth_rate_limit (
    id          uuid primary key default gen_random_uuid(),
    bucket      text not null,   -- funcionario_id (PIN) ou email (reset)
    kind        text not null,   -- 'pin' | 'reset_request'
    created_at  double precision not null  -- epoch (segundos)
);
create index if not exists idx_rate_bucket_kind on public.auth_rate_limit (bucket, kind);

-- ── Segurança: só o backend (service_role) acessa ────────────────────────────
-- Sem isso, a chave anon do projeto conseguiria inserir um refresh token forjado
-- e abrir sessão como dono. RLS ligada e sem policy = anon/authenticated não veem nada.
-- (auth_rate_limit já tem RLS desde a 0002.)
alter table public.auth_refresh_tokens enable row level security;
alter table public.auth_reset_tokens   enable row level security;
revoke all on public.auth_refresh_tokens from anon, authenticated;
revoke all on public.auth_reset_tokens   from anon, authenticated;
grant  all on public.auth_refresh_tokens to service_role;
grant  all on public.auth_reset_tokens   to service_role;

-- ── Limpeza de linhas vencidas (rode de vez em quando, ou agende no pg_cron) ──
-- delete from public.auth_refresh_tokens where expires_at < extract(epoch from now());
-- delete from public.auth_reset_tokens   where expires_at < extract(epoch from now());
-- delete from public.auth_rate_limit     where created_at < extract(epoch from now()) - 3600;

notify pgrst, 'reload schema';

insert into public.schema_migrations (versao, descricao)
values ('0004', 'auth: refresh/reset tokens persistidos + RLS')
on conflict (versao) do nothing;
