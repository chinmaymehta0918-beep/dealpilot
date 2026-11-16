-- Store the generation style on each follow-up so tone changes are reproducible.
alter table public.follow_ups
  add column if not exists tone text not null default 'consultative'
    check (tone in ('warm', 'direct', 'consultative', 'executive')),
  add column if not exists generation_goal text not null default '';
