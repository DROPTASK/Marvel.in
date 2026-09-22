-- =========================================================================
-- Marvel India: Complete Database Roadmap Sync & Schema Migration
-- (supabase/05_roadmap_editor.sql)
-- 
-- Run this in your Supabase Studio -> SQL Editor.
-- This script is 100% self-contained and idempotent:
-- 1. Creates public.movies table if it does not exist yet.
-- 2. Ensures all required columns exist (poster, type, spotlight, etc.).
-- 3. Enables Row Level Security and creates public read & edit policies.
-- 4. Seeds & updates all 70+ Marvel projects (Phase 1-6, Disney+, X-Men).
-- 5. Sets Avengers: Doomsday to the correct release date (2026-12-18).
--
-- After running this, open Supabase Table Editor -> "movies" to edit any
-- project directly in your database. The website will sync automatically!
-- =========================================================================

-- 1. Create public.movies table if it doesn't exist
create table if not exists public.movies (
  id text primary key,
  title text not null,
  year int not null,
  phase text not null,
  saga text not null,
  status text not null default 'released',
  release_date date,
  runtime_minutes int not null default 120,
  priority text not null default 'must-watch',
  synopsis text,
  tmdb_query text,
  spotlight boolean not null default false,
  poster text,
  type text not null default 'movie',
  sort_order int not null default 0
);

-- 2. Ensure all columns exist even if the table was created previously
alter table public.movies add column if not exists poster text;
alter table public.movies add column if not exists type text not null default 'movie';
alter table public.movies add column if not exists spotlight boolean not null default false;
alter table public.movies add column if not exists sort_order int not null default 0;
alter table public.movies add column if not exists synopsis text;
alter table public.movies add column if not exists tmdb_query text;
alter table public.movies add column if not exists priority text not null default 'must-watch';
alter table public.movies add column if not exists runtime_minutes int not null default 120;

-- 3. Enable RLS and setup policies safely
alter table public.movies enable row level security;

drop policy if exists "movies are public" on public.movies;
create policy "movies are public" on public.movies for select using (true);

drop policy if exists "movies are editable" on public.movies;
create policy "movies are editable" on public.movies for all using (true) with check (true);

-- 4. Seed / Sync the full Marvel Roadmap into public.movies
insert into public.movies (id, title, year, phase, saga, status, release_date, runtime_minutes, priority, synopsis, tmdb_query, spotlight, sort_order, type) values
-- Phase 1
('iron-man-2008', 'Iron Man', 2008, 'phase1', 'Infinity Saga', 'released', '2008-05-02', 126, 'must-watch', null, 'Iron Man 2008', false, 10, 'movie'),
('incredible-hulk-2008', 'The Incredible Hulk', 2008, 'phase1', 'Infinity Saga', 'released', '2008-06-13', 112, 'optional', null, 'The Incredible Hulk 2008', false, 20, 'movie'),
('iron-man-2-2010', 'Iron Man 2', 2010, 'phase1', 'Infinity Saga', 'released', '2010-05-07', 124, 'recommended', null, 'Iron Man 2', false, 30, 'movie'),
('thor-2011', 'Thor', 2011, 'phase1', 'Infinity Saga', 'released', '2011-05-06', 115, 'recommended', null, 'Thor 2011', false, 40, 'movie'),
('captain-america-first-avenger-2011', 'Captain America: The First Avenger', 2011, 'phase1', 'Infinity Saga', 'released', '2011-07-22', 124, 'must-watch', null, 'Captain America The First Avenger', false, 50, 'movie'),
('avengers-2012', 'The Avengers', 2012, 'phase1', 'Infinity Saga', 'released', '2012-05-04', 143, 'must-watch', null, 'The Avengers 2012', false, 60, 'movie'),

