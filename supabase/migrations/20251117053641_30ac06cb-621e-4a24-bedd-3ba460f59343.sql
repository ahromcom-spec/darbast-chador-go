-- Ensure public image access and a simple media table per hierarchy project
-- 1) Make sure the 'order-media' bucket exists and is public
insert into storage.buckets (id, name, public)
values ('order-media', 'order-media', true)
on conflict (id) do update set public = excluded.public;

-- 2) Create project_hierarchy_media table to attach images directly to projects_hierarchy
create table if not exists public.project_hierarchy_media (
  id uuid primary key default gen_random_uuid(),
  hierarchy_project_id uuid not null references public.projects_hierarchy(id) on delete cascade,
  file_path text not null,
  file_type text not null default 'image',
  mime_type text,
  file_size integer,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Updated-at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ph_media_set_updated_at on public.project_hierarchy_media;
create trigger trg_ph_media_set_updated_at
before update on public.project_hierarchy_media
for each row execute function public.set_updated_at();

-- 4) RLS Policies
alter table public.project_hierarchy_media enable row level security;

drop policy if exists "ph_media_select_own_or_owner" on public.project_hierarchy_media;
create policy "ph_media_select_own_or_owner"
on public.project_hierarchy_media
for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.projects_hierarchy ph 
    where ph.id = project_hierarchy_media.hierarchy_project_id
      and ph.user_id = auth.uid()
  )
);

drop policy if exists "ph_media_insert_own" on public.project_hierarchy_media;
create policy "ph_media_insert_own"
on public.project_hierarchy_media
for insert
with check (user_id = auth.uid());


drop policy if exists "ph_media_update_own" on public.project_hierarchy_media;
create policy "ph_media_update_own"
on public.project_hierarchy_media
for update using (user_id = auth.uid());


drop policy if exists "ph_media_delete_own" on public.project_hierarchy_media;
create policy "ph_media_delete_own"
on public.project_hierarchy_media
for delete using (user_id = auth.uid());

-- 5) Index
create index if not exists idx_ph_media_hierarchy_id on public.project_hierarchy_media(hierarchy_project_id);

-- 6) Storage object policies (API access convenience)
-- Public read (via API) for order-media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'order_media_public_read_v2'
  ) THEN
    CREATE POLICY "order_media_public_read_v2"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'order-media');
  END IF;
END $$;

-- Authenticated users can upload/update/delete inside their own folder (userId/...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'order_media_user_folder_upload_v2'
  ) THEN
    CREATE POLICY "order_media_user_folder_upload_v2"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'order-media'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'order_media_user_folder_update_v2'
  ) THEN
    CREATE POLICY "order_media_user_folder_update_v2"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'order-media'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'order_media_user_folder_delete_v2'
  ) THEN
    CREATE POLICY "order_media_user_folder_delete_v2"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'order-media'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;