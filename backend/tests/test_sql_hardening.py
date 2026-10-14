"""Endurecimento dos scripts SQL (linter de segurança do Supabase)."""
import psycopg2


def test_funcoes_do_app_fixam_search_path(pg_dsn, db):
    """Toda função `public.*` criada pelos scripts precisa ter `search_path` fixo
    (lint 0011_function_search_path_mutable)."""
    with psycopg2.connect(pg_dsn) as conn, conn.cursor() as cur:
        cur.execute(
            """
            select p.proname, p.proconfig
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              join pg_language l on l.oid = p.prolang
             where n.nspname = 'public' and l.lanname = 'plpgsql'
            """
        )
        linhas = cur.fetchall()
    assert linhas, "nenhuma função plpgsql encontrada — scripts não rodaram?"
    sem = [nome for nome, cfg in linhas if not any(c.startswith("search_path=") for c in (cfg or []))]
    assert sem == [], f"funções sem search_path fixo: {sem}"
