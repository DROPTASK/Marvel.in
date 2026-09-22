-- =========================================================================
-- Marvel India — Supabase schema
-- Run this in Supabase Studio → SQL Editor, top to bottom, in a fresh
-- project. Then run 02_seed.sql, then 03_storage.sql.
-- =========================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------- profiles
-- One row per authenticated user. Created automatically by the trigger
-- below the moment someone signs up (mirrors auth.users -> public.profiles).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------ movies
-- The full MCU roadmap. "priority" and "runtime_minutes" power the Doomsday
-- watch-plan calculator on the Roadmap page.
create table if not exists public.movies (
  id text primary key,                 -- stable slug, e.g. 'iron-man-2008'
  title text not null,
  year int not null,
  phase text not null,                 -- 'phase1' .. 'phase6'
  saga text not null,                  -- 'Infinity Saga' | 'Multiverse Saga'
  status text not null default 'released',   -- 'released' | 'upcoming'
  release_date date,
  runtime_minutes int not null default 130,
  priority text not null default 'must-watch',  -- 'must-watch' | 'recommended' | 'optional'
  synopsis text,
  tmdb_query text,                     -- used to enrich with a live TMDB poster/rating
  spotlight boolean not null default false,
  poster text,
  type text not null default 'movie',
  sort_order int not null default 0
);

-- ------------------------------------------------------------ timeline_events
create table if not exists public.timeline_events (
  id serial primary key,
  movie_title text not null,
  year_label text not null,
  blurb text not null,
  spotlight boolean not null default false,
  sort_order int not null default 0
);

-- ------------------------------------------------------------------ characters
create table if not exists public.characters (
  id serial primary key,
  name text not null,
  actor text not null,
  aliases text[] not null default '{}',
  powers text,
  affiliation text,
  first_appearance text,
  sort_order int not null default 0
);

-- ------------------------------------------------------------------- wishlist
create table if not exists public.wishlist (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,             -- 'movie'
  item_id text not null,
  title text not null,
  poster_url text,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- ------------------------------------------------------------------- comments
-- Generic comments, keyed by item_type/item_id (e.g. 'movie'/'iron-man-2008').
create table if not exists public.comments (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- watch_progress
create table if not exists public.watch_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id text not null references public.movies(id) on delete cascade,
  watched boolean not null default true,
  watched_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- -------------------------------------------------------------------- blog_posts
create table if not exists public.blog_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text unique not null,
  cover_image_url text,
  body text not null,
  tags text[] not null default '{}',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- blog_comments
create table if not exists public.blog_comments (
  id bigserial primary key,
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- affiliate_products
-- Amazon Associates products shown on the Shop page. amazon_url should be the
-- product's canonical Amazon link *without* your tag — the app appends
-- ?tag=<your-affiliate-tag> at render time (see js/config.js), so you can
-- change your tag in one place without touching this table.
create table if not exists public.affiliate_products (
  id serial primary key,
  title text not null,
  image_url text,
  amazon_url text not null,
  category text,
  price_label text,
  blurb text,
  sort_order int not null default 0
);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.timeline_events enable row level security;
alter table public.characters enable row level security;
alter table public.wishlist enable row level security;
alter table public.comments enable row level security;
alter table public.watch_progress enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;
alter table public.affiliate_products enable row level security;

-- Public reference data: anyone can read; movies can be edited/updated by community/admin
create policy "movies are public" on public.movies for select using (true);
create policy "movies are editable" on public.movies for all using (true) with check (true);
create policy "timeline is public" on public.timeline_events for select using (true);
create policy "characters are public" on public.characters for select using (true);
create policy "affiliate products are public" on public.affiliate_products for select using (true);
create policy "published posts are public" on public.blog_posts for select using (published = true);
create policy "blog comments are public" on public.blog_comments for select using (true);
create policy "comments are public" on public.comments for select using (true);

-- Profiles: readers can see any profile (for author names/avatars); only the
-- owner can edit their own row.
create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

-- Wishlist: fully private to the owner.
create policy "users manage own wishlist" on public.wishlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Watch progress: fully private to the owner.
create policy "users manage own watch progress" on public.watch_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Comments (movie/character pages): any signed-in user can add; only the
-- author can edit/delete their own.
create policy "signed-in users add comments" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "authors manage own comments" on public.comments
  for update using (auth.uid() = user_id);
create policy "authors delete own comments" on public.comments
  for delete using (auth.uid() = user_id);

-- Blog posts: any signed-in user can publish; only the author can edit/delete.
create policy "signed-in users create posts" on public.blog_posts
  for insert with check (auth.uid() = author_id);
create policy "authors see own drafts too" on public.blog_posts
  for select using (published = true or auth.uid() = author_id);
create policy "authors update own posts" on public.blog_posts
  for update using (auth.uid() = author_id);
create policy "authors delete own posts" on public.blog_posts
  for delete using (auth.uid() = author_id);

-- Blog comments: any signed-in user can add; only the author can delete.
create policy "signed-in users add blog comments" on public.blog_comments
  for insert with check (auth.uid() = user_id);
create policy "authors delete own blog comments" on public.blog_comments
  for delete using (auth.uid() = user_id);
