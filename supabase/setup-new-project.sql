-- ════════════════════════════════════════════════════════════
-- ATHLOS — POSTAVITEV NOVEGA SUPABASE PROJEKTA (vse v enem)
-- Prilepi CELO datoteko v SQL Editor novega projekta → Run.
-- Zdruzuje: schema.sql + coach-data.sql (BREZ demo seed) + demo-upgrade.sql
-- Idempotentno — varno je zagnati veckrat.
-- ════════════════════════════════════════════════════════════

-- ############## 1/3  schema.sql ##############
-- ATHLOS — Supabase shema
-- Zaženi to v Supabase: SQL Editor → New query → prilepi → Run.

-- Tabela profilov (en profil na uporabnika; id = auth uporabnik)
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  sport      text,
  birth      text,
  height     numeric,
  weight     numeric,
  photo      text,            -- base64 ali url; za večje slike kasneje uporabi Storage
  plan       text default 'basic',  -- izbrani naročniški plan (basic/pro/elite)
  lang       text default 'sl',     -- jezik aplikacije (sl/en)
  role       text default 'athlete', -- 'athlete' = navadna app, 'coach' = coach app
  updated_at timestamptz default now()
);

-- Če si shemo zagnal že prej (tabela obstaja brez stolpca "plan"), zaženi še to:
alter table public.profiles add column if not exists plan text default 'basic';
alter table public.profiles add column if not exists lang text default 'sl';
alter table public.profiles add column if not exists role text default 'athlete';
alter table public.profiles add column if not exists theme text; -- 'light' | 'dark' (per-account)

-- Extended onboarding (SetupFlow) — everything the athlete enters during setup
-- is now persisted on their profile instead of living only in the local cache.
-- Arrays (goals / injuries / equipment) go to jsonb; the injury photo is the
-- compressed (<=512px) data URL, same as the avatar `photo` column.
alter table public.profiles add column if not exists acquisition  text;
alter table public.profiles add column if not exists gender       text;
alter table public.profiles add column if not exists waist        numeric;
alter table public.profiles add column if not exists body_fat     numeric;
alter table public.profiles add column if not exists experience   numeric;
alter table public.profiles add column if not exists goals        jsonb;
alter table public.profiles add column if not exists injuries     jsonb;
alter table public.profiles add column if not exists injury_note  text;
alter table public.profiles add column if not exists injury_photo text;
alter table public.profiles add column if not exists equipment    jsonb;
-- Nekoga narediš za coacha (zamenjaj e-naslov):
--   update public.profiles set role = 'coach'
--   where id = (select id from auth.users where email = 'coach@primer.si');

-- Row Level Security: vsak uporabnik vidi/ureja SAMO svoj profil
alter table public.profiles enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile write"  on public.profiles;
drop policy if exists "own profile update" on public.profiles;

create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Prikazna imena so unikatna (brez razlike med velikimi/malimi črkami).
-- Če index javi duplikate, jih najprej poglej:
--   select name, count(*) from public.profiles group by name having count(*) > 1;
create unique index if not exists profiles_name_unique
  on public.profiles (lower(name)) where name is not null;

-- Iskanje uporabnikov po imenu (za "Nov pogovor" v chatu). SECURITY DEFINER,
-- ker RLS dovoli branje samo lastnega profila — funkcija vrne zgolj id + ime.
-- drop najprej: če stara verzija vrača drugačne stolpce, je "create or
-- replace" ne sme spremeniti (42P13)
drop function if exists public.search_users(text);
create function public.search_users(q text)
returns table (user_id uuid, name text, photo text)
language sql security definer as $$
  select id, name, photo from public.profiles
  where name is not null
    and length(trim(q)) >= 2
    and name ilike '%' || trim(q) || '%'
    and id <> auth.uid()
  order by name
  limit 20;
$$;

-- Javni delček profila (ime + slika) za poljuben seznam uporabnikov — za
-- avatarje v chatu/klubu. SECURITY DEFINER iz istega razloga kot search_users;
-- vrne SAMO id, ime in javni URL slike, nič drugega.
drop function if exists public.public_profiles(uuid[]);
create function public.public_profiles(ids uuid[])
returns table (user_id uuid, name text, photo text)
language sql security definer as $$
  select id, name, photo from public.profiles where id = any(ids);
