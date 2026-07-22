-- Run once in Supabase SQL editor to enable gift image uploads from admin.
-- Dashboard alternative: Storage → New bucket → name: gift-images → Public

insert into storage.buckets (id, name, public)
values ('gift-images', 'gift-images', true)
on conflict (id) do update set public = true;

-- Public read for gift images
drop policy if exists "Public read gift images" on storage.objects;
create policy "Public read gift images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'gift-images');

-- Uploads go through the service role key on the server (bypasses RLS).
-- Optional: allow authenticated uploads if you later add Supabase Auth.
