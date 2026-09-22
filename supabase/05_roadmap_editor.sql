-- =========================================================================
-- Marvel India: Roadmap Database Editing Migration (05_roadmap_editor.sql)
-- Run this in your Supabase SQL Editor to enable full database-driven roadmap
-- editing directly from the app or via the Supabase dashboard.
-- =========================================================================

-- Ensure all required columns exist on public.movies
alter table if exists public.movies add column if not exists poster text;
alter table if exists public.movies add column if not exists type text not null default 'movie';

-- Enable RLS on movies table
alter table if exists public.movies enable row level security;

-- Ensure SELECT is public
drop policy if exists "movies are public" on public.movies;
create policy "movies are public" on public.movies for select using (true);

-- Allow updates, inserts, and deletes for the roadmap editor
drop policy if exists "movies are editable" on public.movies;
create policy "movies are editable" on public.movies for all using (true) with check (true);

-- Ensure Avengers: Doomsday has the correct theatrical release date
update public.movies
set release_date = '2026-12-18', spotlight = true, status = 'upcoming'
where title ilike '%Doomsday%';