$$;

-- Ali prikazno ime že uporablja kdo drug?
create or replace function public.name_taken(n text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where lower(name) = lower(trim(n)) and id <> auth.uid()
  );
$$;

-- Ko se ustvari nov uporabnik, samodejno naredi prazno vrstico profila
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- Role je RAZVIJALSKO nadzorovan: klient ga NIKOLI ne sme nastaviti
-- ali spremeniti. Nov račun je vedno 'athlete'; obstoječemu se role
-- ohrani ne glede na to, kaj pošlje aplikacija. Le povezava BREZ
-- končnega uporabnika (Supabase SQL editor / service_role) — torej
-- razvijalec — lahko nastavi 'coach'.
create or replace function public.lock_profile_role()
returns trigger language plpgsql security definer as $$
begin
  -- auth.uid() je NULL v SQL editorju in pri service_role → razvijalec ima poln nadzor.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'athlete';   -- vsak nov uporabnik prek aplikacije je athlete
  else
    new.role := old.role;    -- klient ne more spremeniti svojega role-a
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
  before insert or update on public.profiles
  for each row execute procedure public.lock_profile_role();

-- ────────────────────────────────────────────────────────────
-- Enak vzorec kot lock_profile_role: `plan` (naročniški nivo) je prav tako
-- RAZVIJALSKO/plačilno nadzorovan — sprememba mora priti iz plačilnega
-- webhooka ali admin akcije, NIKOLI iz navadnega profile-save klica v appu.
create or replace function public.lock_profile_plan()
returns trigger language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return new; -- SQL editor / service role (payment webhook) — poln nadzor
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'basic';       -- vsak nov uporabnik začne na basic
  else
    new.plan := old.plan;      -- klient ne more spremeniti svojega plana
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_plan on public.profiles;
create trigger profiles_lock_plan
  before insert or update on public.profiles
  for each row execute procedure public.lock_profile_plan();

-- ════════════════════════════════════════════════════════════
-- Sezona: koledarski dogodki (trening / tekma / regeneracija)
-- ════════════════════════════════════════════════════════════
create table if not exists public.season_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('trening','tekma','recovery')),
  title      text not null,
  date       date not null,
  time       text not null default '17:00',
  completed  boolean not null default false,
  created_at timestamptz default now()
);

-- Idempotent: add the column if this table already existed pre-completion-tracking.
alter table public.season_events add column if not exists completed boolean not null default false;

alter table public.season_events enable row level security;

drop policy if exists "own events select" on public.season_events;
drop policy if exists "own events insert" on public.season_events;
drop policy if exists "own events update" on public.season_events;
drop policy if exists "own events delete" on public.season_events;

create policy "own events select" on public.season_events for select using (auth.uid() = user_id);
create policy "own events insert" on public.season_events for insert with check (auth.uid() = user_id);
create policy "own events update" on public.season_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own events delete" on public.season_events for delete using (auth.uid() = user_id);

create index if not exists season_events_user_date on public.season_events (user_id, date);

-- ════════════════════════════════════════════════════════════
-- Opravljeni treningi (zgodovina za statistiko in poročila)
-- ════════════════════════════════════════════════════════════
create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  date         date not null default current_date,
  duration_sec integer not null default 0,
  sets_done    integer not null default 0,
  exercises    jsonb,            -- [{name, sets, reps}, ...]
  created_at   timestamptz default now()
);

alter table public.workouts enable row level security;

drop policy if exists "own workouts select" on public.workouts;
drop policy if exists "own workouts insert" on public.workouts;
drop policy if exists "own workouts delete" on public.workouts;

create policy "own workouts select" on public.workouts for select using (auth.uid() = user_id);
create policy "own workouts insert" on public.workouts for insert with check (auth.uid() = user_id);
create policy "own workouts delete" on public.workouts for delete using (auth.uid() = user_id);

create index if not exists workouts_user_date on public.workouts (user_id, date desc);

