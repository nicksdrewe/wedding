-- Extend page_options with narrative detail (description, external link) and
-- support for multiple images per option, so category pages can show the
-- full visual board while project management keeps its skimmed
-- title-plus-cost view of the exact same rows. No upload pipeline exists yet
-- (Drive integration is separate, pending) — image_url is a plain URL column
-- for now; a future upload widget writes into this same column.

alter table page_options add column if not exists description text;
alter table page_options add column if not exists web_link text;

create table if not exists page_option_images (
  id uuid primary key default gen_random_uuid(),
  page_option_id uuid not null references page_options(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table page_option_images enable row level security;

-- Same access rules as page_options itself (0001's read policy, 0004's
-- write policy): family and above can read; couple manages images on
-- category-linked options, couple or wedding party manage images on
-- standalone (Project Management) options — resolved by walking
-- page_option -> option_group, same as 0004's "manage page options" policy.
drop policy if exists "family reads page option images" on page_option_images;
create policy "family reads page option images" on page_option_images for select using (
  is_family_or_above()
);

drop policy if exists "manage page option images" on page_option_images;
create policy "manage page option images" on page_option_images for all using (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);
