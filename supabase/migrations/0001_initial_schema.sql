-- DealPilot initial schema.
-- Run this in the Supabase SQL editor after creating a project.
-- Row Level Security keeps each signed-in user's records private.

create extension if not exists pgcrypto;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  service text not null,
  contact_name text,
  contact_email text,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  stage text not null default 'Discovery'
    check (stage in ('Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost')),
  health text not null default 'On track'
    check (health in ('On track', 'Needs attention', 'At risk')),
  next_step text,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_owner_updated_idx
  on public.deals (owner_id, updated_at desc);

create index if not exists deals_owner_follow_up_idx
  on public.deals (owner_id, follow_up_at);

alter table public.deals enable row level security;

create policy "Users can view their own deals"
  on public.deals for select
  using (auth.uid() = owner_id);

create policy "Users can create their own deals"
  on public.deals for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own deals"
  on public.deals for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own deals"
  on public.deals for delete
  using (auth.uid() = owner_id);

create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  activity_type text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists deal_activities_owner_created_idx
  on public.deal_activities (owner_id, created_at desc);

alter table public.deal_activities enable row level security;

create policy "Users can view their own deal activities"
  on public.deal_activities for select
  using (auth.uid() = owner_id);

create policy "Users can create their own deal activities"
  on public.deal_activities for insert
  with check (auth.uid() = owner_id);

create policy "Users can delete their own deal activities"
  on public.deal_activities for delete
  using (auth.uid() = owner_id);
