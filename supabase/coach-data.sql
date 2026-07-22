-- ATHLOS — club / coaches / athletes data model + seed.
-- Run this ONCE in the Supabase dashboard (SQL Editor → Run).
-- Safe to re-run (idempotent: IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS).
-- Auth accounts referenced below were created via scripts/create-athletes.mjs:
--   coach@athlos.si .......... 2f2a6a12-a7a0-452a-9658-3e1c5796755c
--   luka@athlos.si ........... 03a71e08-f878-4ff6-b3b3-c3aaf95d9537
--   nina@athlos.si ........... a0aa70e5-7969-4771-91f6-4b2892b81dfb
--   tim@athlos.si ............ 7ce13c2a-c64c-437b-93c2-b00f0a67133f
--   eva@athlos.si ............ d53e2f5c-4899-46c2-bb9c-3a52bf3e9649
--   jure@athlos.si ........... c84cb768-e5d8-429d-9058-d29414306415
--   ana@athlos.si ............ d86992d7-dd12-4ed3-b958-043e1ed2910b
--   marko@athlos.si .......... 88c77a08-eb88-47e8-9574-881cf7d6f61e
-- All passwords: athlos123  (coach: coach123)

-- ─────────────────────────── tables ───────────────────────────
create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  logo       text,                       -- storage URL
  created_at timestamptz default now()
);

create table if not exists public.coaches (
  id         uuid primary key references auth.users (id) on delete cascade,
  club_id    uuid references public.clubs (id) on delete set null,
  name       text,
  role       text default 'Glavni trener',
  photo      text,                       -- storage URL
  created_at timestamptz default now()
);

create table if not exists public.athletes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,  -- the athlete's own login
  club_id    uuid references public.clubs (id) on delete set null,
  coach_id   uuid references public.coaches (id) on delete set null,
  initials   text,
  name       text not null,
  username   text,
  note       text,
  readiness  int,
  status     text,                       -- ready | slightly-tired | tired
  weight_kg  numeric,
  is_private boolean default false,
  photo      text,                       -- storage URL
  created_at timestamptz default now()
);

-- ─────────────────────────── RLS ───────────────────────────
alter table public.clubs    enable row level security;
alter table public.coaches  enable row level security;
alter table public.athletes enable row level security;

-- clubs: any logged-in user can read
drop policy if exists "clubs read" on public.clubs;
create policy "clubs read" on public.clubs for select to authenticated using (true);

-- Security-definer helper: the caller's own club_id. RLS policies below need
-- "is this row in MY club", but a policy on `athletes` that subqueries
-- `athletes` again from inside itself triggers Postgres's infinite-recursion
-- guard on every single query against the table (42P17) — the exact failure
-- mode `is_conversation_member()` in schema.sql already exists to avoid.
-- SECURITY DEFINER bypasses RLS for this one lookup, breaking the cycle.
create or replace function public.my_club_id()
returns uuid language sql security definer stable as $$
  select club_id from public.athletes where user_id = auth.uid() limit 1;
$$;

-- coaches: read own row + coaches of your own club (own-club visibility, not
-- every coach in the DB); write only your own row. Cross-club coach search
-- (findClubs) goes through the coaches_by_name()/coach_name_for_club() RPCs
-- below instead, which return only id/name/club_id — never anything more.
drop policy if exists "coaches read"  on public.coaches;
drop policy if exists "coaches write" on public.coaches;
drop policy if exists "coaches upd"   on public.coaches;
create policy "coaches read" on public.coaches for select to authenticated using (
  id = auth.uid() or club_id = public.my_club_id()
);
create policy "coaches write" on public.coaches for insert to authenticated with check (id = auth.uid());
create policy "coaches upd"   on public.coaches for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- athletes: own row, your assigned athletes (coach), or teammates in your own
-- club — NOT every athlete in the DB. Cross-club lookups (chat partner name,
-- duplicate-membership check, club-search member counts) go through the
-- SECURITY DEFINER RPCs below instead, which return only non-sensitive
-- identity columns (never note/readiness/status/weight_kg/is_private).
drop policy if exists "athletes read"   on public.athletes;
drop policy if exists "athletes self"   on public.athletes;
drop policy if exists "athletes coach"  on public.athletes;
drop policy if exists "athletes cins"   on public.athletes;
create policy "athletes read" on public.athletes for select to authenticated using (
  user_id = auth.uid()
  or coach_id = auth.uid()
  or club_id = public.my_club_id()
);
create policy "athletes self"  on public.athletes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "athletes coach" on public.athletes for update to authenticated using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "athletes cins"  on public.athletes for insert to authenticated with check (coach_id = auth.uid());

-- Public, non-sensitive identity slice for an athlete — mirrors
-- public_profiles()/get_community_invite_code() in schema.sql. Used for chat
-- partner display name (listConversations), duplicate-club-membership check
-- (addAthleteToClub) — none of which need note/readiness/status/weight_kg.
create or replace function public.athlete_identity(p_user_id uuid)
returns table(id uuid, user_id uuid, name text, initials text, club_id uuid, coach_id uuid)
language sql security definer as $$
  select id, user_id, name, initials, club_id, coach_id
  from public.athletes where user_id = p_user_id;
$$;

-- Member count for a club, for the public club-search flow — count only,
-- never row content.
create or replace function public.club_member_count(p_club_id uuid)
returns bigint language sql security definer as $$
  select count(*) from public.athletes where club_id = p_club_id and coach_id is not null;
$$;

