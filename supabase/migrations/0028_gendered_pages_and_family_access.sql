-- Two things, both from the couple's account-capabilities brief:
--
-- 1. Gendered wedding-party sub-pages (bridesmaids/groomsmen) reuse the
--    existing generic idea_boards/option_groups/tasks tables rather than
--    duplicating three tables for two near-identical audiences — scoped
--    by a new nullable visible_tag column, since 'bridesmaid'/'groomsman'
--    are contact TAGS, not role_tier values.
--
-- 2. Family gains read access to tasks (project page) and read+add (not
--    edit/delete/settle) on expenses — "same as guest, but can see
--    categories/project/guests/finance... can add expenses, but
--    otherwise all read-only". This reverses part of 0003's "family
--    should not see project management or expense data" — that was the
--    right call at the time, the brief has since changed.

alter table idea_boards add column visible_tag text;
alter table option_groups add column visible_tag text;
alter table tasks add column visible_tag text;

-- Resolves whether the current user can see/manage a visible_tag-scoped
-- row: couple always; a contact carrying that exact tag; best_man also
-- sees 'groomsman' rows and maid_of_honour also sees 'bridesmaid' rows
-- (mirroring the page-level grants in 0027), since best man/MoH are
-- framed as elevated members of their own side, not a separate tier.
create or replace function fn_has_visible_tag(p_visible_tag text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tags text[];
begin
  if p_visible_tag is null then
    return true;
  end if;
  if is_couple() then
    return true;
  end if;
  select tags into v_tags from contacts where id = (select contact_id from profiles where id = auth.uid());
  if v_tags is null then
    return false;
  end if;
  if p_visible_tag = any(v_tags) then
    return true;
  end if;
  if p_visible_tag = 'groomsman' and 'best_man' = any(v_tags) then
    return true;
  end if;
  if p_visible_tag = 'bridesmaid' and 'maid_of_honour' = any(v_tags) then
    return true;
  end if;
  return false;
end;
$$;

-- idea_boards: narrow the existing tier-based policies to non-gendered
-- rows (visible_tag is null) — RLS policies are OR'd, so without this a
-- plain wedding_party member would still see a gendered row via the old
-- broad "tier = 'wedding_party'" policy regardless of visible_tag. A
-- second, additive tag-scoped policy grants access to gendered rows
-- instead. Original policy bodies preserved verbatim from
-- 0001_init.sql/0003_project_management.sql, just wrapped.
drop policy if exists "read idea boards for your tier" on idea_boards;
create policy "read idea boards for your tier" on idea_boards for select using (
  visible_tag is null and (
    is_couple() or
    (tier = 'family' and is_family_or_above()) or
    (tier = 'wedding_party' and is_wedding_party_or_above()) or
    (tier = 'guest' and auth.uid() is not null)
  )
);
create policy "read idea boards for your tag" on idea_boards for select using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "post ideas for your tier" on idea_boards;
create policy "post ideas for your tier" on idea_boards for insert with check (
  visible_tag is null and (
    is_couple() or
    (tier = 'family' and is_family_or_above()) or
    (tier = 'wedding_party' and is_couple_or_wedding_party()) or
    (tier = 'guest' and auth.uid() is not null)
  )
);
create policy "post ideas for your tag" on idea_boards for insert with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

-- option_groups: same narrow-then-add pattern. Only the standalone write
-- policies need it (category_page_id is null branch) — a category-linked
-- group is never gendered.
drop policy if exists "family reads option groups" on option_groups;
create policy "family reads option groups" on option_groups for select using (
  visible_tag is null and (is_family_or_above() or is_couple_or_wedding_party())
);
create policy "read option groups for your tag" on option_groups for select using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "couple manages category option groups" on option_groups;
create policy "couple manages category option groups" on option_groups for insert with check (
  visible_tag is null and (
    (category_page_id is not null and is_couple())
    or (category_page_id is null and is_couple_or_wedding_party())
  )
);
create policy "manage option groups for your tag" on option_groups for insert with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "couple manages category option groups update" on option_groups;
create policy "couple manages category option groups update" on option_groups for update using (
  visible_tag is null and (
    (category_page_id is not null and is_couple())
    or (category_page_id is null and is_couple_or_wedding_party())
  )
);
create policy "manage option groups for your tag update" on option_groups for update using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "couple manages category option groups delete" on option_groups;
create policy "couple manages category option groups delete" on option_groups for delete using (
  visible_tag is null and (
    (category_page_id is not null and is_couple())
    or (category_page_id is null and is_couple_or_wedding_party())
  )
);
create policy "manage option groups for your tag delete" on option_groups for delete using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

-- page_options/page_option_images already gate through option_groups via
-- EXISTS subqueries that don't reference visible_tag, so a gendered
-- group's options are only as reachable as the group itself — no change
-- needed there.

-- tasks: same pattern, plus (separately, see below) a NEW read grant for
-- family that must stay clear of gendered rows too.
drop policy if exists "wedding party reads tasks" on tasks;
create policy "wedding party reads tasks" on tasks for select using (
  visible_tag is null and is_couple_or_wedding_party()
);
drop policy if exists "wedding party manages tasks" on tasks;
create policy "wedding party manages tasks" on tasks for all using (
  visible_tag is null and is_couple_or_wedding_party()
) with check (
  visible_tag is null and is_couple_or_wedding_party()
);
create policy "read tasks for your tag" on tasks for select using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);
create policy "manage tasks for your tag" on tasks for all using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
) with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

