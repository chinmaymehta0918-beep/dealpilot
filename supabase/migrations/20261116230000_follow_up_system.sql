-- DealPilot follow-up drafts and review workflow
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'completed')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_ups_owner_status_due_idx
  on public.follow_ups (owner_id, status, due_at);
create index if not exists follow_ups_deal_created_idx
  on public.follow_ups (deal_id, created_at desc);

alter table public.follow_ups enable row level security;
revoke all on table public.follow_ups from public, anon;
grant select, insert, update, delete on public.follow_ups to authenticated;

drop policy if exists follow_ups_select_own_deal on public.follow_ups;
create policy follow_ups_select_own_deal on public.follow_ups
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.deals d where d.id = follow_ups.deal_id and d.owner_id = (select auth.uid()))
  );

drop policy if exists follow_ups_insert_own_deal on public.follow_ups;
create policy follow_ups_insert_own_deal on public.follow_ups
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.deals d where d.id = follow_ups.deal_id and d.owner_id = (select auth.uid()))
  );

drop policy if exists follow_ups_update_own_deal on public.follow_ups;
create policy follow_ups_update_own_deal on public.follow_ups
  for update to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.deals d where d.id = follow_ups.deal_id and d.owner_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.deals d where d.id = follow_ups.deal_id and d.owner_id = (select auth.uid()))
  );

drop policy if exists follow_ups_delete_own_deal on public.follow_ups;
create policy follow_ups_delete_own_deal on public.follow_ups
  for delete to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.deals d where d.id = follow_ups.deal_id and d.owner_id = (select auth.uid()))
  );
