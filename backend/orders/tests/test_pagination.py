"""Testes da paginação opt-in (orders/pagination.py)."""
from orders.pagination import parse_pagination, paginate, MAX_PAGE_SIZE
from orders.tests.fake_supabase import FakeSupabase


# ── parse_pagination ──────────────────────────────────────────────────────────

def test_sem_page_retorna_none():
    assert parse_pagination({}) is None
    assert parse_pagination({"status": "finalizada"}) is None


def test_page_default_size():
    assert parse_pagination({"page": "2"}) == (2, 50)


def test_page_size_custom_e_limitado():
    assert parse_pagination({"page": "1", "page_size": "20"}) == (1, 20)
    # acima do teto -> limitado a MAX_PAGE_SIZE
    assert parse_pagination({"page": "1", "page_size": "9999"}) == (1, MAX_PAGE_SIZE)


def test_valores_invalidos_normalizados():
    assert parse_pagination({"page": "abc"}) == (1, 50)          # page inválida -> 1
    assert parse_pagination({"page": "0"}) == (1, 50)           # page < 1 -> 1
    assert parse_pagination({"page": "-5"}) == (1, 50)
    assert parse_pagination({"page": "1", "page_size": "0"}) == (1, 1)  # size < 1 -> 1


# ── paginate ──────────────────────────────────────────────────────────────────

def _seed(n):
    sb = FakeSupabase()
    for i in range(n):
        sb.table("t").insert({"id": i, "created_at": i}).execute()
    return sb


def test_paginate_primeira_pagina():
    sb = _seed(12)
    q = sb.table("t").select("*", count="exact").order("created_at", desc=True)
    env = paginate(q, page=1, page_size=5)
    assert env["total"] == 12
    assert env["totalPages"] == 3
    assert env["page"] == 1
    assert env["pageSize"] == 5
    assert len(env["items"]) == 5
    assert env["items"][0]["id"] == 11  # desc: mais recente primeiro


def test_paginate_ultima_pagina_parcial():
    sb = _seed(12)
    q = sb.table("t").select("*", count="exact").order("created_at", desc=True)
    env = paginate(q, page=3, page_size=5)
    assert len(env["items"]) == 2  # 12 - 10
    assert env["items"][0]["id"] == 1


def test_paginate_transform_aplicado():
    sb = _seed(3)
    q = sb.table("t").select("*", count="exact")
    env = paginate(q, page=1, page_size=10, transform=lambda r: {**r, "marcado": True})
    assert all(item["marcado"] for item in env["items"])


def test_paginate_vazio():
    sb = _seed(0)
    q = sb.table("t").select("*", count="exact")
    env = paginate(q, page=1, page_size=10)
    assert env == {"items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0}
