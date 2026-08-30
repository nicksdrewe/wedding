-- Optional lat/long on page_options so options with a real-world location
-- (venues, primarily, but harmless on any category) can be plotted on a pin
-- map alongside the existing options board. Nullable — most options never
-- get coordinates, and the map UI skips any option missing either value.
alter table page_options add column if not exists latitude numeric(9,6);
alter table page_options add column if not exists longitude numeric(9,6);
