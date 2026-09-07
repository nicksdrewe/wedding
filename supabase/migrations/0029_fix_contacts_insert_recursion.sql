-- Fixes a live bug in 0027's "guest adds own plus ones" INSERT policy:
-- it contains a raw (non-security-definer) subquery reading
-- contacts.plus_one_limit FROM contacts itself. A self-referential
-- subquery embedded directly in a policy ON the same table forces
-- Postgres to re-apply that table's own RLS to evaluate it — producing
-- the confirmed live error "infinite recursion detected in policy for
-- relation \"contacts\"" every time this policy's WITH CHECK is
-- evaluated (i.e. on every insert into contacts, including the couple
-- adding a guest's +1 from the guest list, since is_couple() being true
-- doesn't stop Postgres from still needing to evaluate — and thus plan —
-- this policy's full expression as part of the combined check).
--
-- fn_guest_plus_one_count (right next to the broken subquery in 0027)
-- already avoided this exact trap for its own lookup by being
-- security definer, which bypasses RLS for that query. This wraps the
-- second, previously-unwrapped subquery the same way.

create or replace function fn_contact_plus_one_limit(p_contact_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select plus_one_limit from contacts where id = p_contact_id;
$$;

drop policy if exists "guest adds own plus ones" on contacts;
create policy "guest adds own plus ones" on contacts for insert with check (
  is_couple()
  or (
    parent_contact_id = (select contact_id from profiles where id = auth.uid())
    and fn_guest_plus_one_count(parent_contact_id) < coalesce(fn_contact_plus_one_limit(parent_contact_id), 0)
  )
);
