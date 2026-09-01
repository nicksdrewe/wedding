-- Real-world costs rarely come as one number: a venue's £20k headline hire
-- fee might come with a buy-in wedding breakfast, wine, staff, a planner —
-- and money coming BACK (guest room recoup). This adds a per-option
-- itemized cost breakdown, each line either a cost (adds) or income
-- (subtracts), optionally computed as quantity × rate (e.g. 40 guests ×
-- £50/night) so a later headcount change doesn't need re-doing the maths
-- by hand.
--
-- Headline vs additional, per the couple's own framing: the option's own
-- predicted/actual cost (already on page_options) stays the "headline"
-- figure, net of any income lines (guest recoup) — it does NOT fold in
-- the additional cost lines (breakfast, wine, staff...), which are shown
-- as their own single sum instead. See computeOptionTotals in
-- lib/options/totals.ts for the shared arithmetic every caller uses.

alter table page_options add column nights integer;
alter table page_options add column sleeps integer;

create table option_cost_items (
  id uuid primary key default gen_random_uuid(),
  page_option_id uuid not null references page_options(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cost', 'income')),
  -- quantity/rate are an optional calculation aid only — when both are
  -- set, the app computes amount = quantity * rate and keeps it in sync;
  -- amount is still the one persisted, authoritative figure so every
  -- reader (including SQL-level rollups) only ever needs to sum one
  -- column, never re-derive it.
  quantity numeric(10,2),
  rate numeric(10,2),
  amount numeric(10,2) not null check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table option_cost_items enable row level security;

-- Mirrors page_options' own read gate (0025_page_permissions.sql) exactly
-- — a line item is exactly as sensitive as the option it belongs to.
create policy "read option cost items" on option_cost_items for select using (
  is_couple() or (
    is_family_or_above()
    and fn_page_options_data_access((select option_group_id from page_options where id = page_option_id))
  )
);

-- Mirrors page_options' own write gate (0004_option_groups.sql, "manage
-- page options") exactly — couple manages category-linked items, couple
-- or wedding_party manages standalone (Project Management) items.
create policy "manage option cost items" on option_cost_items for all using (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = option_cost_items.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = option_cost_items.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- Linking moves from the whole option (0024_linked_cost_items.sql) down
-- to a single cost line — the couple's actual example links just the
-- "wedding breakfast" line into Catering, not the entire venue option.
-- No production data to migrate (this table shipped moments before this
-- redesign), so this is a clean repoint rather than a data migration.
alter table cost_item_links drop constraint cost_item_links_source_page_option_id_fkey;
alter table cost_item_links rename column source_page_option_id to source_cost_item_id;
alter table cost_item_links add constraint cost_item_links_source_cost_item_id_fkey
  foreign key (source_cost_item_id) references option_cost_items(id) on delete cascade;