-- Family: read access to (non-gendered) tasks.
create policy "family reads tasks" on tasks for select using (
  visible_tag is null and is_family_or_above()
);

-- Family: read + add expenses, not edit/delete/settle — narrower than the
-- existing "wedding party manages expenses" FOR ALL policy, added
-- alongside it rather than replacing it.
create policy "family reads expenses" on expenses for select using (is_family_or_above());
create policy "family adds expenses" on expenses for insert with check (is_family_or_above());
create policy "family reads expense splits" on expense_splits for select using (is_family_or_above());
create policy "family adds expense splits" on expense_splits for insert with check (is_family_or_above());

-- page_options/page_option_images gate through option_groups via inline
-- conditions rather than trusting option_groups' own RLS (each rewrites
-- the visibility check itself) — so the visible_tag narrowing above
-- doesn't automatically apply to them; without this, a gendered
-- standalone group's OPTIONS (not just the group row itself) would still
-- be readable/writable by any wedding_party member via the old
-- is_couple_or_wedding_party() branch, regardless of visible_tag.
create or replace function fn_option_group_visible(p_option_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select fn_has_visible_tag(visible_tag) from option_groups where id = p_option_group_id;
$$;

drop policy if exists "family reads page options" on page_options;
create policy "family reads page options" on page_options for select using (
  is_couple()
  or (is_family_or_above() and fn_page_options_data_access(option_group_id) and fn_option_group_visible(option_group_id))
);

drop policy if exists "manage page options" on page_options;
create policy "manage page options" on page_options for all using (
  fn_option_group_visible(option_group_id) and exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  fn_option_group_visible(option_group_id) and exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- page_option_images' read policy was a blanket is_family_or_above() with
-- no group-awareness at all (pre-existing, not introduced by gendered
-- pages) — tightened here to actually check the owning option's
-- visibility, which also happens to close the same gendered-leak gap.
drop policy if exists "family reads page option images" on page_option_images;
create policy "family reads page option images" on page_option_images for select using (
  exists (
    select 1 from page_options po
    where po.id = page_option_images.page_option_id
      and (is_couple() or (is_family_or_above() and fn_option_group_visible(po.option_group_id)))
  )
);

drop policy if exists "manage page option images" on page_option_images;
create policy "manage page option images" on page_option_images for all using (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and fn_has_visible_tag(g.visible_tag)
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and fn_has_visible_tag(g.visible_tag)
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);
