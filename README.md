## Supabase Tables Required for Revisacar

### 1. admins table
```sql
-- Table for workshop owners (donos da oficina)
create table admins(
    id uuid primary key default gen_random_uuid(),
    nome varchar(100) not null,
    doc varchar(14) not null unique,  -- CNPJ da oficina ( apenas números )
    email varchar(255) not null unique,
    pwhash varchar(255) not null,     -- senha hashada
    created_at timestamptz default now()
);
```

### 2. funcionarios table
```sql
-- Table for workshop employees (funcionários)
create table funcionarios(
    id uuid primary key default gen_random_uuid(),
    nome varchar(100) not null,
    email varchar(255) not null unique,
    pin_hash varchar(255) not null,   -- PIN hashado ( nunca armazenado em texto plano )
    cargo varchar(20) not null check (cargo in ('gerente', 'mecanico', 'atendente')),
    ativo boolean not null default true,
    created_at timestamptz default now(),
    oficina_doc varchar(14) not null,
    foreign key (oficina_doc) references admins(doc)
);
```

### 3. ordens table (ordens de serviço)
```sql
-- Table for service orders
create table ordens(
    id uuid primary key default gen_random_uuid(),
    os_num text not null,             -- número da OS
    placa text not null,              -- placa do veículo
    modelo text,                      -- modelo do veículo
    cliente text not null,            -- nome do cliente
    status text not null default 'rascunho',  -- rascunho, em_andamento, concluido, etc.
    fotos_paths text[] default '{}',  -- array de caminhos das fotos no storage
    payload jsonb,                    -- dados completos da OS (JSON)
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
```

### 4. veiculos table
```sql
-- Table for vehicles
create table veiculos(
    id uuid primary key default gen_random_uuid(),
    placa text not null unique,
    marca text not null,
    modelo text not null,
    ano integer,
    cor text,
    categoria text,
    quilometragem integer default 0,
    combustivel text,
    cambio text,
    portas integer default 4,
    chassi text,
    renavam text,
    motor text,
    observacoes text,
    status text default 'disponivel',  -- disponivel, em_manutencao, etc.
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
```

### 5. clientes table
```sql
-- Table for clients
create table clientes(
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    cpfCnpj varchar(14) not null,      -- CPF ou CNPJ ( apenas números )
    telefone text,
    email text,
    endereco text,
    observacoes text,
    createdAt timestamptz default now(),
    updatedAt timestamptz default now()
);
```

### 6. estoque table
```sql
-- Table for inventory items
create table estoque(
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    categoria text,
    quantidade integer not null default 0,
    unidade text,
    localizacao text,
    estoqueMinimo integer default 0,
    criadoPor text,
    createdAt timestamptz default now(),
    updatedAt timestamptz default now()
);
```

### 7. kits table
```sql
-- Table for parts kits
create table kits(
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    descricao text,
    criadoPor text,
    createdAt timestamptz default now(),
    updatedAt timestamptz default now()
);
```

### 8. agendamentos table
```sql
-- Table for appointments
create table agendamentos(
    id uuid primary key default gen_random_uuid(),
    cliente text not null,                    -- nome do cliente
    veiculo text not null,                    -- modelo do veículo
    placa text not null,                      -- placa do veículo
    data date not null,                       -- data do agendamento
    horaInicio time not null,                 -- horário de início
    horaFim time not null,                    -- horário de término
    titulo text not null,                     -- título do serviço
    descricao text,                           -- descrição detalhada
    status text default 'agendado',           -- agendado, concluido, cancelado
    mecanico text,                            -- nome do mecânico responsável
    ordemServicoId uuid,                      -- referencia opcional à ordem de serviço
    createdAt timestamptz default now(),
    updatedAt timestamptz default now()
);
```

### 9. servicos table
```sql
-- Table for services catalog
create table servicos(
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    categoria text,
    preco numeric(10,2) not null,
    duracao text,                             -- formato: "HH:MM" ou "X horas"
    descricao text,
    ativo boolean default true,
    createdAt timestamptz default now(),
    updatedAt timestamptz default now()
);
```

## Observações Importantes

1. **CNPJ/CPF sem formatação**: Todos os documentos (CNPJ nos admins, CPF/CNPJ nos clientes) são armazenados apenas com números (11 dígitos para CPF, 14 para CNPJ), sem pontos, traços ou barras.

2. **Hashes de senha/PIN**: 
   - Senhas dos admins são armazenadas em `pwhash` usando bcrypt-like hash
   - PINs dos funcionarios são armazenados em `pin_hash` usando o mesmo método
   - Nunca armazene senhas ou PINs em texto plano

3. **Chaves estrangeiras críticas**:
   - `funcionarios.oficina_doc` → `admins.doc` (vincula funcionários à oficina)
   - Relacionamentos opcionais como `agendamentos.ordemServicoId` → `ordens.id`

4. **Arrays e JSONB**:
   - `ordens.fotos_paths` é um array de texto para caminhos de arquivos no Supabase Storage
   - `ordens.payload` contém o objeto completo da ordem de serviço como JSONB para flexibilidade

5. **Timestamp**: Todas as tabelas usam `timestamptz` com padrão `now()` para rastreamento de criação e atualização.