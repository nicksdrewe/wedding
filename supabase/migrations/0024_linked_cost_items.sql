-- Lets one cost line-item (e.g. a "Food" cost logged as an option under
-- Venue) also appear under a second category (Catering) without being
-- duplicated. This is a pure pointer table, not a second cost row — every
-- render re-reads the live page_options/page_option_images row through the
-- link, so an edit at the source (name, image, cost) automatically shows up
-- everywhere it's linked, with nothing to keep in sync.

create table cost_item_links (
  id uuid primary key default gen_random_uuid(),
  source_page_option_id uuid not null references page_options(id) on delete cascade,
  linked_category_page_id uuid not null references category_pages(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_page_option_id, linked_category_page_id)
);

alter table cost_item_links enable row level security;

-- Mirrors page_options' own read policy (0001_init.sql) — anyone who can
-- see the source item can see that it's linked.
create policy "family reads cost item links" on cost_item_links for select using (
  is_family_or_above()
);

-- Mirrors page_options' write policy for category-linked options
-- (0004_option_groups.sql) — only the couple manages links, since a linked
-- item is always sourced from a category-linked (couple-only) option.
create policy "couple manages cost item links" on cost_item_links for all using (
  is_couple()
) with check (
  is_couple()
);
