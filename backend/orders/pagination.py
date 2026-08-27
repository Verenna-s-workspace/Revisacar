"""Paginação opt-in para as listagens.

Sem `?page`, as views devolvem a lista completa (comportamento histórico — o
dashboard depende de receber todas as OS para os agregados do mês). Com `?page`,
devolvem um envelope `{items, page, pageSize, total, totalPages}` usando o
`.range()` + `count='exact'` do Postgrest, sem carregar tudo na memória.
"""
from math import ceil

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def _to_int(value, fallback):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def parse_pagination(query_params, default_size=DEFAULT_PAGE_SIZE, max_size=MAX_PAGE_SIZE):
    """Retorna (page, page_size) quando `?page` está presente; senão None.

    page é normalizado para >= 1 e page_size é limitado a [1, max_size] — assim
    um cliente não consegue pedir 1 milhão de linhas de uma vez."""
    if "page" not in query_params:
        return None
    page = max(1, _to_int(query_params.get("page"), 1))
    size = _to_int(query_params.get("page_size"), default_size)
    size = max(1, min(size, max_size))
    return page, size


def paginate(query, page, page_size, transform=None):
    """Aplica o intervalo da página a uma query Postgrest (já com
    `count='exact'`) e devolve o envelope. `transform` opcional é aplicado a
    cada item (ex.: derivar campos como `vencido`)."""
    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.range(start, end).execute()
    items = res.data or []
    if transform is not None:
        items = [transform(item) for item in items]
    total = getattr(res, "count", None) or 0
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": ceil(total / page_size) if page_size else 0,
    }
