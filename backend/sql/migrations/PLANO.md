# RevisaCar — plano do banco compartilhado (mecânico ↔ cliente)

Data: 2026-10-23 · Base: `main` do RevisaCar e do RevisaCar-Client, dump do Supabase enviado por você.

## 1. Quem manda no schema: SQL versionado (não Django)

Você pediu Django, a menos que fosse pior. É pior neste caso, por quatro motivos que conferi no código:

1. **O mecânico não usa o ORM do Django.** Ele grava no banco pelo cliente do Supabase (`supabase.table(...)`). Um schema dono do Django só descreveria metade do banco.
2. **O Django do cliente já não consegue migrar.** O `start.sh` roda `migrate` a cada boot e tolera falha em silêncio. Como as tabelas-base já existiam (criadas pelo `schema.sql` antigo) e `django_migrations` está vazio, o `migrate` tenta recriar `customers`, falha, e o app segue sem 6 tabelas e 1 coluna que o código usa. É a divergência que o dump mostrou.
3. **O que a integração precisa o Django não expressa:** chaves estrangeiras compostas `(oficina_doc, id)` que impedem uma OS de apontar para cliente de outra oficina, índices parciais, funções plpgsql atômicas, RLS. Isso viraria `RunSQL` de qualquer jeito.
4. **O mecânico já trabalha em SQL idempotente** que você roda no Supabase. É o mesmo fluxo, só que agora com registro (`schema_migrations`).

Custo a assumir: o Django do cliente continua com as migrations dele só para os testes (CI usa sqlite). Quando um campo novo entrar no model, ele entra também numa migration SQL daqui. Em produção o Django deixa de criar/alterar tabelas (ver 4.2).

## 2. O que foi entregue (`db/migrations/`)

Rodar no SQL Editor do Supabase, **nesta ordem**, um por vez. Todos são idempotentes.

| Arquivo | O que faz | Mexe em dados? |
|---|---|---|
| `0000_controle.sql` | Cria `schema_migrations` e registra o estado atual como `baseline`. | Não |
| `0001_limpeza_segura.sql` | Remove `clientes`, `kits`, `estoque` **só se vazias**; valida as constraints `NOT VALID`; remove `customers.pin_hash` (sem uso, se vazia); `ordens.oficina_doc` vira `NOT NULL`. Lista as políticas RLS que sobraram. | Só apaga tabela vazia. Com linhas, aborta tudo e diz qual. |
| `0002_tabelas_app_cliente.sql` | Cria as 6 tabelas e a coluna que o app do cliente usa e o banco não tem (QR, documentos, rate limit, tokens de senha e e-mail, push, `email_verified`). | Não |
| `0003_integracao_cliente_oficina.sql` | O modelo unificado (seção 3). Só adiciona e relaxa; nada do código atual quebra. | Não (dados existentes ficam como estão) |

**Antes de começar, faça um backup** (Supabase → Database → Backups, ou `pg_dump`). A 0001 só apaga tabela vazia, mas backup é o seu rollback real para ela. A 0002 e a 0003 são aditivas.

Se a 0001 terminar com `WARNING ... NÃO registrada`, ela aplicou parcialmente: resolva a pendência que o aviso aponta e rode de novo. **Não rode a 0002 antes** (ela confere isso e se recusa).

## 3. O modelo (migration 0003)

- `customers` = a pessoa. `origem = 'app'` (conta com senha, e-mail único entre contas do app) ou `'oficina'` (cadastro de balcão, sem senha, **privado da oficina que cadastrou**: outra oficina pode ter o mesmo e-mail ou CPF sem colidir e sem descobrir).
- `oficina_clientes` = a ponte (carteira da oficina). Vínculo `ativo` exige `confirmado_em`. Cadastro de balcão cria o vínculo sozinho (trigger); os demais precisam de consentimento do cliente.
- `oficina_convites` + função `oficina_convite_usar`: a oficina gera link/QR, o cliente do app entra na carteira. O código do convite é o próprio `id` (uuid aleatório), assim os dois backends o validam sem segredo compartilhado; expira (padrão 7 dias, máx. 90), tem limite de usos opcional e é revogável. Se a própria oficina revogou o vínculo, o convite não reativa.
- Função `oficina_vinculo_responder`: o cliente aceita ou recusa um pedido da oficina; só o dono do vínculo consegue.
- `ordens.customer_id` e `ordens.vehicle_id`, `appointments.oficina_doc`, `mecanico_id`, `ordem_id`, `hora_fim`, remarcação. FKs compostas garantem no banco que OS e agendamento só apontam para cliente da própria oficina e OS da própria oficina.
- Status de agendamento unificado: `pendente → confirmado | recusado`, depois `em_andamento → aguardando_pagamento → pronto_retirada → concluido`, e `cancelado`. O `agendado` do mecânico passa a ser `confirmado`.

## 4. Mudanças de código que precisam acontecer

### 4.1 Obrigatória ANTES de o mecânico cadastrar qualquer cliente de balcão

`customer_api/services.py`, `get_customer_by_email`: hoje é `Customer.objects.filter(email=email).first()`, sem filtro de origem e sem ordem. Depois da 0003 pode existir um cadastro de balcão com o mesmo e-mail de uma conta do app. No teste local o login pegou a linha certa, mas **por ordem de inserção, sem garantia**. Trocar para `filter(email__iexact=email, origem="app")` (o model precisa do campo `origem`, ou usar `.extra`/SQL) e conferir o `pwhash` antes de aceitar. Vale para qualquer outra busca por e-mail ou CPF no app do cliente (recuperação de senha, verificação de e-mail).

### 4.2 Parar de deixar o Django criar tabelas em produção

