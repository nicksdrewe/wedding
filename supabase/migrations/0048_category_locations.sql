-- A category can have a place on the map. A destination like "Porto" is a
-- category with its own pin; its parent ("Stag do") then shows every
-- destination on one map with each one's total, and Porto's own page maps the
-- accommodation, activities and so on inside it from their pins.
--
-- A category without a pin of its own is placed automatically from the pins of
-- the options beneath it (the app averages them), so this is only needed for a
-- place with no pinned options yet.
--
-- Who can set it is whoever can already rename the category (the couple; a
-- board's admin on a stag/hen board). Additive; safe before or after the app
-- deploy (the app copes with the columns not existing yet).

alter table category_pages
  add column if not exists latitude double precision check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude is null or longitude between -180 and 180);
