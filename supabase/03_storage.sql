-- =========================================================================
-- Marvel India — Storage buckets. Run after 01_schema.sql.
-- Two public buckets: one for profile avatars, one for blog cover images.
-- Both are public-read (so images can render straight from the CDN URL);
-- writes are restricted to signed-in users, and users can only touch files
-- inside their own folder (path starts with their user id).
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('blog-covers', 'blog-covers', true)
on conflict (id) do nothing;

-- ---- avatars bucket policies ----
create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- blog-covers bucket policies ----
create policy "blog cover images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'blog-covers');

create policy "users upload their own blog covers"
  on storage.objects for insert
  with check (bucket_id = 'blog-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update their own blog covers"
  on storage.objects for update
  using (bucket_id = 'blog-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own blog covers"
  on storage.objects for delete
  using (bucket_id = 'blog-covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- Upload convention used by js/db.js:
--   avatars/<user_id>/avatar.<ext>
--   blog-covers/<user_id>/<timestamp>-<filename>
-- The leading folder = the user's auth id is what the policies above check.