-- Cross-club coach name search, for the public "find a club/coach" flow —
-- id/name/club_id only, same non-sensitive slice as public_profiles().
create or replace function public.coaches_by_name(q text)
returns table(id uuid, name text, club_id uuid)
language sql security definer as $$
  select id, name, club_id from public.coaches where name ilike q;
$$;

-- Single coach name for a club, for club-search result cards.
create or replace function public.coach_name_for_club(p_club_id uuid)
returns text language sql security definer as $$
  select name from public.coaches where club_id = p_club_id limit 1;
$$;

-- Only the athlete's CURRENTLY assigned coach may move them to a different
-- coach/club or flip is_private — the athlete's own device keeps
-- self-reporting readiness/status/note/weight_kg (see syncMyClubCard in
-- api.js — a real, working feature, NOT locked down here). On INSERT
-- (self-join), coach_id must be null or the club's REAL current coach —
-- never an arbitrary id the client makes up.
create or replace function public.lock_athlete_assignment()
returns trigger language plpgsql security definer as $$
declare
  real_coach uuid;
begin
  if auth.uid() is null then
    return new; -- SQL editor / service role — razvijalec ima poln nadzor
  end if;

  if tg_op = 'INSERT' then
    if new.coach_id = auth.uid() then
      return new; -- coach adding an athlete (addAthleteToClub) — že omejeno
                   -- s "athletes cins" politiko
    end if;
    select id into real_coach from public.coaches where club_id = new.club_id;
    if new.coach_id is not distinct from real_coach then
      return new; -- self-join (athletes self join) z resničnim trenerjem — ok
    end if;
    new.coach_id := real_coach; -- popravi namesto da zavrne
    return new;
  end if;

  -- UPDATE
  if auth.uid() <> old.coach_id then
    new.coach_id   := old.coach_id;
    new.club_id    := old.club_id;
    new.is_private := old.is_private;
  end if;
  return new;
end;
$$;

drop trigger if exists athletes_lock_assignment on public.athletes;
create trigger athletes_lock_assignment
  before insert or update on public.athletes
  for each row execute procedure public.lock_athlete_assignment();

-- ─────────────────────────── storage (avatars) ───────────────────────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Own-folder scoping — uploadAvatar()/coach Settings.tsx both write to
-- `${userId}/...`.
drop policy if exists "avatars read"  on storage.objects;
drop policy if exists "avatars write" on storage.objects;
drop policy if exists "avatars upd"   on storage.objects;
create policy "avatars read"  on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars write" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars upd" on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────── seed ───────────────────────────
-- Demo coach/athletes only make sense if scripts/create-athletes.mjs was run
-- against THIS project (creates the auth.users rows these ids reference).
-- Guarded with `where exists` against auth.users so that on a project where
-- those demo accounts were never created, this section is a harmless no-op
-- instead of a foreign-key error that rolls back the WHOLE script (schema,
-- RLS, RPCs) — the file already promises "safe to re-run", this makes that
-- promise hold even when the demo accounts don't exist.
insert into public.clubs (id, name) values
  ('a1111111-1111-1111-1111-111111111111', 'NK Domžale')
  on conflict (id) do nothing;

insert into public.coaches (id, club_id, name, role)
select '2f2a6a12-a7a0-452a-9658-3e1c5796755c', 'a1111111-1111-1111-1111-111111111111', 'Coach Matej', 'Glavni trener'
where exists (select 1 from auth.users where id = '2f2a6a12-a7a0-452a-9658-3e1c5796755c')
on conflict (id) do update set club_id = excluded.club_id, name = excluded.name;

insert into public.athletes (user_id, club_id, coach_id, initials, name, username, note, readiness, status, weight_kg, is_private)
select v.user_id, v.club_id, v.coach_id, v.initials, v.name, v.username, v.note, v.readiness, v.status, v.weight_kg, v.is_private
from (values
  ('03a71e08-f878-4ff6-b3b3-c3aaf95d9537'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'LK','Luka Kovač','luka.kovac','Ready · last training today',92,'ready',75.0::numeric,false),
  ('a0aa70e5-7969-4771-91f6-4b2892b81dfb'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'NM','Nina Mlakar','nina.mlakar','Ready · recovery good',88,'ready',62.4::numeric,false),
  ('7ce13c2a-c64c-437b-93c2-b00f0a67133f'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'TŽ','Tim Žagar','tim.zagar','Slightly tired · 6h of sleep',71,'slightly-tired',80.1::numeric,false),
  ('d53e2f5c-4899-46c2-bb9c-3a52bf3e9649'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'EH','Eva Horvat','eva.horvat','Ready',85,'ready',58.6::numeric,true),
  ('c84cb768-e5d8-429d-9058-d29414306415'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'JN','Jure Novak','jure.novak','Tired · rest recommended',48,'tired',84.3::numeric,false),
  ('d86992d7-dd12-4ed3-b958-043e1ed2910b'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'AK','Ana Kos','ana.kos','Ready',96,'ready',60.2::numeric,false),
  ('88c77a08-eb88-47e8-9574-881cf7d6f61e'::uuid,'a1111111-1111-1111-1111-111111111111'::uuid,'2f2a6a12-a7a0-452a-9658-3e1c5796755c'::uuid,'MP','Marko Potočnik','marko.potocnik','Slightly tired',71,'slightly-tired',77.8::numeric,true)
) as v(user_id, club_id, coach_id, initials, name, username, note, readiness, status, weight_kg, is_private)
where exists (select 1 from auth.users u where u.id = v.user_id)
on conflict do nothing;