-- Phase 2
('iron-man-3-2013', 'Iron Man 3', 2013, 'phase2', 'Infinity Saga', 'released', '2013-05-03', 130, 'recommended', null, 'Iron Man 3', false, 70, 'movie'),
('thor-dark-world-2013', 'Thor: The Dark World', 2013, 'phase2', 'Infinity Saga', 'released', '2013-11-08', 112, 'optional', null, 'Thor The Dark World', false, 80, 'movie'),
('winter-soldier-2014', 'Captain America: The Winter Soldier', 2014, 'phase2', 'Infinity Saga', 'released', '2014-04-04', 136, 'must-watch', null, 'Captain America The Winter Soldier', false, 90, 'movie'),
('guardians-2014', 'Guardians of the Galaxy', 2014, 'phase2', 'Infinity Saga', 'released', '2014-08-01', 121, 'must-watch', null, 'Guardians of the Galaxy 2014', false, 100, 'movie'),
('age-of-ultron-2015', 'Avengers: Age of Ultron', 2015, 'phase2', 'Infinity Saga', 'released', '2015-05-01', 141, 'must-watch', null, 'Avengers Age of Ultron', false, 110, 'movie'),
('ant-man-2015', 'Ant-Man', 2015, 'phase2', 'Infinity Saga', 'released', '2015-07-17', 117, 'recommended', null, 'Ant-Man 2015', false, 120, 'movie'),

-- Phase 3
('civil-war-2016', 'Captain America: Civil War', 2016, 'phase3', 'Infinity Saga', 'released', '2016-05-06', 147, 'must-watch', null, 'Captain America Civil War', false, 130, 'movie'),
('doctor-strange-2016', 'Doctor Strange', 2016, 'phase3', 'Infinity Saga', 'released', '2016-11-04', 115, 'must-watch', null, 'Doctor Strange 2016', false, 140, 'movie'),
('guardians-vol2-2017', 'Guardians of the Galaxy Vol. 2', 2017, 'phase3', 'Infinity Saga', 'released', '2017-05-05', 136, 'must-watch', null, 'Guardians of the Galaxy Vol 2', false, 150, 'movie'),
('homecoming-2017', 'Spider-Man: Homecoming', 2017, 'phase3', 'Infinity Saga', 'released', '2017-07-07', 133, 'must-watch', null, 'Spider-Man Homecoming', false, 160, 'movie'),
('ragnarok-2017', 'Thor: Ragnarok', 2017, 'phase3', 'Infinity Saga', 'released', '2017-11-03', 130, 'must-watch', null, 'Thor Ragnarok', false, 170, 'movie'),
('black-panther-2018', 'Black Panther', 2018, 'phase3', 'Infinity Saga', 'released', '2018-02-16', 134, 'must-watch', null, 'Black Panther 2018', false, 180, 'movie'),
('infinity-war-2018', 'Avengers: Infinity War', 2018, 'phase3', 'Infinity Saga', 'released', '2018-04-27', 149, 'must-watch', null, 'Avengers Infinity War', false, 190, 'movie'),
('ant-man-wasp-2018', 'Ant-Man and the Wasp', 2018, 'phase3', 'Infinity Saga', 'released', '2018-07-06', 118, 'recommended', null, 'Ant-Man and the Wasp', false, 200, 'movie'),
('captain-marvel-2019', 'Captain Marvel', 2019, 'phase3', 'Infinity Saga', 'released', '2019-03-08', 123, 'must-watch', null, 'Captain Marvel 2019', false, 210, 'movie'),
('endgame-2019', 'Avengers: Endgame', 2019, 'phase3', 'Infinity Saga', 'released', '2019-04-26', 181, 'must-watch', null, 'Avengers Endgame', false, 220, 'movie'),
('far-from-home-2019', 'Spider-Man: Far From Home', 2019, 'phase3', 'Infinity Saga', 'released', '2019-07-02', 129, 'recommended', null, 'Spider-Man Far From Home', false, 230, 'movie'),

