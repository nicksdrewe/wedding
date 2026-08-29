-- Options mode. A single reusable structure: an option_group holds 2+
-- page_options that can be compared, then one can be picked as the winner.
-- category_page_id is nullable so the exact same mechanism works both on
-- category pages (Venue, Flowers...) and standalone inside Project
-- Management (stag/hen venue, activity...) per the brief.

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  category_page_id uuid references category_pages(id) on delete cascade,
  title text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A category page has at most one options comparison running on it.
create unique index option_groups_one_per_category
  on option_groups (category_page_id)
  where category_page_id is not null;

-- Re-point page_options at option_groups instead of category_pages directly.
-- Nothing has used this table yet (Options mode wasn't built until now), so
-- there's no data to migrate.
alter table page_options drop column category_page_id;
alter table page_options add column option_group_id uuid not null references option_groups(id) on delete cascade;

alter table option_groups enable row level security;

create policy "family reads option groups" on option_groups for select using (
  is_family_or_above() or is_couple_or_wedding_party()
);
create policy "couple manages category option groups" on option_groups for insert with check (
  (category_page_id is not null and is_couple())
  or (category_page_id is null and is_couple_or_wedding_party())
);
create policy "couple manages category option groups update" on option_groups for update using (
  (category_page_id is not null and is_couple())
  or (category_page_id is null and is_couple_or_wedding_party())
);
create policy "couple manages category option groups delete" on option_groups for delete using (
  (category_page_id is not null and is_couple())
  or (category_page_id is null and is_couple_or_wedding_party())
);

-- page_options RLS from 0001 (couple manages, family reads) already exists
-- and doesn't reference the dropped column, so it's untouched — but the
-- write policy should also allow wedding_party for standalone groups.
drop policy if exists "couple manages page options" on page_options;
create policy "manage page options" on page_options for all using (
  exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);
