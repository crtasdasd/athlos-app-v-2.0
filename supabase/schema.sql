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

-- ════════════════════════════════════════════════════════════
-- Communities — public, discoverable groups (Slovenija, Muharji, …)
-- ════════════════════════════════════════════════════════════
create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,   -- stable key, e.g. 'slovenija'
  name        text not null,
  description text,
  flag        text,        -- emoji shown as the community's picture (e.g. '🇸🇮')
  image_url   text,        -- real photo/logo URL (Storage) — takes priority over `flag`
  created_at  timestamptz default now()
);

alter table public.communities enable row level security;

drop policy if exists "communities read" on public.communities;
create policy "communities read" on public.communities for select using (true);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('member','admin')),
  joined_at    timestamptz default now(),
  primary key (community_id, user_id)
);

alter table public.community_members enable row level security;

drop policy if exists "cmem select" on public.community_members;
drop policy if exists "cmem insert" on public.community_members;
drop policy if exists "cmem delete" on public.community_members;

-- Public communities: the member roster is visible to everyone (like seeing
-- who's in a public channel before you join) — matches `communities read`.
create policy "cmem select" on public.community_members for select using (true);
-- A user can only ever add THEMSELVES.
create policy "cmem insert" on public.community_members for insert with check (user_id = auth.uid());
-- A user can leave a community themselves.
create policy "cmem delete" on public.community_members for delete using (user_id = auth.uid());

-- Same escalation-lock pattern as profiles.role (see lock_profile_role
-- above): a client joining via the app can only ever become 'member'; only
-- the SQL editor / service role (auth.uid() is null there) may grant 'admin'.
create or replace function public.lock_community_member_role()
returns trigger language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'member';
  else
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists community_members_lock_role on public.community_members;
create trigger community_members_lock_role
  before insert or update on public.community_members
  for each row execute procedure public.lock_community_member_role();

-- Seed the two real communities (idempotent — safe to re-run).
-- Slike so v aplikaciji (public/img), zato jih strežemo z root-relativno potjo.
insert into public.communities (slug, name, description, flag, image_url)
values ('slovenija', 'Slovenija', 'Uradna Athlos skupnost za športnike iz Slovenije. Deli treninge, tekmuj na lestvicah in poveži se z lokalnimi člani.', '🇸🇮', '/img/slovenia.jpg')
on conflict (slug) do nothing;

insert into public.communities (slug, name, description, image_url)
values ('muharji', 'Muharji', null, '/img/fly.png')
on conflict (slug) do nothing;

-- Nastavi/posodobi slike tudi za ŽE obstoječe vrstice (insert zgoraj z
-- "on conflict do nothing" jih ne bi spremenil).
update public.communities set image_url = '/img/slovenia.jpg' where slug = 'slovenija';
update public.communities set image_url = '/img/fly.png'       where slug = 'muharji';

-- Nihče se NE pridruži samodejno — vsak nov uporabnik začne brez skupnosti in
-- se pridruži izrecno v aplikaciji. (Prej je bil tu "backfill", ki je s cross
-- joinom dodal VSAK profil v obe skupnosti — prav zato so se novi računi
-- prikazali kot že včlanjeni. Odstranjeno.)

-- Naredi SVOJ račun administratorja OBEH skupnosti — zamenjaj spodnji e-naslov
-- s svojim pravim, PREDEN poženeš to skripto. Vstavi te kot člana z vlogo
-- 'admin' (cross join, ki te je prej dodal, ne obstaja več). Teče kot SQL
-- editor, zato role-lock trigger dovoli 'admin'. Idempotentno.
do $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'nigga@nigga.com';
  if admin_id is not null then
    insert into public.community_members (community_id, user_id, role)
    select c.id, admin_id, 'admin'
    from public.communities c
    where c.slug in ('slovenija', 'muharji')
    on conflict (community_id, user_id) do update set role = 'admin';
  end if;
end $$;

-- ── Enkratno čiščenje (NEOBVEZNO) ────────────────────────────────────────────
-- Ker je stari backfill v obe skupnosti dodal vse obstoječe profile, so tam
-- morda računi, ki se niso pridružili sami. Odkomentiraj naslednji blok in ga
-- poženi ENKRAT, da odstraniš vse člane RAZEN administratorjev (čist začetek —
-- pravi člani se nato spet pridružijo iz aplikacije):
-- delete from public.community_members
-- where role <> 'admin'
--   and community_id in (select id from public.communities where slug in ('slovenija', 'muharji'));

-- Storage bucket for chat attachments (public so image URLs render directly)
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true)
  on conflict (id) do nothing;

-- Write/update are scoped to the caller's own folder (uploadChatAttachment()
-- in api.js always writes to `${userId}/...`) — an authenticated user can no
-- longer write into another user's folder in this shared public bucket.
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

