-- What kind of options a category holds decides which boxes its option forms
-- show: food has no use for a map pin, nights or beds, a venue wants a pin, a
-- place to stay wants a pin plus nights and how many it sleeps.
--
--   general : name, description, link, price, date, contact, photos
--   venue   : general + map pin (latitude / longitude)
--   stay    : venue + nights + sleeps
--
-- Existing categories are set from what they already hold, so nothing that is
-- in use disappears from its form: any category with an option that has nights
-- or beds becomes 'stay'; otherwise any with a map pin (or the Venue category)
-- becomes 'venue'; everything else is 'general'. The couple can change it per
-- category afterwards.
--
-- Safe to run before or after the app deploy (the app shows every box until it
-- can read this column).

alter table category_pages
  add column if not exists option_kind text not null default 'general'
  check (option_kind in ('general', 'venue', 'stay'));

update category_pages c set option_kind = 'stay'
where exists (
  select 1 from option_groups g join page_options o on o.option_group_id = g.id
  where g.category_page_id = c.id and (o.nights is not null or o.sleeps is not null)
);

update category_pages c set option_kind = 'venue'
where c.option_kind = 'general'
  and (
    c.slug = 'venue'
    or exists (
      select 1 from option_groups g join page_options o on o.option_group_id = g.id
      where g.category_page_id = c.id and (o.latitude is not null or o.longitude is not null)
    )
  );