-- Phase 4
('wandavision-2021', 'WandaVision', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-01-15', 350, 'must-watch', 'Wanda Maximoff and Vision live an idyllic suburban life in Westview, but things begin to unravel.', 'WandaVision', false, 235, 'series'),
('falcon-winter-soldier-2021', 'The Falcon and the Winter Soldier', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-03-19', 300, 'recommended', 'Sam Wilson and Bucky Barnes team up on a global adventure that tests their abilities and their patience.', 'The Falcon and the Winter Soldier', false, 238, 'series'),
('loki-season-1-2021', 'Loki (Season 1)', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-06-09', 280, 'must-watch', 'The mercurial villain Loki resumes his role as the God of Mischief after stepping into the TVA.', 'Loki', false, 239, 'series'),
('black-widow-2021', 'Black Widow', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-07-09', 134, 'recommended', null, 'Black Widow 2021', false, 240, 'movie'),
('what-if-season-1-2021', 'What If...? (Season 1)', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-08-11', 270, 'recommended', 'Exploring pivotal moments from the Marvel Cinematic Universe and turning them on their head.', 'What If', false, 245, 'series'),
('shang-chi-2021', 'Shang-Chi and the Legend of the Ten Rings', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-09-03', 132, 'recommended', null, 'Shang-Chi', false, 250, 'movie'),
('eternals-2021', 'Eternals', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-11-05', 156, 'optional', null, 'Eternals 2021', false, 260, 'movie'),
('hawkeye-2021', 'Hawkeye', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-11-24', 290, 'recommended', 'Clint Barton partners with young archer Kate Bishop to confront enemies from his past as Ronin in NYC.', 'Hawkeye', false, 265, 'series'),
('no-way-home-2021', 'Spider-Man: No Way Home', 2021, 'phase4', 'Multiverse Saga', 'released', '2021-12-17', 148, 'must-watch', null, 'Spider-Man No Way Home', false, 270, 'movie'),
('moon-knight-2022', 'Moon Knight', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-03-30', 280, 'recommended', 'Steven Grant discovers he has dissociative identity disorder and shares a body with mercenary Marc Spector.', 'Moon Knight', false, 275, 'series'),
('multiverse-of-madness-2022', 'Doctor Strange in the Multiverse of Madness', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-05-06', 126, 'must-watch', null, 'Doctor Strange Multiverse of Madness', false, 280, 'movie'),
('ms-marvel-2022', 'Ms. Marvel', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-06-08', 270, 'recommended', 'Kamala Khan, a Muslim American teen superhero super-fan in Jersey City, discovers cosmic powers.', 'Ms Marvel', false, 285, 'series'),
('love-and-thunder-2022', 'Thor: Love and Thunder', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-07-08', 119, 'recommended', null, 'Thor Love and Thunder', false, 290, 'movie'),
('she-hulk-2022', 'She-Hulk: Attorney at Law', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-08-18', 270, 'optional', 'Jennifer Walters navigates the complicated life of a single, 30-something attorney who also happens to be a green 6-foot-7 superpowered hulk.', 'She-Hulk Attorney at Law', false, 293, 'series'),
('werewolf-by-night-2022', 'Werewolf by Night', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-10-07', 52, 'recommended', 'A secret cabal of monster hunters gather at Bloodstone Temple following the death of their leader.', 'Werewolf by Night', false, 296, 'movie'),
('wakanda-forever-2022', 'Black Panther: Wakanda Forever', 2022, 'phase4', 'Multiverse Saga', 'released', '2022-11-11', 161, 'must-watch', null, 'Wakanda Forever', false, 300, 'movie'),

-- Phase 5
('quantumania-2023', 'Ant-Man and the Wasp: Quantumania', 2023, 'phase5', 'Multiverse Saga', 'released', '2023-02-17', 125, 'recommended', null, 'Quantumania', false, 310, 'movie'),
('guardians-vol3-2023', 'Guardians of the Galaxy Vol. 3', 2023, 'phase5', 'Multiverse Saga', 'released', '2023-05-05', 150, 'must-watch', null, 'Guardians of the Galaxy Vol 3', false, 320, 'movie'),
('secret-invasion-2023', 'Secret Invasion', 2023, 'phase5', 'Multiverse Saga', 'released', '2023-06-21', 260, 'optional', 'Nick Fury learns of a clandestine invasion of Earth by a faction of shapeshifting Skrulls.', 'Secret Invasion', false, 323, 'series'),
('loki-season-2-2023', 'Loki (Season 2)', 2023, 'phase5', 'Multiverse Saga', 'released', '2023-10-05', 290, 'must-watch', 'Loki navigates an ever-expanding and increasingly dangerous multiverse in search of Sylvie, Judge Renslayer, and Miss Minutes.', 'Loki Season 2', false, 326, 'series'),
('the-marvels-2023', 'The Marvels', 2023, 'phase5', 'Multiverse Saga', 'released', '2023-11-10', 105, 'optional', null, 'The Marvels 2023', false, 330, 'movie'),
('what-if-season-2-2023', 'What If...? (Season 2)', 2023, 'phase5', 'Multiverse Saga', 'released', '2023-12-22', 270, 'recommended', 'The Watcher continues as our guide through the vast multiverse, introducing new faces and familiar heroes.', 'What If Season 2', false, 333, 'series'),
('echo-2024', 'Echo', 2024, 'phase5', 'Multiverse Saga', 'released', '2024-01-09', 210, 'recommended', 'Maya Lopez is pursued by Wilson Fisk''s criminal empire, forcing her to return home to Oklahoma.', 'Echo Marvel', false, 336, 'series'),
('x-men-97-2024', 'X-Men ''97', 2024, 'phase5', 'Multiverse Saga', 'released', '2024-03-20', 320, 'must-watch', 'The animated continuation of the legendary 90s series following Professor X''s legacy.', 'X-Men 97', false, 338, 'series'),
('deadpool-wolverine-2024', 'Deadpool & Wolverine', 2024, 'phase5', 'Multiverse Saga', 'released', '2024-07-26', 128, 'must-watch', null, 'Deadpool and Wolverine', false, 340, 'movie'),
('agatha-all-along-2024', 'Agatha All Along', 2024, 'phase5', 'Multiverse Saga', 'released', '2024-09-18', 340, 'must-watch', 'Agatha Harkness gathers an unconventional coven of witches to walk the perilous Witches'' Road.', 'Agatha All Along', false, 345, 'series'),
('brave-new-world-2025', 'Captain America: Brave New World', 2025, 'phase5', 'Multiverse Saga', 'released', '2025-02-14', 118, 'recommended', null, 'Captain America Brave New World', false, 350, 'movie'),
('daredevil-born-again-2025', 'Daredevil: Born Again', 2025, 'phase5', 'Multiverse Saga', 'released', '2025-03-04', 450, 'must-watch', 'Matt Murdock and Wilson Fisk clash on the streets and courtrooms of New York City in their full-fledged MCU return.', 'Daredevil Born Again', false, 355, 'series'),
('thunderbolts-2025', 'Thunderbolts*', 2025, 'phase5', 'Multiverse Saga', 'released', '2025-05-02', 126, 'recommended', null, 'Thunderbolts', false, 360, 'movie'),
('ironheart-2025', 'Ironheart', 2025, 'phase5', 'Multiverse Saga', 'released', '2025-06-24', 280, 'recommended', 'Riri Williams creates the most advanced suit of armor since Iron Man, colliding tech with dark magic.', 'Ironheart Marvel', false, 365, 'series'),
('fantastic-four-2025', 'The Fantastic Four: First Steps', 2025, 'phase5', 'Multiverse Saga', 'released', '2025-07-25', 115, 'must-watch', null, 'Fantastic Four First Steps', false, 370, 'movie'),

-- Phase 6
('spider-man-4-2026', 'Spider-Man 4 (MCU)', 2026, 'phase6', 'Multiverse Saga', 'upcoming', '2026-07-24', 135, 'must-watch', 'Peter Parker operates as a street-level hero in New York with his past erased, facing new gang threats and multiverse ripples.', 'Spider-Man 4', false, 375, 'movie'),
('avengers-doomsday-2026', 'Avengers: Doomsday', 2026, 'phase6', 'Multiverse Saga', 'upcoming', '2026-12-18', 160, 'must-watch', 'The Multiverse Saga''s centerpiece — Doctor Victor von Doom rises as the Avengers, the Fantastic Four, X-Men and variants from across the multiverse are forced onto one battlefield.', 'Avengers Doomsday', true, 380, 'movie'),
('avengers-secret-wars-2027', 'Avengers: Secret Wars', 2027, 'phase6', 'Multiverse Saga', 'upcoming', '2027-12-17', 160, 'must-watch', 'The saga-closing event pulling together threads from Loki, What If...?, and the multiverse arc built since Endgame.', 'Avengers Secret Wars', false, 390, 'movie'),
('blade-2027', 'Blade', 2027, 'phase6', 'Multiverse Saga', 'upcoming', '2027-05-07', 120, 'must-watch', 'Eric Brooks hunts the bloodsucking vampire underworld in the dark supernatural corner of the MCU.', 'Blade Marvel', false, 395, 'movie'),
('armor-wars-2027', 'Armor Wars', 2027, 'phase6', 'Multiverse Saga', 'upcoming', '2027-11-05', 125, 'recommended', 'James Rhodes protects Tony Stark''s legacy when high-tech Stark armor blueprints fall into black-market hands.', 'Armor Wars', false, 398, 'movie'),

-- X-Men Saga (Fox-Marvel & Mutant Multiverse)
('x-men-2000', 'X-Men', 2000, 'xmen', 'Mutant Saga', 'released', '2000-07-14', 104, 'must-watch', 'Two mutants, Wolverine and Rogue, enter Charles Xavier''s school while Magneto plots against humanity.', 'X-Men 2000', false, 400, 'xmen'),
('x2-2003', 'X2: X-Men United', 2003, 'xmen', 'Mutant Saga', 'released', '2003-05-02', 134, 'must-watch', 'The X-Men band together with Magneto''s Brotherhood to stop Colonel William Stryker from exterminating all mutants.', 'X2 X-Men United', false, 410, 'xmen'),
('x-men-last-stand-2006', 'X-Men: The Last Stand', 2006, 'xmen', 'Mutant Saga', 'released', '2006-05-26', 104, 'recommended', 'A mutant cure sparks civil war while Jean Grey reawakens as the dark Phoenix.', 'X-Men The Last Stand', false, 420, 'xmen'),
('x-men-first-class-2011', 'X-Men: First Class', 2011, 'xmen', 'Mutant Saga', 'released', '2011-06-03', 132, 'must-watch', 'In 1962 during the Cuban Missile Crisis, young Charles Xavier and Erik Lehnsherr unite mutants for the first time.', 'X-Men First Class', false, 430, 'xmen'),
('the-wolverine-2013', 'The Wolverine', 2013, 'xmen', 'Mutant Saga', 'released', '2013-07-26', 126, 'recommended', 'Logan travels to Japan to meet an old friend, but finds his healing factor compromised.', 'The Wolverine 2013', false, 440, 'xmen'),
('x-men-days-of-future-past-2014', 'X-Men: Days of Future Past', 2014, 'xmen', 'Mutant Saga', 'released', '2014-05-23', 132, 'must-watch', 'Wolverine is sent into the past to prevent the creation of Sentinels that hunt mutants to extinction.', 'X-Men Days of Future Past', false, 450, 'xmen'),
('deadpool-2016', 'Deadpool', 2016, 'xmen', 'Mutant Saga', 'released', '2016-02-12', 108, 'must-watch', 'A wisecracking mercenary with accelerated healing hunts down the rogue scientist who disfigured him.', 'Deadpool 2016', false, 460, 'xmen'),
('x-men-apocalypse-2016', 'X-Men: Apocalypse', 2016, 'xmen', 'Mutant Saga', 'released', '2016-05-27', 144, 'optional', 'The first and most powerful mutant awakens to cleanse mankind with his four horsemen.', 'X-Men Apocalypse', false, 470, 'xmen'),
('logan-2017', 'Logan', 2017, 'xmen', 'Mutant Saga', 'released', '2017-03-03', 137, 'must-watch', 'In a bleak future, an aging Logan cares for Charles Xavier while defending a young mutant girl, Laura.', 'Logan 2017', false, 480, 'xmen'),
('deadpool-2-2018', 'Deadpool 2', 2018, 'xmen', 'Mutant Saga', 'released', '2018-05-18', 119, 'must-watch', 'Deadpool forms X-Force to protect a young mutant from time-traveling soldier Cable.', 'Deadpool 2', false, 490, 'xmen'),
('dark-phoenix-2019', 'Dark Phoenix', 2019, 'xmen', 'Mutant Saga', 'released', '2019-06-07', 114, 'optional', 'Jean Grey absorbs a solar flare in space, transforming into the cosmic Phoenix.', 'Dark Phoenix', false, 500, 'xmen'),
('the-new-mutants-2020', 'The New Mutants', 2020, 'xmen', 'Mutant Saga', 'released', '2020-08-28', 94, 'optional', 'Five young mutants held in an isolated facility must confront their traumatic pasts and powers.', 'The New Mutants', false, 510, 'xmen')

on conflict (id) do update set
  title = excluded.title,
  year = excluded.year,
  phase = excluded.phase,
  saga = excluded.saga,
  status = excluded.status,
  release_date = excluded.release_date,
  runtime_minutes = excluded.runtime_minutes,
  priority = excluded.priority,
  synopsis = coalesce(excluded.synopsis, movies.synopsis),
  tmdb_query = excluded.tmdb_query,
  spotlight = excluded.spotlight,
  type = excluded.type,
  sort_order = excluded.sort_order;

-- 5. Explicitly guarantee Avengers: Doomsday has theatrical date: Dec 18, 2026
update public.movies
set release_date = '2026-12-18', spotlight = true, status = 'upcoming'
where title ilike '%Doomsday%';