-- ════════════════════════════════════════════════════════════
-- AI pogovor (zgodovina sporočil AI trenerja)
-- ════════════════════════════════════════════════════════════
create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz default now()
);

alter table public.ai_messages enable row level security;

drop policy if exists "own ai select" on public.ai_messages;
drop policy if exists "own ai insert" on public.ai_messages;
drop policy if exists "own ai delete" on public.ai_messages;

create policy "own ai select" on public.ai_messages for select using (auth.uid() = user_id);
create policy "own ai insert" on public.ai_messages for insert with check (auth.uid() = user_id);
create policy "own ai delete" on public.ai_messages for delete using (auth.uid() = user_id);

create index if not exists ai_messages_user_time on public.ai_messages (user_id, created_at);

-- ════════════════════════════════════════════════════════════
-- AI trener — UČEČA SE memory baza (en zapis na športnika)
-- `data` (jsonb) hrani: funnel odgovore (cilj, nivo, faza, oprema, dnevi,
-- trajanje, poškodbe) + naučene opombe (notes[]) + povratne informacije
-- s treningov (feedback[]). Agent ga vrine v vsak pogovor in z njim "raste".
-- ════════════════════════════════════════════════════════════
create table if not exists public.coach_memory (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.coach_memory enable row level security;

drop policy if exists "own coach_memory select" on public.coach_memory;
drop policy if exists "own coach_memory insert" on public.coach_memory;
drop policy if exists "own coach_memory update" on public.coach_memory;

create policy "own coach_memory select" on public.coach_memory for select using (auth.uid() = user_id);
create policy "own coach_memory insert" on public.coach_memory for insert with check (auth.uid() = user_id);
create policy "own coach_memory update" on public.coach_memory for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- Chat — conversations, members, messages, blocks
-- ════════════════════════════════════════════════════════════

-- Tables first — the helper function below references conversation_members,
-- and Postgres validates SQL function bodies at creation time.
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('direct', 'group')),
  name        text,
  background  text default 'default',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  joined_at       timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- Security-definer helper: true when auth.uid() is a member of a conversation.
-- Used in RLS policies to avoid infinite recursion.
create or replace function public.is_conversation_member(conv_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;

drop policy if exists "conv member select" on public.conversations;
drop policy if exists "conv member insert" on public.conversations;
drop policy if exists "conv member update" on public.conversations;

-- creator must see the row too: the app inserts the conversation and reads it
-- back BEFORE adding members, so member-only select would break creation
create policy "conv member select" on public.conversations
  for select using (created_by = auth.uid() or public.is_conversation_member(id));
create policy "conv member insert" on public.conversations
  for insert with check (created_by = auth.uid());
create policy "conv member update" on public.conversations
  for update using (public.is_conversation_member(id)) with check (public.is_conversation_member(id));

alter table public.conversation_members enable row level security;

drop policy if exists "cm select" on public.conversation_members;
drop policy if exists "cm insert" on public.conversation_members;
drop policy if exists "cm delete" on public.conversation_members;

create policy "cm select" on public.conversation_members
  for select using (user_id = auth.uid() or public.is_conversation_member(conversation_id));
create policy "cm insert" on public.conversation_members
  for insert with check (
    user_id = auth.uid() or
    exists (select 1 from public.conversations where id = conversation_id and created_by = auth.uid())
  );
create policy "cm delete" on public.conversation_members
  for delete using (user_id = auth.uid());

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  type            text not null default 'text' check (type in ('text','image','video','file','sticker')),
  content         text,
  attachment_url  text,
  created_at      timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "msg select" on public.messages;
drop policy if exists "msg insert" on public.messages;
drop policy if exists "msg delete" on public.messages;

create policy "msg select" on public.messages
  for select using (public.is_conversation_member(conversation_id));
create policy "msg insert" on public.messages
  for insert with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
create policy "msg delete" on public.messages
  for delete using (sender_id = auth.uid());

create index if not exists messages_conv_time on public.messages (conversation_id, created_at);

create table if not exists public.blocks (
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks select" on public.blocks;
drop policy if exists "blocks insert" on public.blocks;
drop policy if exists "blocks delete" on public.blocks;

create policy "blocks select" on public.blocks for select using (blocker_id = auth.uid());
create policy "blocks insert" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "blocks delete" on public.blocks for delete using (blocker_id = auth.uid());

-- Storage bucket for chat attachments (public so image URLs render directly)
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true)
  on conflict (id) do nothing;

-- Write/update are scoped to the caller's own folder (uploadChatAttachment()
-- in api.js always writes to `${userId}/...`).
drop policy if exists "chat-attach read"  on storage.objects;
drop policy if exists "chat-attach write" on storage.objects;
create policy "chat-attach read"  on storage.objects for select using (bucket_id = 'chat-attachments');
create policy "chat-attach write" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage bucket for profile avatars (public so the photo URL renders directly)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Same own-folder scoping — uploadAvatar()/coach Settings.tsx both write to
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

