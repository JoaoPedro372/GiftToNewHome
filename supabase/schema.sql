-- Run this in the Supabase SQL editor (or via CLI) once per project.

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null,
  image_key text not null,
  goal numeric(12, 2) not null check (goal > 0),
  raised numeric(12, 2) not null default 0 check (raised >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  amount numeric(12, 2) not null check (amount > 0),
  mp_payment_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'cancelled', 'expired')),
  payer_email text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists contributions_product_id_idx
  on public.contributions (product_id);

create index if not exists contributions_status_idx
  on public.contributions (status);

alter table public.products enable row level security;
alter table public.contributions enable row level security;

-- Public read for product progress; writes go through service role only.
drop policy if exists "Public read products" on public.products;
create policy "Public read products"
  on public.products
  for select
  to anon, authenticated
  using (true);

-- Seed gift list (raised starts at 0; adjust goals as needed)
insert into public.products (id, name, description, image_key, goal, raised, sort_order)
values
  (
    'sofa',
    'Sofá da sala',
    'O ponto de encontro para as tardes de filme e cafés compridos.',
    'sofa',
    3500,
    0,
    1
  ),
  (
    'table',
    'Mesa de jantar',
    'Para receber vocês em jantares longos e conversas boas.',
    'table',
    2800,
    0,
    2
  ),
  (
    'coffee',
    'Máquina de café',
    'O primeiro cheiro de manhã na casa nova.',
    'coffee',
    1600,
    0,
    3
  ),
  (
    'cookware',
    'Jogo de panelas',
    'Para estrear a cozinha com aquele arroz de domingo.',
    'cookware',
    1200,
    0,
    4
  ),
  (
    'blender',
    'Liquidificador',
    'Vitaminas, sucos e algum drink de sexta-feira.',
    'blender',
    300,
    0,
    5
  ),
  (
    'linens',
    'Roupa de cama',
    'Lençóis novinhos para inaugurar a primeira noite.',
    'linens',
    800,
    0,
    6
  )
on conflict (id) do nothing;
