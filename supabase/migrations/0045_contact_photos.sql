-- A photo for each person on the guest list, shown on the Groomsmen and
-- Bridesmaids group charts. Just a link to the picture in the couple's Drive
-- (the same way every other photo on the site is stored). Who can change it is
-- whoever can already edit a contact (the couple); nothing about access
-- changes.
--
-- Additive only; safe to run before or after the app deploy (the app copes
-- with the column not existing yet, it just shows initials until it does).

alter table contacts add column if not exists photo_url text;
