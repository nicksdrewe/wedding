-- Support for the couple managing people's accounts from the guest list.
--
-- Accounts are now GIVEN, not self-created: the couple creates them from the
-- guest list, and sign-in only works for an account that exists. Everything
-- those actions need beyond Supabase's own admin API lives here:
--
--   * admin_audit      — who did what to whose account, and when;
--   * fn_admin_revoke_sessions — signs a person out of every device.
--
-- New table + function only, nothing existing is changed, so it is safe to
-- run before or after the matching app deploy (the new buttons that call
-- these simply report an error until it has been run).

-- ---------------------------------------------------------------------------
-- 1. Audit trail
-- ---------------------------------------------------------------------------
create table admin_audit (
  id uuid primary key default gen_random_uuid(),
  -- The couple member who did it. Kept even if their profile is later removed.
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  -- Whose account was affected. contacts rows can be deleted, so the email
  -- is recorded too: the trail must still make sense afterwards.
  target_contact_id uuid references contacts(id) on delete set null,
  target_email text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_audit_created_at_idx on admin_audit (created_at desc);

alter table admin_audit enable row level security;

-- Couple can read it. Nobody writes through RLS: entries are written only by
-- the server (service role, which bypasses RLS) as part of each action, so a
-- logged-in browser can never forge or erase a line.
create policy "couple reads admin audit" on admin_audit for select using (is_couple());

-- ---------------------------------------------------------------------------
-- 2. Sign out everywhere
-- ---------------------------------------------------------------------------
-- Supabase's admin API can only end a session if you hold that person's own
-- token, which the couple never do. Deleting the rows is what "sign out of
-- every device" means: their next request finds no session and must sign in
-- again (an already-issued access token still lives until it expires, up to
-- an hour, but can no longer be refreshed).
--
-- Callable ONLY by the server's service role — locked down below, because
-- letting anyone call it would let them sign other people out.
create or replace function fn_admin_revoke_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Compared as text so this works whether Supabase's auth schema types
  -- user_id as uuid or varchar.
  delete from auth.refresh_tokens where user_id::text = p_user_id::text;
  delete from auth.sessions where user_id::text = p_user_id::text;
end;
$$;

revoke all on function fn_admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function fn_admin_revoke_sessions(uuid) to service_role;