-- ############## 2/3  coach-data.sql (samo tabele/RLS/storage, brez seed) ##############
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
-- mode `is_conversation_member()` above already exists to avoid.
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

-- ############## 3/3  demo-upgrade.sql ##############
-- ATHLOS — demo upgrade: real clubs + community.
-- Run ONCE in the Supabase dashboard (SQL Editor → Run). Idempotent.
--
-- Adds:
--  1. clubs.location + clubs.conversation_id (the club's group chat)
--  2. clubs insert/update policies so a coach can create + edit their club
--  3. athletes self-join / self-leave policies (an athlete joins a club
--     from the Community tab; before, only the coach could insert rows)

-- ── 1. columns ────────────────────────────────────────────────
alter table public.clubs add column if not exists location text;
alter table public.clubs add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

-- ── 2. clubs policies ─────────────────────────────────────────
-- Only a coach-role account may create a club — role itself is
-- developer/SQL-editor controlled (see lock_profile_role above), and the
-- app's coach-onboarding UI is already gated on profile.role === "coach"
-- (App.jsx), so this matches actual usage and closes the direct-API-call hole
-- where any athlete account could insert a club row. Editing stays limited
-- to the club's coach.
drop policy if exists "clubs insert" on public.clubs;
create policy "clubs insert" on public.clubs
  for insert to authenticated with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

drop policy if exists "clubs update" on public.clubs;
create policy "clubs update" on public.clubs
  for update to authenticated
  using (exists (select 1 from public.coaches c where c.club_id = clubs.id and c.id = auth.uid()))
  with check (exists (select 1 from public.coaches c where c.club_id = clubs.id and c.id = auth.uid()));

-- ── 3. athletes self-join / self-leave ────────────────────────
drop policy if exists "athletes self join" on public.athletes;
create policy "athletes self join" on public.athletes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "athletes self leave" on public.athletes;
create policy "athletes self leave" on public.athletes
  for delete to authenticated using (user_id = auth.uid());

-- A coach may also remove athletes from their club.
drop policy if exists "athletes coach remove" on public.athletes;
create policy "athletes coach remove" on public.athletes
  for delete to authenticated using (coach_id = auth.uid());

-- ── 4. daily check-ins — real per-user readiness data ──────────
-- One row per athlete per day: what they actually reported (sleep quality,
-- mood, soreness, stress, hours slept, hydration). This is the ONLY input
-- to a real user's readiness score — no wearable data is fabricated.
-- A brand-new athlete has zero rows here, so their readiness is 0 / "no
-- data yet" until they submit their first check-in.
create table if not exists public.checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  date           date not null,
  sleep_quality  int,   -- 1-5
  mood           int,   -- 1-5
  soreness       int,   -- 1-5
  stress         int,   -- 1-5
  sleep_h        numeric,
  hydration      int,   -- 0-120 %
  created_at     timestamptz default now(),
  unique (user_id, date)
);

alter table public.checkins enable row level security;

drop policy if exists "checkins select" on public.checkins;
drop policy if exists "checkins upsert" on public.checkins;
drop policy if exists "checkins update" on public.checkins;
create policy "checkins select" on public.checkins for select to authenticated using (user_id = auth.uid());
create policy "checkins upsert" on public.checkins for insert to authenticated with check (user_id = auth.uid());
create policy "checkins update" on public.checkins for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists checkins_user_date on public.checkins (user_id, date desc);
