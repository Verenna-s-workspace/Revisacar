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
    for nome in ("estoque.sql", "servicos.sql", "ordens_oficina.sql", "visao_geral.sql", "financeiro.sql", "ordens_status.sql", "orcamentos.sql", "ordens_execucao.sql", "alertas.sql", "orcamento_link.sql", "ordens_fotos.sql"):
        sql = (BACKEND_DIR / "sql" / nome).read_text(encoding="utf-8")
        cur.execute(sql)
        cur.execute(sql)  # idempotência: rodar duas vezes não pode falhar

    # Tabelas do app do cliente e funcionarios (no Supabase vêm do dump/Django/painel). Cópia fiel
    # do estado de produção ANTES das migrations 0001-0003 de backend/sql/migrations.
    cur.execute(
        """
        create table public.funcionarios (
          id uuid primary key default gen_random_uuid(),
          oficina_doc text not null references public.admins(doc),
          nome text not null,
          email text not null unique,
          pin_hash text not null default 'x',
          cargo text not null check (cargo in ('gerente','mecanico','atendente')),
          ativo boolean not null default true,
          created_at timestamptz not null default now()
        );
        create table public.customers (
          id uuid primary key, name text not null, email text not null unique, phone text, cpf text,
          address text, pwhash text not null, avatar_url text,
          created_at timestamptz default now(), updated_at timestamptz default now(), pin_hash text
        );
        create table public.customer_vehicles (
          id uuid primary key, customer_id uuid references public.customers(id),
          brand text not null, model text not null, year integer not null, plate text not null,
          color text, fuel_type text default 'flex', mileage integer default 0, vin text, renavam text,
          notes text, is_active boolean default true, deleted boolean default false,
          created_at timestamptz default now(), updated_at timestamptz default now()
        );
        create table public.appointments (
          id uuid primary key, customer_id uuid references public.customers(id),
          vehicle_id uuid references public.customer_vehicles(id), vehicle_label text,
          service_type text not null, service_description text, date date not null,
          time_slot time not null, status text default 'pendente', notes text, rejection_reason text,
          created_at timestamptz default now(), updated_at timestamptz default now()
        );
        create table public.notifications (
          id uuid primary key default gen_random_uuid(), customer_id uuid references public.customers(id),
          title text not null, message text, type text not null, is_read boolean default false,
          action_url text, created_at timestamptz default now()
        );
        create table public.availability_slots (
          id uuid primary key default gen_random_uuid(), date date not null, time_slot time not null,
          is_available boolean default true
        );
        """
    )
    # Migrations versionadas (db): controle, limpeza, tabelas do app do cliente, integração.
    for nome in ("0000_controle.sql", "0001_limpeza_segura.sql", "0002_tabelas_app_cliente.sql",
                 "0003_integracao_cliente_oficina.sql", "0005_config_oficina.sql", "0006_codigo_acesso_equipe.sql",
                 "0007_fotos_veiculos.sql"):
        sql = (BACKEND_DIR / "sql" / "migrations" / nome).read_text(encoding="utf-8")
        cur.execute(sql)
        cur.execute(sql)  # idempotência
    # A 0001 torna ordens.oficina_doc obrigatória (produção). Os testes históricos de
    # ordens_oficina.sql precisam da coluna opcional; test_carteira.py cobre a 0001 em transação.
    cur.execute("alter table public.ordens alter column oficina_doc drop not null")
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
        "public.ordens, public.financeiro_transacoes, public.orcamentos, public.orcamento_itens, public.alertas_dispensados, "
        "public.appointments, public.customer_vehicles, public.oficina_convites, public.oficina_clientes, "
        "public.customers, public.notifications, public.funcionarios cascade"
    )
    cur.execute("update public.admins set meta_mensal = null, config_oficina = null, config_oficina_em = null, codigo_acesso = null")
    yield conn
    conn.close()
