TODAS AS TABELAS:

create table public.admins (
  id int generated always as identity primary key,
  nome text not null,
  doc text not null unique,
  pwhash text not null,
  created_at timestamptz not null default now()
);

create table public.ordens (
  id text not null,
  created_at text not null,
  updated_at text not null,
  os_num text null,
  placa text null,
  modelo text null,
  cliente text null,
  status text null default 'rascunho'::text,
  payload text not null,
  fotos_paths text[] null,
  constraint ordens_pkey primary key (id)
) TABLESPACE pg_default;

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

create table customers (
  id uuid primary key,
  name text not null,
  email text unique not null,
  phone text,
  cpf text,
  address text,
  pwhash text not null,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table customer_vehicles (
  id uuid primary key,
  customer_id uuid references customers(id),
  brand text not null,
  model text not null,
  year integer not null,
  plate text not null,
  color text,
  fuel_type text default 'flex',
  mileage integer default 0,
  vin text,
  renavam text,
  notes text,
  is_active boolean default true,
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table appointments (
  id uuid primary key,
  customer_id uuid references customers(id),
  vehicle_id uuid references customer_vehicles(id),
  vehicle_label text,
  service_type text not null,
  service_description text,
  date date not null,
  time_slot time not null,
  status text default 'pendente',
  notes text,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table availability_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time_slot time not null,
  is_available boolean default true
);

create table estimates (
  id uuid primary key,
  number text unique not null,
  customer_id uuid references customers(id),
  vehicle_id uuid references customer_vehicles(id),
  vehicle_label text,
  appointment_id uuid references appointments(id),
  subtotal numeric(10,2) default 0,
  discount numeric(10,2) default 0,
  total numeric(10,2) default 0,
  status text default 'pendente',
  notes text,
  customer_comment text,
  valid_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references estimates(id) on delete cascade,
  description text not null,
  quantity numeric(8,2) default 1,
  unit_price numeric(10,2) not null,
  item_type text default 'peca',
  subtotal numeric(10,2) generated always as (quantity * unit_price) stored
);

create table service_history (
  id uuid primary key,
  customer_id uuid references customers(id),
  vehicle_id uuid references customer_vehicles(id),
  vehicle_label text,
  service_date date not null,
  mileage_at_service integer,
  service_type text not null,
  total_cost numeric(10,2),
  mechanic_notes text,
  estimate_id uuid references estimates(id),
  created_at timestamptz default now()
);

create table service_history_items (
  id uuid primary key default gen_random_uuid(),
  service_history_id uuid references service_history(id) on delete cascade,
  description text not null,
  part_replaced boolean default false,
  part_name text
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  title text not null,
  message text,
  type text not null,
  is_read boolean default false,
  action_url text,
  created_at timestamptz default now()
);

create table maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  vehicle_id uuid references customer_vehicles(id),
  service_name text not null,
  interval_km integer,
  interval_months integer,
  last_service_km integer,
  last_service_date date,
  next_service_km integer,
  next_service_date date,
  urgency text default 'ok',
  urgency_score integer default 0,
  progress_pct numeric(5,2) default 0,
  km_remaining integer
);

create table funcionarios(
    id uuid primary key default gen_random_uuid(),
    nome varchar(100) not null,
    email varchar(255) not null unique,
    pin_hash varchar(255) not null,  
    cargo varchar(20) not null check (cargo in ('gerente', 'mecanico', 'atendente')),
    ativo boolean not null default true,
    created_at timestamptz default now(),
    oficina_doc varchar(14) not null, 
    foreign key (oficina_doc) references admins(doc)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_vehicle_date_time_unique
ON appointments (vehicle_id, date, time_slot)
WHERE status IN ('pendente', 'confirmado');

CREATE INDEX IF NOT EXISTS idx_availability_slots_date_time
ON availability_slots (date, time_slot);

CREATE INDEX IF NOT EXISTS idx_availability_slots_available
ON availability_slots (is_available)
WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_date_time
ON appointments (vehicle_id, date, time_slot);