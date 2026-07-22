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
-- developer/SQL-editor controlled (see lock_profile_role in schema.sql), and
-- the app's coach-onboarding UI is already gated on profile.role === "coach"
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

-- ── 5. body weight log — real per-user weigh-ins ────────────────
-- One row per weigh-in (an athlete can log more than once a day, so this is
-- NOT unique on (user_id, date) like checkins). Powers the "Kilaža" quick
-- stat and the weight tab of the body-stats sheet — no fabricated series.
create table if not exists public.body_weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  weight_kg   numeric not null,
  created_at  timestamptz default now()
);

alter table public.body_weight_logs enable row level security;

drop policy if exists "body_weight_logs select" on public.body_weight_logs;
drop policy if exists "body_weight_logs insert" on public.body_weight_logs;
create policy "body_weight_logs select" on public.body_weight_logs for select to authenticated using (user_id = auth.uid());
create policy "body_weight_logs insert" on public.body_weight_logs for insert to authenticated with check (user_id = auth.uid());

create index if not exists body_weight_logs_user_date on public.body_weight_logs (user_id, date desc);

-- ── 6. injury reports — structured active-injury record ─────────
-- Onboarding only ever captured a flat injuries[] + free-text note; this is
-- the real "active injury" record the Injury quick-add (+ menu) and the
-- home-screen injury widget need: phase 0-3, expected return, coach note.
-- An athlete can have more than one open report; "active" = resolved_at is null.
create table if not exists public.injury_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  body_part      text not null,
  grade          int not null default 2,     -- 1 lahka · 2 zmerna · 3 huda
  phase          int not null default 0,     -- 0-3, recovery protocol phase
  note           text,
  return_weeks   int,
  coach_note     text,
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);

alter table public.injury_reports enable row level security;

drop policy if exists "injury_reports select" on public.injury_reports;
drop policy if exists "injury_reports insert" on public.injury_reports;
drop policy if exists "injury_reports update" on public.injury_reports;
create policy "injury_reports select" on public.injury_reports for select to authenticated using (user_id = auth.uid());
create policy "injury_reports insert" on public.injury_reports for insert to authenticated with check (user_id = auth.uid());
create policy "injury_reports update" on public.injury_reports for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists injury_reports_user_active on public.injury_reports (user_id, resolved_at);

-- ── 7. club address — optional precise street address for the gym ──
-- Separate from clubs.location (a loose city/region label already shown in
-- Settings). This is the exact address an athlete can drop into Maps to find
-- the gym. Nullable — a coach never has to set it.
alter table public.clubs add column if not exists address text;

-- ── 8. coach read access — the coach app spec (roster overview, player
-- profile, training history, check-in streak) needs a coach to read their
-- OWN athletes' checkins/workouts/weigh-ins/injuries. Until now every one of
-- these tables only allowed the athlete themselves to read their own row
-- (see policies above) — a coach querying them got zero rows, silently.
-- These are ADDITIONAL select policies (Postgres OR's policies for the same
-- command), so the athlete's own access is untouched.
drop policy if exists "checkins coach read" on public.checkins;
create policy "checkins coach read" on public.checkins for select to authenticated using (
  exists (select 1 from public.athletes a where a.user_id = checkins.user_id and a.coach_id = auth.uid())
);

drop policy if exists "body_weight_logs coach read" on public.body_weight_logs;
create policy "body_weight_logs coach read" on public.body_weight_logs for select to authenticated using (
  exists (select 1 from public.athletes a where a.user_id = body_weight_logs.user_id and a.coach_id = auth.uid())
);

drop policy if exists "injury_reports coach read" on public.injury_reports;
create policy "injury_reports coach read" on public.injury_reports for select to authenticated using (
  exists (select 1 from public.athletes a where a.user_id = injury_reports.user_id and a.coach_id = auth.uid())
);

drop policy if exists "workouts coach read" on public.workouts;
create policy "workouts coach read" on public.workouts for select to authenticated using (
  exists (select 1 from public.athletes a where a.user_id = workouts.user_id and a.coach_id = auth.uid())
);

-- ── 9. sick reports — real signal for the roster's "Sick" bucket ──
-- Same shape as injury_reports: a self-reported illness, resolved_at null =
-- still sick. NOTE: there is currently no athlete-facing entry point to
-- create a row here (the athlete app's "+" menu only has Injury/Edit
-- session/Weight) — this table is scaffolding for the coach roster feature.
-- Populating it for real needs one small athlete-side addition; see chat.
create table if not exists public.sick_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  note         text,
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);

alter table public.sick_reports enable row level security;

drop policy if exists "sick_reports select" on public.sick_reports;
drop policy if exists "sick_reports insert" on public.sick_reports;
drop policy if exists "sick_reports update" on public.sick_reports;
drop policy if exists "sick_reports coach read" on public.sick_reports;
create policy "sick_reports select" on public.sick_reports for select to authenticated using (user_id = auth.uid());
create policy "sick_reports insert" on public.sick_reports for insert to authenticated with check (user_id = auth.uid());
create policy "sick_reports update" on public.sick_reports for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sick_reports coach read" on public.sick_reports for select to authenticated using (
  exists (select 1 from public.athletes a where a.user_id = sick_reports.user_id and a.coach_id = auth.uid())
);

create index if not exists sick_reports_user_active on public.sick_reports (user_id, resolved_at);

-- ── 10. club privacy + join requests ────────────────────────────
-- Public club (default, matches today's behaviour): an athlete who finds it
-- via findClubs() joins instantly, same as before.
-- Private club: joinClub() no longer inserts an athletes row directly — it
-- creates a pending club_join_requests row instead. The coach approves or
-- declines from their app; only approval creates the real athletes row.
alter table public.clubs add column if not exists privacy text not null default 'public'
  check (privacy in ('public', 'private'));

create table if not exists public.club_join_requests (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz default now(),
  decided_at  timestamptz,
  unique (club_id, user_id)
);

alter table public.club_join_requests enable row level security;

drop policy if exists "club_join_requests select own" on public.club_join_requests;
drop policy if exists "club_join_requests insert own" on public.club_join_requests;
drop policy if exists "club_join_requests coach select" on public.club_join_requests;
drop policy if exists "club_join_requests coach update" on public.club_join_requests;

-- An athlete sees and creates only their own request.
create policy "club_join_requests select own" on public.club_join_requests
  for select to authenticated using (user_id = auth.uid());
create policy "club_join_requests insert own" on public.club_join_requests
  for insert to authenticated with check (user_id = auth.uid());

-- The club's coach sees and decides every request for their club.
create policy "club_join_requests coach select" on public.club_join_requests
  for select to authenticated using (
    exists (select 1 from public.coaches c where c.club_id = club_join_requests.club_id and c.id = auth.uid())
  );
create policy "club_join_requests coach update" on public.club_join_requests
  for update to authenticated using (
    exists (select 1 from public.coaches c where c.club_id = club_join_requests.club_id and c.id = auth.uid())
  ) with check (
    exists (select 1 from public.coaches c where c.club_id = club_join_requests.club_id and c.id = auth.uid())
  );

create index if not exists club_join_requests_club_status on public.club_join_requests (club_id, status);
create index if not exists club_join_requests_user on public.club_join_requests (user_id);
