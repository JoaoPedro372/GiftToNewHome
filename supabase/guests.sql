-- Run this in Supabase SQL editor if the project already applied schema.sql before guests existed.

create extension if not exists "pgcrypto";

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  display_name text not null,
  email text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guests_status_idx on public.guests (status);

alter table public.guests enable row level security;



insert into public.guests (invite_code, display_name)
values
  ('demo-maria', 'Maria'),
  ('demo-casal', 'Pedro & Juliana')
on conflict (invite_code) do nothing;

-- Add a guest:
-- insert into public.guests (invite_code, display_name) values ('codigo-unico', 'Nome ou Casal');
-- Invite URL: https://seu-dominio/c/codigo-unico
