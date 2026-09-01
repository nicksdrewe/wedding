-- Guest self-service accounts + a third permissions axis (edit_access)
-- alongside the existing page_access/data_access from 0025 — the couple's
-- new brief needs "family can see this page but not edit it, except one
-- specific write action" and "best man can edit everything visible to him
-- except the other gender's page", which page_access/data_access alone
-- can't express (those only ever restrict, never distinguish read from
-- write). Same resolver, same admin UI, just a third boolean.

alter table contacts add column guest_note text;

-- A signed-in guest can maintain their own contact row and any +1 they
-- logged themselves (parent_contact_id pointing at them, see
-- 0011_contact_hierarchy.sql) — name, plus_one_limit, guest_note. Couple
-- retains full access via is_couple(), same pattern as every other
-- self-service policy in this schema (rsvps' "own rsvp *" policies).
create policy "guest updates own contact" on contacts for update using (
  is_couple()
  or id = (select contact_id from profiles where id = auth.uid())
  or parent_contact_id = (select contact_id from profiles where id = auth.uid())
) with check (
  is_couple()
  or id = (select contact_id from profiles where id = auth.uid())
  or parent_contact_id = (select contact_id from profiles where id = auth.uid())
);

-- Adding a new +1 is an insert, not an update — capped at the inserting
-- guest's own plus_one_limit via fn_guest_plus_one_count below, since a
-- plain RLS `with check` can't count existing sibling rows on its own.
create or replace function fn_guest_plus_one_count(p_parent_contact_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from contacts where parent_contact_id = p_parent_contact_id;
$$;

create policy "guest adds own plus ones" on contacts for insert with check (
  is_couple()
  or (
    parent_contact_id = (select contact_id from profiles where id = auth.uid())
    and fn_guest_plus_one_count(parent_contact_id) < (
      select plus_one_limit from contacts where id = parent_contact_id
    )
  )
);

-- Third permissions axis: can the resolved principal (role or tag) WRITE
-- on this page, not just see it / see its itemized data. Existing rows
-- default page_access/data_access=true (0025); backfilling edit_access to
-- match page_access keeps every already-configured row's current
-- behaviour (edit follows view, same as the app-wide default before this
-- migration) until the seed data below narrows specific roles/tags.
alter table page_permissions add column edit_access boolean not null default true;
update page_permissions set edit_access = page_access;

-- New page_registry entries this rollout introduces.
insert into page_registry (page_key, label, default_min_role, parent_page_key) values
  ('account', 'My Details', 'guest', null),
  ('project:bridesmaids', 'Bridesmaids', 'wedding_party', 'project'),
  ('project:groomsmen', 'Groomsmen', 'wedding_party', 'project');

-- Family: read access to guests/budget/project/categories, but no edit
-- rights anywhere except adding an expense — one explicit row per page
-- rather than relying on absence-means-allowed, since the couple's brief
-- draws a specific line ("read-only... can add expenses") that needs to
-- survive even if page_registry gains more pages later.
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access) values
  ('guests', 'role', 'family', true, true, false),
  ('budget', 'role', 'family', true, true, false),
  ('project', 'role', 'family', true, true, false),
  ('project:ideas', 'role', 'family', true, true, false),
  ('project:expenses', 'role', 'family', true, true, true),
  ('categories', 'role', 'family', true, true, false)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Plain wedding_party (no best_man/maid_of_honour tag): per the couple's
-- own framing, "all other pages same rights as guest" — this is NOT the
-- broad planning access the role used to imply before this rollout. Same
-- bulk pattern as the guest seed below: page_access true only on
-- diary/account, false everywhere else (including project itself and its
-- own gendered page — that page_access=true comes from the 'bridesmaid'/
-- 'groomsman' TAG row below, which the resolver prefers over this role
-- row once a member is actually tagged).
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
select page_key, 'role', 'wedding_party', (page_key in ('account', 'diary')), false, (page_key = 'account')
from page_registry
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Gendered wedding-party pages: only their own tag can see or edit theirs
-- — matching "ONLY visible to the bridesmaids OR groomsmen", not the
-- whole wedding party (the bulk row above already locked both pages out
-- for the bare role).
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access) values
  ('project:bridesmaids', 'tag', 'bridesmaid', true, true, true),
  ('project:groomsmen', 'tag', 'groomsman', true, true, true)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Best man / maid of honour: broad access matching the couple's brief
-- ("can see everything apart from the opposite function's page... edit
-- rights on everything visible to them") — granted per relevant page
-- rather than a blanket rule, then explicitly blocked from the opposite
-- gendered page. Applied to every page_key a wedding_party member would
-- otherwise reach, plus their OWN gendered page.
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
select page_key, 'tag', tag, true, true, true
from page_registry, (values ('best_man'), ('maid_of_honour')) as t(tag)
where page_key not in ('project:bridesmaids', 'project:groomsmen')
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access) values
  ('project:groomsmen', 'tag', 'best_man', true, true, true),
  ('project:bridesmaids', 'tag', 'best_man', false, false, false),
  ('project:bridesmaids', 'tag', 'maid_of_honour', true, true, true),
  ('project:groomsmen', 'tag', 'maid_of_honour', false, false, false)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Guest: page_access only on their own "My Details" page and the Diary
-- (read-only there is enforced in the app, not here — Diary has no
-- itemized-data concept to restrict). Every other existing page_key
-- defaults to page_access=false for guests so a plain contact never sees
-- the household/planning tooling at all.
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
select page_key, 'role', 'guest', (page_key in ('account', 'diary')), false, (page_key = 'account')
from page_registry
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;