- Rodar uma vez `python manage.py migrate --fake` (marca 0001–0004 como aplicadas) e **tirar o `migrate` do `start.sh`**.
- Adicionar ao model os campos novos que o app for usar (`origem`, `oficina_doc` em agendamentos etc.) junto com a migration Django equivalente, para os testes.

### 4.3 Backend do mecânico — FEITO (branch `feat/carteira-clientes-veiculos-agendamentos`)

Rotas novas, todas com `oficina_doc` do token, permissões do RBAC (`clientes.ver/editar`, ver `orders/rbac.py`) e testes de isolamento (`tests/test_carteira.py`, Postgres real):

- `/clientes` (GET/POST), `/clientes/<id>` (GET/PATCH/DELETE): carteira da oficina. Cadastro de balcão (CPF/CNPJ e e-mail únicos **por oficina**; recadastrar um arquivado o reativa). Cliente com conta no app: a oficina só edita as próprias `observacoes`. Excluir = arquivar o vínculo.
- `/clientes/convites` (GET/POST) e `/clientes/convites/<id>` (DELETE): gera/revoga o convite (`dias` 1–90, padrão 7; `maxUsos` opcional). O código é o próprio `id` do convite. A oficina **nunca** puxa conta do app por e-mail/CPF; quem entra na carteira é o cliente, usando o convite.
- `/veiculos` (GET/POST), `/veiculos/<id>` (GET/PATCH/DELETE): veículos dos clientes da carteira + os cadastrados pela própria oficina sem dono. Dono em texto (nome/CPF) cadastra ou reaproveita o cliente; dono por `clienteId` exige estar na carteira. Placa única entre os veículos visíveis. Excluir = soft delete. Status do veículo é derivado da última OS.
- `/agendamentos` (GET/POST), `/agendamentos/<id>` (GET/PATCH/DELETE): lê os pedidos `pendente` do app, confirma/recusa (com motivo), reagenda (guarda data/hora anterior) e liga à OS da mesma oficina. Confirmar/recusar avisa o cliente do app em `notifications`; cliente de balcão não recebe aviso.
- OS ↔ carteira (`orders/os_vinculo.py`): ao salvar uma OS, liga `customer_id`/`vehicle_id` por documento ou e-mail do cliente e pela placa, **só dentro da carteira da oficina**, sem criar nada e sem nunca derrubar o salvamento da OS. É isso que deixa o cliente do app ver os orçamentos da oficina onde está vinculado.
- Ainda não: fotos de veículo não são gravadas (o campo é ignorado); a oficina enxerga todos os veículos dos clientes vinculados; nunca devolver `orcamento_itens.custo_unitario` ao app do cliente (vale para as rotas futuras).

### 4.4 App do cliente

- Tela e rota para usar um convite (escaneia o QR, chama `oficina_convite_usar`).
- Pedido de agendamento passa a informar a oficina (`oficina_doc`); `availability_slots` por oficina.
- Ler orçamentos de `orcamentos` pela OS do cliente (e aposentar `estimates`/`estimate_items`, vazias hoje).

## 5. Fase seguinte (0004, ainda não escrita de propósito)

Só depois do código acima estar no ar: `appointments.oficina_doc NOT NULL`, unicidade de placa por dono (`plate_norm`), remover `estimates`, `estimate_items`, `service_history*` (se continuarem vazias e sem uso) e as tabelas do Django (`django_content_type`, `auth_*`; exige `UNAUTHENTICATED_USER: None` no DRF do mecânico e testar). Apertar antes quebraria o código atual.

## 6. Como foi testado e o que NÃO foi

Testado num Postgres 18.4 local, com baseline reconstruído a partir do seu dump (36 tabelas, colunas idênticas) e os scripts reais do mecânico aplicados por cima:

- 0000→0003 aplicam do zero; reaplicar duas vezes não dá erro.
- 20 casos de comportamento: isolamento entre oficinas (e-mail/CPF privados, OS e agendamento só para cliente da carteira, OS de outra oficina rejeitada), constraints de status e horário, convite (expirado, esgotado, conta de balcão, vínculo revogado pela oficina), anon sem acesso às tabelas novas.
- Travas da 0001: tabela legada com linha → aborta e não muda nada; pendências → avisa e não se registra.
- Dados antigos de cliente, veículo e agendamento sobrevivem à 0003.
- O Django real do app do cliente, apontado para o banco migrado: 16 models e 143 campos sem divergência, e o fluxo cliente→veículo→agendamento→QR funciona.

As rotas novas do mecânico têm 73 testes próprios (`tests/test_carteira.py`; suíte completa: 720) rodando contra Postgres real com as migrações aplicadas, incluindo a 0001 numa transação descartável.

Não testado: o **seu** Supabase (versão do Postgres, extensões, papéis); `backend/db/rls.sql` do cliente contra o banco novo; o app do cliente usando convite/pedido de agendamento (ainda não escrito). `ON DELETE SET NULL (coluna)` exige Postgres 15+.

## 7. Pendências suas

1. **Política `er` em `admins`**: verificado, `anon`/`authenticated` não leem a tabela. Opcional: `drop policy if exists "er" on public.admins;`.
2. **Decidir o RLS do cliente.** O `rls.sql` dele (role `revisacar_app`) e o `seguranca_rls.sql` do mecânico (RLS sem policy, backend como dono/service_role) se contradizem. As tabelas `oficina_*` não têm policy; se o cliente trocar para `revisacar_app`, elas retornam zero linhas. Sugestão: manter o modelo do mecânico (backend como dono, sem exposição pública) e **não** aplicar o `rls.sql` do cliente até decidirmos.
