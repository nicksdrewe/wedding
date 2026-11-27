-- STAGING ONLY. Run after 0056_multi_wedding.sql, in the staging project's
-- SQL editor. Never run this on the live database.
--
-- Gives you two weddings to switch between on the staging preview:
--   nickellie  (already created by 0056)  - you are the couple
--   jonsarah   (a pretend second wedding) - you are a guest, so you can see
--                                           what a different role looks like
--
-- Before running: replace you@example.com below (twice) with your email.
-- After running: Authentication -> Users -> Add user -> Create new user, same
-- email, set a password, tick "Auto confirm". Then sign in on the preview with
-- "I have a password".

do $$
declare
  a uuid := (select id from weddings where slug = 'nickellie');
  b uuid;
begin
  insert into weddings (slug, partner_one, partner_two, display_name, date_label)
  values ('jonsarah', 'Jon', 'Sarah', 'Jon & Sarah', 'Spring 2029')
  on conflict (slug) do nothing;
  b := (select id from weddings where slug = 'jonsarah');
  perform fn_seed_wedding(b, a);

  perform set_config('app.wedding_id', a::text, true);
  insert into contacts (full_name, email, role) values ('Me (couple)', 'you@example.com', 'couple');
  insert into tasks (title) values ('Nick & Ellie test task');
  insert into category_pages (slug, title) values ('venue', 'Venue (Nick & Ellie)');

  perform set_config('app.wedding_id', b::text, true);
  insert into contacts (full_name, email, role) values ('Me (guest)', 'you@example.com', 'guest');
  insert into contacts (full_name, email, role) values ('Sarah', 'sarah@example.com', 'couple');
  insert into tasks (title) values ('Jon & Sarah test task');
  insert into category_pages (slug, title) values ('venue', 'Venue (Jon & Sarah)');
end $$;