-- ════════════════════════════════════════════════════════════
-- Communities — full module: create-your-own, private (invite code),
-- feed (posts/likes/comments), events, member follows.
-- Weekly rankings/"active members" are computed from real `workouts` rows —
-- there is no distance/calorie/strain telemetry anywhere in this app, so the
-- leaderboard only ever ranks by an actually-true number: workouts logged.
-- ════════════════════════════════════════════════════════════

alter table public.communities add column if not exists sport text;
alter table public.communities add column if not exists country text;
alter table public.communities add column if not exists privacy text not null default 'public' check (privacy in ('public','private'));
alter table public.communities add column if not exists cover_url text;
alter table public.communities add column if not exists rules text;
alter table public.communities add column if not exists weekly_challenge text;
alter table public.communities add column if not exists invite_code text;
alter table public.communities add column if not exists created_by uuid references auth.users(id) on delete set null;

create unique index if not exists communities_invite_code_unique
  on public.communities (invite_code) where invite_code is not null;

-- Membership-checking helpers, security definer so RLS on other tables can
-- call them without recursing (same trick as is_conversation_member above).
create or replace function public.is_community_member(cid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and user_id = auth.uid()
  );
$$;

create or replace function public.is_community_admin(cid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Aggregate-only bridge into `workouts` for a community's own members. The
-- workouts table itself stays fully private per-user ("own workouts select"
-- above: auth.uid() = user_id) — a plain client-side query for OTHER
-- members' workouts is silently filtered to zero rows by that RLS policy,
-- which is exactly why the leaderboard/overview never showed anyone else's
-- workout count. This returns only a per-user workout COUNT (never the
-- underlying rows), and only to a caller who is themselves a member of cid.
create or replace function public.get_community_workout_counts(cid uuid, since date default null)
returns table(user_id uuid, workouts bigint)
language plpgsql security definer as $$
begin
  if not public.is_community_member(cid) then
    return;
  end if;
  return query
    select w.user_id, count(*)::bigint
    from public.workouts w
    where w.user_id in (select cm.user_id from public.community_members cm where cm.community_id = cid)
      and (since is null or w.date >= since)
    group by w.user_id;
end;
$$;

-- "communities read" (using true, above) is a full-ROW public policy so
-- public communities stay browsable/searchable — but Postgres RLS can't
-- filter individual COLUMNS, and invite_code must stay admin-only (the
-- entire point of a private community). The client-side queries in api.js
-- never select invite_code directly for that reason; it's only ever
-- fetched through this function, which enforces the admin check itself.
create or replace function public.get_community_invite_code(cid uuid)
returns text language sql security definer as $$
  select invite_code from public.communities
  where id = cid and public.is_community_admin(cid);
$$;

-- Same client-can-only-be-'member' lock as before, PLUS one exception: the
-- creator of a brand-new community becomes its admin automatically (the
-- create_community() RPC below relies on this to grant itself admin).
create or replace function public.lock_community_member_role()
returns trigger language plpgsql security definer as $$
declare
  is_creator boolean;
begin
  if auth.uid() is null then
    return new; -- SQL editor / service role — developer has full control
  end if;
  if tg_op = 'INSERT' then
    select (created_by = auth.uid()) into is_creator
    from public.communities where id = new.community_id;
    if coalesce(is_creator, false) and new.role = 'admin' then
      return new; -- bootstrap admin for your OWN new community — allowed
    end if;
    new.role := 'member';
  else
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- Only a community's own admin(s) can edit it (description, cover, rules,
-- weekly challenge, …). Creation itself goes through create_community()
-- below, so there's no separate "communities insert" policy for clients.
drop policy if exists "communities update" on public.communities;
create policy "communities update" on public.communities
  for update using (public.is_community_admin(id)) with check (public.is_community_admin(id));

-- Anyone can self-join a PUBLIC community directly; a PRIVATE one requires
-- going through join_community_by_code() (security definer, below) instead.
drop policy if exists "cmem insert" on public.community_members;
create policy "cmem insert" on public.community_members for insert with check (
  user_id = auth.uid() and (
    (select privacy from public.communities where id = community_id) = 'public'
    or (select created_by from public.communities where id = community_id) = auth.uid()
  )
);

-- Client-facing community creation. Any signed-in athlete can start a
-- community; the creator becomes its admin in the same atomic call.
create or replace function public.create_community(
  p_name text, p_description text, p_sport text, p_country text,
  p_privacy text, p_cover_url text, p_image_url text, p_rules text
) returns public.communities
language plpgsql security definer as $$
declare
  c public.communities;
  s text;
  code text;
begin
  s := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);
  code := upper(substr(md5(random()::text), 1, 6));

  insert into public.communities
    (slug, name, description, sport, country, privacy, cover_url, image_url, rules, invite_code, created_by)
  values
    (s, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_sport, '')), ''),
     nullif(trim(coalesce(p_country, '')), ''), coalesce(nullif(p_privacy, ''), 'public'),
     p_cover_url, p_image_url, nullif(trim(coalesce(p_rules, '')), ''), code, auth.uid())
  returning * into c;

  insert into public.community_members (community_id, user_id, role) values (c.id, auth.uid(), 'admin');

  return c;
