"""
Fixtures dos testes do backend.

Os testes de Estoque rodam contra um Postgres REAL e descartável (pacote
`pixeltable-pgserver`, só pra desenvolvimento — ver requirements-dev.txt),
porque o que importa validar é o SQL de verdade: constraints, funções,
travas de linha e concorrência. Nada aqui encosta no seu Supabase.

Se o pacote não estiver instalado, os testes que dependem dele são pulados.
"""
import os
import pathlib
import sys
import tempfile

import pytest

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Env mínima pra DjangoSet.setting importar sem o supabase.env real.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
# JWT de mentira (só formato) — o client do supabase valida a forma da chave.
os.environ.setdefault(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJyb2xlIjoic2VydmljZV9yb2xlIn0."
    "c2lnbmF0dXJlLWRlLXRlc3Rl",
)
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "DjangoSet.setting")

OFICINA_A = "11111111000191"
OFICINA_B = "22222222000191"


@pytest.fixture(scope="session")
def pg_dsn():
    try:
        import pixeltable_pgserver as pgserver
    except ImportError:  # pragma: no cover
        pytest.skip("pixeltable-pgserver não instalado (pip install -r requirements-dev.txt)")

    pgdata = pathlib.Path(tempfile.mkdtemp(prefix="revisacar_pgtest_"))
    server = pgserver.get_server(pgdata, cleanup_mode="stop")
    dsn = server.get_uri()

    import psycopg2

    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    # Stub mínimo da tabela que o estoque referencia (a real vive no Supabase).
    cur.execute(
        """
        create table public.admins (
          id integer generated always as identity primary key,
          nome text not null,
          doc text not null unique,
          pwhash text not null default 'x',
          created_at timestamptz not null default now(),
          email text unique
        );
        insert into public.admins (nome, doc) values ('Oficina A', %s), ('Oficina B', %s);
        """,
        (OFICINA_A, OFICINA_B),
    )
    # Stubs das tabelas legadas que o Supabase já tem (criadas fora destes scripts).
    # `fotos_paths` é jsonb aqui só porque o emulador adapta listas como json;
    # no Supabase real é text[] e os testes nunca leem esse campo.
    cur.execute(
        """
        create table public.ordens (
          id text primary key,
          created_at text not null,
          updated_at text not null,
          os_num text, placa text, modelo text, cliente text,
          status text default 'rascunho',
          payload text not null,
          fotos_paths jsonb
        );
        create table public.financeiro_transacoes (
          id uuid primary key default gen_random_uuid(),
          oficina_doc text not null,
          tipo text not null check (tipo in ('entrada','saida')),
          categoria text not null,
          descricao text default '',
          valor numeric not null check (valor > 0),
          forma_pagamento text,
          status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
          data_competencia date not null,
          data_vencimento date,
          data_pagamento timestamptz,
          cliente_nome text default '',
          ordem_servico_id text,
          criado_por_nome text default '',
          criado_por_tipo text default '',
          created_at timestamptz not null default now()
        );
        """
    )
    # No Supabase esse papel já existe; os GRANTs dos scripts dependem dele.
    cur.execute("do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') "
                "then create role service_role; end if; end $$")
    # Ordem importa: servicos.sql usa estoque_kits (limpeza do vínculo ao excluir).
    for nome in ("estoque.sql", "servicos.sql", "ordens_oficina.sql", "visao_geral.sql", "financeiro.sql"):
        sql = (BACKEND_DIR / "sql" / nome).read_text(encoding="utf-8")
        cur.execute(sql)
        cur.execute(sql)  # idempotência: rodar duas vezes não pode falhar
    conn.close()

    yield dsn
    server.cleanup()


@pytest.fixture()
def db(pg_dsn):
    """Conexão autocommit com as tabelas de estoque, serviços, ordens e financeiro limpas."""
    import psycopg2

    conn = psycopg2.connect(pg_dsn)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "truncate public.estoque_movimentos, public.estoque_kit_itens, "
        "public.estoque_kits, public.estoque_itens, public.servicos, "
        "public.ordens, public.financeiro_transacoes cascade"
    )
    cur.execute("update public.admins set meta_mensal = null")
    yield conn
    conn.close()
