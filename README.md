# RevisaCar

**Sistema SaaS de gestão para oficinas mecânicas** — ordens de serviço, agenda,
clientes, veículos, estoque, financeiro e relatórios, com dashboard web e login
por PIN para funcionários.

- **Backend:** Django + Django REST Framework (sem ORM) sobre **Supabase** (Postgres + Storage)
- **Frontend:** React 18 + TypeScript + Vite (PWA)
- **Auth:** JWT HS256 + refresh token, multi-tenant por CNPJ, RBAC por cargo

---

## Arquitetura

```
backend/
  DjangoSet/          settings (setting.py), urls raiz, wsgi
  orders/             domínio único da API
    views.py            ordens, auth admin/funcionário, fotos, JWT
    financeiro_views.py transações e resumo financeiro
    serializers.py      contrato camelCase ⇄ snake_case + validações
    rbac.py             cargos e permissões (fonte única de verdade)
    tests/              pytest (JWT, serializers, RBAC)
frontend/
  src/
    features/Dashboard/ telas do dashboard (Ordens, Clientes, Financeiro, ...)
    features/Checklist/ fluxo de inspeção/criação de OS
    hooks/              um hook por domínio (useDashboard, useClientes, ...)
    utils/              api client, relatórios, utilitários puros (+ testes)
    types/              tipos TypeScript por entidade
```

### Multi-tenancy
Cada oficina é um tenant identificado pelo **CNPJ (`doc`)**, que viaja no JWT.
Toda tabela de negócio tem `oficina_doc`; toda listagem filtra por ela e toda
criação a carimba. Placa é única *por oficina*.

### Autenticação e RBAC
JWT HS256 assinado com `DJANGO_SECRET_KEY` (access token curto + refresh token).
Cargos: `dono`, `gerente`, `mecanico`, `atendente`. As permissões são resolvidas
no backend (`orders/rbac.py`) e viajam no claim `permissoes` do token — o
frontend apenas espelha o que vem resolvido, nunca decide sozinho.

---

## Rodando localmente

Pré-requisitos: **Python 3.12+**, **Node 20+** e um projeto **Supabase**.

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt                  # runtime + ferramentas de teste
cp .env.example supabase.env                          # e preencha os valores reais
python manage.py runserver                            # http://127.0.0.1:8000
```

As variáveis de ambiente são carregadas de `backend/supabase.env`
(veja [`backend/.env.example`](backend/.env.example) para a lista completa).
Mínimo para subir: `DJANGO_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://127.0.0.1:8000" > .env.local   # opcional; é o default
npm run dev                                              # http://localhost:5173
```

O frontend aponta para a API via `VITE_API_URL` (default `http://127.0.0.1:8000`,
definido em `src/constants/index.ts`).

---

## Testes

```bash
# Backend — pytest (não faz rede nem banco; usa env dummy via pytest-env)
cd backend && source .venv/bin/activate && pytest

# Frontend — Vitest
cd frontend && npm test
```

Cobertura atual: JWT (roundtrip/adulteração/expiração), validações de
serializer (CNPJ com dígito verificador, PIN, placa, email), RBAC por cargo, e
lógica pura de relatórios/dashboard (faturamento real vs. estimado).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em cada push/PR para `main`:

- **Backend:** flake8 + pytest
- **Frontend:** typecheck (`tsc --noEmit`) + Vitest + build

---

## API (principais rotas)

Base: raiz da API. Todas as rotas de negócio exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/admin/signup` · `/admin/login` · `/admin/refresh` | Auth do dono |
| GET/POST | `/funcionarios` · `/funcionarios/login-pin` | Funcionários + login por PIN |
| GET | `/me` | Sessão atual (dono ou funcionário) |
| GET/POST | `/ordens` · `/ordens/<id>` | Ordens de serviço |
| POST/DELETE | `/ordens/<id>/fotos` | Upload/remoção de fotos (valida magic bytes) |
| GET | `/financeiro/resumo` | Faturamento, despesas, saldo (lucro se `financeiro.ver_margem`) |
| GET/POST | `/financeiro/transacoes` | Transações financeiras |

---

## Deploy

- **Frontend:** Vercel (build `npm run build`, `VITE_API_URL` apontando para a API)
- **Backend:** Render (`gunicorn DjangoSet.wsgi`) com as variáveis do `.env.example`
  configuradas no painel. Em produção defina `DEBUG=False` e `ALLOWED_HOSTS` com
  os domínios reais.

---

## Roadmap técnico (follow-ups priorizados)

Itens já tratados: hardening de settings (SECRET_KEY/DEBUG/ALLOWED_HOSTS por env),
validação de CNPJ, validação de MIME no upload, logging estruturado, KPIs do
dashboard vindos do financeiro real, **sessões e rate-limiting persistidos no
Supabase** (`orders/auth_store.py` — antes viviam em memória), suíte de testes +
CI verde.

> **Setup do banco:** rode [`backend/db/migrations/0001_auth_persistence.sql`](backend/db/migrations/0001_auth_persistence.sql)
> no Supabase para criar as tabelas de sessão/rate-limit.

**Paginação opt-in** já disponível na API (`?page`/`?page_size` em `/ordens` e
`/financeiro/transacoes`, ver `orders/pagination.py`) com cliente tipado no front
(`api.listarOrdensPagina`, `api.listarTransacoesPagina`). Sem `?page`, o
comportamento é o de sempre (lista completa). Falta só **adotar na UI** das telas
de lista (controles de página / scroll infinito).

Pendências conhecidas, em ordem de prioridade:

1. **Adotar paginação na UI** das telas de Ordens e Financeiro.
2. **`react-router`** com URLs reais (hoje o roteamento é por `useState`).
3. **OpenAPI/Swagger** (`drf-spectacular`) para documentação viva da API.
4. **Migrations versionadas** do schema completo (o schema de negócio ainda é
   gerido manualmente no Supabase) e índices em `oficina_doc` / `status` /
   `data_competencia`.
