-- Restrict DealPilot tables to authenticated owners.
revoke all on public.deals from anon, public;
revoke all on public.deal_activities from anon, public;

grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, delete on public.deal_activities to authenticated;

drop policy if exists "Users can view their own deal activities" on public.deal_activities;
drop policy if exists "Users can create their own deal activities" on public.deal_activities;
drop policy if exists "Users can delete their own deal activities" on public.deal_activities;

create policy "activities_select_own_deal" on public.deal_activities
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.deals d
      where d.id = deal_activities.deal_id
        and d.owner_id = (select auth.uid())
    )
  );

create policy "activities_insert_own_deal" on public.deal_activities
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.deals d
      where d.id = deal_activities.deal_id
        and d.owner_id = (select auth.uid())
    )
  );

create policy "activities_delete_own_deal" on public.deal_activities
  for delete to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.deals d
      where d.id = deal_activities.deal_id
        and d.owner_id = (select auth.uid())
    )
  );
