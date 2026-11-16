-- The Big Day joins Roles & Access, so who can see and edit it can be granted
-- or taken away per role or per tag (best man, maid of honour...) like every
-- other page, instead of being fixed in code.
--
-- Today's behaviour is seeded as explicit rules so nothing changes until you
-- change it: the couple and family see and edit; best man and maid of honour
-- see and edit; every other wedding-party member sees; guests see only what has
-- been published (that is not a matrix rule, so it is not seeded here). The existing built-in rules stay too, so nothing already
-- working can break; a rule you add here GRANTS on top of them.
-- Safe to run before or after the app deploy.

insert into page_registry (page_key, label, default_min_role)
values ('big-day', 'The Big Day', 'wedding_party')
on conflict (page_key) do nothing;

insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
values
  ('big-day', 'role', 'family', true, true, true),
  ('big-day', 'tag', 'best_man', true, true, true),
  ('big-day', 'tag', 'maid_of_honour', true, true, true),
  ('big-day', 'role', 'wedding_party', true, true, false)
on conflict (page_key, principal_type, principal_value) do nothing;

-- Editing: the built-in groups OR anyone the matrix grants edit to.
create or replace function fn_can_edit_big_day()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple()
      or auth_role() = 'family'
      or fn_is_party_elevated()
      or coalesce(fn_resolve_permission('big-day', 'edit'), false);
$$;

-- Reading: editors, wedding party, or anyone the matrix grants data access to
-- (a tag such as "bridesmaid" can be given the schedule, for instance).
drop policy if exists "read big day items" on big_day_items;
create policy "read big day items" on big_day_items for select using (
  fn_can_edit_big_day()
  or auth_role() = 'wedding_party'
  or coalesce(fn_resolve_permission('big-day', 'data'), false)
  or (auth.uid() is not null and visible_to_guests and fn_big_day_published())
);
