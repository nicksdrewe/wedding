-- Every category was meant to support the same "options board with photos,
-- description, link" workflow from the moment it's created — requiring a
-- separate manual "Start Options Mode" click before any image/detail UI
-- appeared was friction nobody asked for, not a deliberate two-tier
-- design. Backfill an option_groups row for every category that doesn't
-- have one yet, so the board is just always there.
insert into option_groups (category_page_id, title)
select cp.id, cp.title
from category_pages cp
where not exists (
  select 1 from option_groups og where og.category_page_id = cp.id
);
