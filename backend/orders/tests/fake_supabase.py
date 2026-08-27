"""Duplo mínimo do client Supabase para testar a camada de persistência sem
banco real. Suporta só o subconjunto do query-builder usado por auth_store:
insert / select / delete / update encadeados com .eq() e .execute()."""


class _Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Query:
    def __init__(self, table):
        self._table = table
        self._filters = []
        self._op = None
        self._payload = None
        self._count = None
        self._order = None
        self._range = None

    def insert(self, row):
        self._op = "insert"
        self._payload = row
        return self

    def select(self, *_columns, count=None):
        self._op = "select"
        self._count = count
        return self

    def order(self, column, desc=False):
        self._order = (column, desc)
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def delete(self):
        self._op = "delete"
        return self

    def update(self, patch):
        self._op = "update"
        self._payload = patch
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def _match(self, row):
        return all(row.get(col) == val for col, val in self._filters)

    def execute(self):
        rows = self._table.rows
        if self._op == "insert":
            saved = dict(self._payload)
            rows.append(saved)
            return _Result([saved])
        if self._op == "select":
            matched = [r for r in rows if self._match(r)]
            if self._order is not None:
                column, desc = self._order
                matched = sorted(matched, key=lambda r: r.get(column), reverse=desc)
            total = len(matched)
            if self._range is not None:
                start, end = self._range
                matched = matched[start:end + 1]
            return _Result(matched, count=total if self._count else None)
        if self._op == "delete":
            removed = [r for r in rows if self._match(r)]
            self._table.rows = [r for r in rows if not self._match(r)]
            return _Result(removed)
        if self._op == "update":
            matched = [r for r in rows if self._match(r)]
            for r in matched:
                r.update(self._payload)
            return _Result(matched)
        return _Result([])


class _Table:
    def __init__(self):
        self.rows = []


class FakeSupabase:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        self.tables.setdefault(name, _Table())
        return _Query(self.tables[name])

    def rows(self, name):
        return self.tables.setdefault(name, _Table()).rows
