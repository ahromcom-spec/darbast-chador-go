insert into storage.buckets (id, name, public)
values ('migration-downloads', 'migration-downloads', true)
on conflict (id) do update set public = true;

create policy "Public can download migration files"
on storage.objects
for select
to public
using (bucket_id = 'migration-downloads');