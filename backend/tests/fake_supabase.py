"""
Emulador mínimo do cliente Supabase (PostgREST) em cima de um Postgres REAL.

Só existe nos testes: traduz a parte do supabase-py que o backend de Estoque
usa (table().select/insert/update/delete + eq/in_/gte/order/range/limit, e
rpc) para SQL, e devolve linhas no mesmo formato JSON que o PostgREST devolve
(numeric → número, timestamptz → ISO, uuid → string). Assim as views rodam
contra as tabelas e funções SQL de verdade; só a tradução HTTP→SQL é simulada.
O que NÃO cobre: o comportamento do PostgREST em si (limite de 1000 linhas,
cache de schema) — o limite é emulado em `max_linhas`.
"""
import datetime
import decimal
import re
import uuid

import psycopg2
import psycopg2.extras
from postgrest.exceptions import APIError

_IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


class _Resposta:
    def __init__(self, data):
        self.data = data


def _json_safe(valor):
    if isinstance(valor, decimal.Decimal):
        return float(valor)
    if isinstance(valor, (datetime.datetime, datetime.date)):
        return valor.isoformat()
    if isinstance(valor, uuid.UUID):
        return str(valor)
    return valor


def _ident(nome: str) -> str:
    assert _IDENT.match(nome), f"identificador inválido: {nome}"
    return f'"{nome}"'


def _adaptar(valor):
    # list/dict viram json (o PostgREST faz o mesmo com o corpo da chamada).
    if isinstance(valor, (list, dict)):
        return psycopg2.extras.Json(valor)
    return valor


class _Consulta:
    def __init__(self, fake, tabela):
        self.fake, self.tabela = fake, tabela
        self.op, self.payload = "select", None
        self.filtros, self.ordens = [], []
        self.faixa, self.limite = None, None

    # --- operações
    def select(self, _colunas="*"):
        self.op = "select"
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    # --- filtros / ordenação
    def eq(self, col, val):
        self.filtros.append((col, "=", val))
        return self

    def gte(self, col, val):
        self.filtros.append((col, ">=", val))
        return self

    def in_(self, col, vals):
        self.filtros.append((col, "in", list(vals)))
        return self

    def order(self, col, desc=False):
        self.ordens.append((col, desc))
        return self

    def range(self, ini, fim):
        self.faixa = (ini, fim)
        return self

    def limit(self, n):
        self.limite = n
        return self

    # --- execução
    def _where(self):
        partes, params = [], []
        for col, op, val in self.filtros:
            if op == "in":
                partes.append(f"{_ident(col)}::text = any(%s)")
                params.append([str(v) for v in val])
            else:
                partes.append(f"{_ident(col)} {op} %s")
                params.append(val)
        return (" where " + " and ".join(partes)) if partes else "", params

    def execute(self):
        self.fake.chamadas.append((self.op, self.tabela))
        if (self.op, self.tabela) in self.fake.falhar_em:
            raise APIError({"message": "falha simulada", "code": self.fake.falhar_em[(self.op, self.tabela)]})
        tabela = _ident(self.tabela)
        where, params = self._where()

        if self.op == "insert":
            linhas = self.payload if isinstance(self.payload, list) else [self.payload]
            colunas = list(linhas[0].keys())
            valores = ", ".join(["(" + ", ".join(["%s"] * len(colunas)) + ")"] * len(linhas))
            sql = f"insert into {tabela} ({', '.join(_ident(c) for c in colunas)}) values {valores} returning *"
            params = [_adaptar(l[c]) for l in linhas for c in colunas]
        elif self.op == "update":
            sets = ", ".join(f"{_ident(c)} = %s" for c in self.payload)
            sql = f"update {tabela} set {sets}{where} returning *"
            params = [_adaptar(v) for v in self.payload.values()] + params
        elif self.op == "delete":
            sql = f"delete from {tabela}{where} returning *"
        else:
            sql = f"select * from {tabela}{where}"
            if self.ordens:
                sql += " order by " + ", ".join(f"{_ident(c)}{' desc' if d else ''}" for c, d in self.ordens)
            if self.faixa:
                ini, fim = self.faixa
                fim = min(fim, ini + self.fake.max_linhas - 1)   # teto do PostgREST
                sql += f" limit {fim - ini + 1} offset {ini}"
            elif self.limite:
                sql += f" limit {int(self.limite)}"
            else:
                sql += f" limit {self.fake.max_linhas}"

        return _Resposta(self.fake._rodar(sql, params))


class _Rpc:
    def __init__(self, fake, nome, params):
        self.fake, self.nome, self.params = fake, nome, params

    def execute(self):
        self.fake.chamadas.append(("rpc", self.nome))
        if ("rpc", self.nome) in self.fake.falhar_em:
            raise APIError({"message": "falha simulada", "code": self.fake.falhar_em[("rpc", self.nome)]})
        argumentos = ", ".join(f"{_ident(k)} => %s" for k in self.params)
        sql = f"select {_ident(self.nome)}({argumentos}) as resultado"
        linhas = self.fake._rodar(sql, [_adaptar(v) for v in self.params.values()], bruto=True)
        return _Resposta(linhas[0]["resultado"])


class FakeSupabase:
    def __init__(self, dsn, max_linhas=1000):
        self.conn = psycopg2.connect(dsn)
        self.conn.autocommit = True
        with self.conn.cursor() as cur:
            cur.execute("set timezone = 'UTC'")   # o Supabase devolve timestamptz em UTC
        self.max_linhas = max_linhas
        self.chamadas = []            # [(operação, tabela|função)] pra os testes inspecionarem
        self.falhar_em = {}           # {(operação, tabela|função): código SQLSTATE} que devem levantar APIError

    def table(self, nome):
        return _Consulta(self, nome)

    def rpc(self, nome, params):
        return _Rpc(self, nome, params)

    def _rodar(self, sql, params, bruto=False):
        try:
            with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                linhas = cur.fetchall() if cur.description else []
        except psycopg2.Error as e:
            raise APIError({
                "message": (e.diag.message_primary if e.diag else None) or str(e),
                "code": e.pgcode,
                "details": e.diag.message_detail if e.diag else None,
                "hint": None,
            })
        if bruto:
            return linhas
        return [{k: _json_safe(v) for k, v in l.items()} for l in linhas]

    def close(self):
        self.conn.close()
