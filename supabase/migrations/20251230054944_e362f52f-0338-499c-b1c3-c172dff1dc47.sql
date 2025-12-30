-- Persist module hierarchy/folders/duplicates beyond localStorage
create table if not exists public.module_hierarchy_states (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  type text not null,
  hierarchy jsonb not null default '[]'::jsonb,
  custom_names jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_hierarchy_states_type_check check (type in ('available','assigned')),
  constraint module_hierarchy_states_owner_type_unique unique (owner_user_id, type)
);

create index if not exists idx_module_hierarchy_states_owner_type
  on public.module_hierarchy_states(owner_user_id, type);

alter table public.module_hierarchy_states enable row level security;

create policy "Users can read their own module hierarchy"
  on public.module_hierarchy_states
  for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert their own module hierarchy"
  on public.module_hierarchy_states
  for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can update their own module hierarchy"
  on public.module_hierarchy_states
  for update
  using (auth.uid() = owner_user_id);

create policy "Users can delete their own module hierarchy"
  on public.module_hierarchy_states
  for delete
  using (auth.uid() = owner_user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists set_module_hierarchy_states_updated_at on public.module_hierarchy_states;
create trigger set_module_hierarchy_states_updated_at
before update on public.module_hierarchy_states
for each row execute function public.set_updated_at();