end;
$$;

-- Join a PRIVATE community by its 6-character invite code (public ones just
-- use the normal "cmem insert" self-join policy above, no code needed).
create or replace function public.join_community_by_code(p_code text)
returns public.communities
language plpgsql security definer as $$
declare
  c public.communities;
begin
  select * into c from public.communities where invite_code = upper(trim(p_code));
  if c.id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into public.community_members (community_id, user_id, role)
  values (c.id, auth.uid(), 'member')
  on conflict do nothing;
  return c;
end;
$$;

-- ── Feed: posts, likes, comments ──────────────────────────────
create table if not exists public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  content      text,
  image_url    text,
  pinned       boolean not null default false,
  created_at   timestamptz default now()
);

alter table public.community_posts enable row level security;

drop policy if exists "posts select" on public.community_posts;
drop policy if exists "posts insert" on public.community_posts;
drop policy if exists "posts delete" on public.community_posts;

create policy "posts select" on public.community_posts for select using (public.is_community_member(community_id));
create policy "posts insert" on public.community_posts for insert with check (
  user_id = auth.uid() and public.is_community_member(community_id)
  and (pinned = false or public.is_community_admin(community_id))
);
create policy "posts delete" on public.community_posts for delete using (
  user_id = auth.uid() or public.is_community_admin(community_id)
);

create index if not exists community_posts_feed on public.community_posts (community_id, pinned desc, created_at desc);

create table if not exists public.community_post_likes (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.community_post_likes enable row level security;

drop policy if exists "likes select" on public.community_post_likes;
drop policy if exists "likes insert" on public.community_post_likes;
drop policy if exists "likes delete" on public.community_post_likes;

create policy "likes select" on public.community_post_likes for select using (
  exists (select 1 from public.community_posts p where p.id = post_id and public.is_community_member(p.community_id))
);
create policy "likes insert" on public.community_post_likes for insert with check (user_id = auth.uid());
create policy "likes delete" on public.community_post_likes for delete using (user_id = auth.uid());

create table if not exists public.community_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);

alter table public.community_post_comments enable row level security;

drop policy if exists "comments select" on public.community_post_comments;
drop policy if exists "comments insert" on public.community_post_comments;
drop policy if exists "comments delete" on public.community_post_comments;

create policy "comments select" on public.community_post_comments for select using (
  exists (select 1 from public.community_posts p where p.id = post_id and public.is_community_member(p.community_id))
);
create policy "comments insert" on public.community_post_comments for insert with check (user_id = auth.uid());
create policy "comments delete" on public.community_post_comments for delete using (user_id = auth.uid());

create index if not exists community_post_comments_post on public.community_post_comments (post_id, created_at);

-- ── Events ──────────────────────────────────────────────────────
create table if not exists public.community_events (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  description  text,
  date         date not null,
  time         text default '10:00',
  location     text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now()
);

alter table public.community_events enable row level security;

drop policy if exists "events select" on public.community_events;
drop policy if exists "events insert" on public.community_events;
drop policy if exists "events delete" on public.community_events;

create policy "events select" on public.community_events for select using (public.is_community_member(community_id));
create policy "events insert" on public.community_events for insert with check (public.is_community_admin(community_id));
create policy "events delete" on public.community_events for delete using (public.is_community_admin(community_id));

create index if not exists community_events_date on public.community_events (community_id, date);

create table if not exists public.community_event_participants (
  event_id  uuid not null references public.community_events(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (event_id, user_id)
);

alter table public.community_event_participants enable row level security;

drop policy if exists "eventp select" on public.community_event_participants;
drop policy if exists "eventp insert" on public.community_event_participants;
drop policy if exists "eventp delete" on public.community_event_participants;

create policy "eventp select" on public.community_event_participants for select using (true);
create policy "eventp insert" on public.community_event_participants for insert with check (user_id = auth.uid());
create policy "eventp delete" on public.community_event_participants for delete using (user_id = auth.uid());

-- ── Follows (Members tab "Follow" button) — a plain athlete-to-athlete
-- relationship, not scoped to one community. ──
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows select" on public.follows;
drop policy if exists "follows insert" on public.follows;
drop policy if exists "follows delete" on public.follows;

create policy "follows select" on public.follows for select using (true);
create policy "follows insert" on public.follows for insert with check (follower_id = auth.uid());
create policy "follows delete" on public.follows for delete using (follower_id = auth.uid());

-- Storage bucket for community cover photos / logos / feed post images.
insert into storage.buckets (id, name, public) values ('community-media', 'community-media', true)
  on conflict (id) do nothing;

-- Same own-folder scoping — uploadCommunityMedia() in api.js writes to
-- `${userId}/...`.
drop policy if exists "community-media read"  on storage.objects;
drop policy if exists "community-media write" on storage.objects;
create policy "community-media read"  on storage.objects for select using (bucket_id = 'community-media');
create policy "community-media write" on storage.objects for insert to authenticated with check (
  bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text
);
