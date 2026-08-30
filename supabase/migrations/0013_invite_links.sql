-- A single reusable "share link" the couple can hand to every engagement
-- party invitee (80+ people, same link for all of them) that bypasses the
-- client-side site gate (see SiteGate.tsx and /i/[token]) instead of
-- requiring each visitor to know/enter the gate code. Couple-only
-- read/write via RLS — the token is only ever looked up by the /i/[token]
-- route using the service-role admin client (bypasses RLS by design, same
-- pattern as the public engagement-rsvp endpoint), never queried directly
-- by an anonymous visitor's own Supabase client.
create table invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table invite_links enable row level security;

create policy "couple manages invite links" on invite_links for all using (is_couple()) with check (is_couple());
