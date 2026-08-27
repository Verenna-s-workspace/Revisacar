-- 0001_auth_persistence.sql
-- Persistência de sessões e rate-limiting de autenticação.
-- Rode no SQL editor do Supabase (ou via Supabase CLI). Idempotente.
--
-- Substitui os dicionários em memória que viviam em orders/views.py
-- (REFRESH_TOKENS, PASSWORD_RESET_TOKENS, PIN_ATTEMPTS, RESET_REQUESTS).
-- Guardamos apenas o hash SHA-256 dos tokens — nunca o token em texto.

-- ── Refresh tokens (sessões) ────────────────────────────────────────────────
create table if not exists auth_refresh_tokens (
    token_hash      text primary key,
    tipo            text not null,            -- 'dono' | 'funcionario'
    doc             text,                     -- CNPJ da oficina (dono)
    funcionario_id  text,                     -- id do funcionário (funcionario)
    nome            text,
    email           text,
    expires_at      double precision not null,-- epoch (segundos)
    created_at      timestamptz default now()
);
create index if not exists idx_refresh_doc on auth_refresh_tokens (doc);
create index if not exists idx_refresh_funcionario on auth_refresh_tokens (funcionario_id);
create index if not exists idx_refresh_expires on auth_refresh_tokens (expires_at);

-- ── Tokens de reset de senha ────────────────────────────────────────────────
create table if not exists auth_reset_tokens (
    token_hash  text primary key,
    doc         text,
    email       text,
    expires_at  double precision not null,
    used        boolean default false,
    created_at  timestamptz default now()
);
create index if not exists idx_reset_expires on auth_reset_tokens (expires_at);

-- ── Rate limiting (tentativas de PIN e pedidos de reset) ────────────────────
create table if not exists auth_rate_limit (
    id          uuid primary key default gen_random_uuid(),
    bucket      text not null,   -- funcionario_id (PIN) ou email (reset)
    kind        text not null,   -- 'pin' | 'reset_request'
    created_at  double precision not null  -- epoch (segundos)
);
create index if not exists idx_rate_bucket_kind on auth_rate_limit (bucket, kind);

-- ── Limpeza opcional (rode periodicamente, ex.: pg_cron) ────────────────────
-- delete from auth_refresh_tokens where expires_at < extract(epoch from now());
-- delete from auth_reset_tokens   where expires_at < extract(epoch from now());
-- delete from auth_rate_limit     where created_at < extract(epoch from now()) - 3600;
