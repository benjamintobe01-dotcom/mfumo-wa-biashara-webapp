-- Mfumo wa Biashara - Supabase schema
-- Bandika hii yote kwenye Supabase Dashboard -> SQL Editor -> Run

create extension if not exists "uuid-ossp";

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  customer text,
  product_id uuid references products(id) on delete set null,
  qty numeric not null default 0,
  sell_price numeric not null default 0,
  total_sale numeric not null default 0,
  buy_price numeric not null default 0,
  cost numeric not null default 0,
  profit numeric not null default 0,
  payment_type text not null default 'Taslimu',
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  product_id uuid references products(id) on delete set null,
  qty numeric not null default 0,
  buy_price numeric not null default 0,
  total_cost numeric not null default 0,
  supplier text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists biz_expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text,
  description text,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists personal_expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  description text,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists debts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  date date not null,
  customer text,
  product text,
  total_debt numeric not null default 0,
  paid_amount numeric not null default 0,
  balance numeric not null default 0,
  payment_date date,
  status text not null default 'Wazi',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists customer_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  location text,
  follow_up_date date,
  follow_up_note text,
  remarks text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Row Level Security: kila mtumiaji anaona/anahariri data yake pekee
alter table products enable row level security;
alter table sales enable row level security;
alter table purchases enable row level security;
alter table biz_expenses enable row level security;
alter table personal_expenses enable row level security;
alter table debts enable row level security;
alter table customer_profiles enable row level security;

create policy "products_owner" on products for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sales_owner" on sales for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "purchases_owner" on purchases for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "biz_expenses_owner" on biz_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personal_expenses_owner" on personal_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debts_owner" on debts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "customer_profiles_owner" on customer_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index za kuharakisha maswali ya kawaida
create index if not exists idx_sales_user_date on sales(user_id, date);
create index if not exists idx_purchases_user_date on purchases(user_id, date);
create index if not exists idx_debts_user_status on debts(user_id, status);
