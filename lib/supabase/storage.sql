-- Eksekusi kode SQL ini di Dashboard Supabase > SQL Editor

-- 1. Buat bucket baru bernama 'avatars' (dengan public read)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2. Buat kebijakan (Policy) agar siapa saja anonim/publik bisa MELIHAT foto
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'avatars' );

-- 3. Buat kebijakan (Policy) agar pengguna yang sudah login bisa MENGUNGGAH foto
create policy "Authenticated Users can upload avatars"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'avatars' );

-- 4. Buat kebijakan (Policy) agar pengguna bisa MEMPERBARUI foto
create policy "Authenticated Users can update avatars"
on storage.objects for update
to authenticated
using ( bucket_id = 'avatars' );
