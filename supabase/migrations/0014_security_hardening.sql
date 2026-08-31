-- Security audit fixes (2026-08-31). See sections below — each is
-- independent and safe to review/run as one migration.

-- =====================================================================
-- 1. CRITICAL: self-role-escalation via the "update own profile" policy
-- =====================================================================
-- The original policy (0001_init.sql) was:
--   create policy "update own profile" on profiles for update
--     using (id = auth.uid());
-- with no WITH CHECK clause. Per Postgres RLS semantics, an UPDATE policy
-- with no WITH CHECK re-runs the USING expression against the NEW row —
-- but USING here only constrains `id`, saying nothing about `role`. Any
-- signed-in user (including the default 'guest' tier every new sign-in
-- gets) could therefore run, straight from the browser with nothing more
-- than the public anon key and their own session:
--   supabase.from('profiles').update({ role: 'couple' }).eq('id', myId)
-- and RLS would allow it — instantly granting is_couple()-gated write
-- access to nearly every table in the schema (the full guest CRM,
-- expenses, invite links, notification groups, everything). No app code
-- anywhere legitimately updates role or contact_id this way — both are
-- exclusively set by the SECURITY DEFINER triggers in
-- 0002_profile_autocreate.sql (handle_new_user / sync_profile_from_contact),
-- which bypass RLS entirely — so pinning both columns to their existing
-- value here removes a capability nothing legitimate ever used.
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from profiles p where p.id = auth.uid())
    and contact_id is not distinct from (select p.contact_id from profiles p where p.id = auth.uid())
  );

-- =====================================================================
-- 2. Pin search_path on every SECURITY DEFINER function
-- =====================================================================
-- Standard Postgres/Supabase hardening: a SECURITY DEFINER function
-- without a pinned search_path resolves unqualified identifiers against
-- whatever search_path the CALLER has set, which (in principle) lets a
-- caller with schema-creation rights shadow a table/function the
-- definer-privileged function relies on. These four run on every RLS
-- check in the app, so they're worth pinning even though this project's
-- Supabase role model doesn't currently grant callers schema-create
-- rights.
create or replace function auth_role() returns role_tier
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_couple() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() = 'couple';
$$;

create or replace function is_family_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('couple', 'family');
$$;

create or replace function is_wedding_party_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('couple', 'family', 'wedding_party');
$$;

-- =====================================================================
-- 3. rsvp_token should actually be unique, and indexed
-- =====================================================================
-- Declared `unique link, no password needed` in a comment but never
-- actually constrained — /api/rsvp/[token] looks it up with
-- .maybeSingle(), which errors if Postgres ever let two rows collide.
-- gen_random_uuid() makes a real collision astronomically unlikely, but
-- there's no reason not to have Postgres guarantee it outright, and the
-- unique constraint gives this hot lookup path an index for free.
alter table contacts add constraint contacts_rsvp_token_key unique (rsvp_token);

-- =====================================================================
-- 4. Indexes on frequently-queried foreign keys / lookup columns
-- =====================================================================
-- Postgres does not auto-index foreign key columns. These are the ones
-- on the app's hot paths: every RSVP read/write filters rsvps by
-- contact_id and event_id together; the sign-in and engagement-RSVP
-- flows both look a contact up by email.
create index if not exists rsvps_contact_id_idx on rsvps (contact_id);
create index if not exists rsvps_event_id_idx on rsvps (event_id);
create index if not exists contacts_email_idx on contacts (lower(email));

-- =====================================================================
-- 5. Lightweight rate limiting for the two public, unauthenticated
--    write/lookup endpoints (api/engagement-rsvp, api/auth/request-code)
-- =====================================================================
-- Fixed-window counter keyed by an arbitrary string (route name + IP, or
-- route name + email) — deliberately simple rather than a sliding window,
-- since this only needs to stop trivial scripted abuse, not survive a
-- determined attacker. Rows are cheap to prune (see the accompanying app
-- code, which deletes its own expired window on read).
create table rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  window_start timestamptz not null default now(),
  count int not null default 1
);
create unique index rate_limit_hits_bucket_key on rate_limit_hits (bucket_key);

alter table rate_limit_hits enable row level security;
-- No policies at all: only ever touched via the service-role admin
-- client from the two public route handlers above, same as
-- invite_links — never queried directly by a browser's own session.
