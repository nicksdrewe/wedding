-- Support for "view as": the couple temporarily seeing the site exactly as
-- one particular person does.
--
-- View-as works by opening a real, short-lived session as that person (the
-- only way to get exactly their access, since every rule keys off who is
-- signed in). A side effect is that Supabase stamps the person's "last
-- signed in" time — which would make the guest list claim they had signed in
-- when it was really the couple looking. This function puts that timestamp
-- back to what it was.
--
-- Callable ONLY by the server's service role. It never raises: if this
-- database won't allow the write, it returns false and view-as still works —
-- the audit log (admin_audit, 0035) remains the true record either way.
--
-- New function only; safe to run before or after the matching app deploy.

create or replace function fn_admin_restore_last_sign_in(p_user_id uuid, p_last_sign_in_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set last_sign_in_at = p_last_sign_in_at
  where id = p_user_id;
  return found;
exception when others then
  return false;
end;
$$;

revoke all on function fn_admin_restore_last_sign_in(uuid, timestamptz) from public, anon, authenticated;
grant execute on function fn_admin_restore_last_sign_in(uuid, timestamptz) to service_role;
