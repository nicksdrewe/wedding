-- Family can open the Groomsmen and Bridesmaids pages (they inherit "Project",
-- which family may see) even though everything on those boards is hidden from
-- them by the database, so they only ever saw an empty page. Found by the
-- per-person smoke test (tests/personas). Give those two pages an explicit
-- "no access" rule for family, so they are turned away like everyone else who
-- isn't on that board. The couple can still change this in Roles & Access.
--
-- Data only; safe to run before or after the app deploy.

insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
values
  ('project:groomsmen', 'role', 'family', false, false, false, false),
  ('project:bridesmaids', 'role', 'family', false, false, false, false)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = false, data_access = false, edit_access = false, cost_access = false;
