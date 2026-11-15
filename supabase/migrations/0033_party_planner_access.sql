-- Best man / maid of honour get real, database-level access to planning.
--
-- They are role 'wedding_party' with an elevated tag. Until now every
-- category table (the categories themselves, their options, contacts, dates)
-- was readable only by couple + family (is_family_or_above), so the pages
-- the app let them open came back empty. This migration:
--
--   * lets them READ categories, options, photos, contacts and key dates —
--     prices stay governed separately by cost_access (0031);
--   * lets them ADD and EDIT options, photos, dates and contacts where the
--     couple has given them "Can edit" on that category;
--   * keeps DELETING categories, deleting category options/contacts/dates,
--     and choosing the winning option couple-only;
--   * makes "Page access" and "Can edit" in Roles & Access real for these
--     tables (they were app-level hints only), for family as well.
--
-- Policies and functions only — no table or column changes — so it is safe
-- to run before or after the matching app deploy.
--
-- Depends on 0030 (fn_normalize_tag), 0031 (cost access, fn_can_manage_page_option)
-- and 0032 (old price columns gone — required, or opening option rows here
-- would expose them).

-- ---------------------------------------------------------------------------
-- 1. Who is asking
-- ---------------------------------------------------------------------------
-- The signed-in user's contact tags, normalised. One definition, used by
-- every tag comparison below, so a hand-edited "Best Man" can never fail to
-- match 'best_man' in one place and match in another.
create or replace function fn_my_tags()
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(fn_normalize_tag(t)), '{}')
  from contacts c, unnest(c.tags) as t
  where c.id = (select contact_id from profiles where id = auth.uid());
$$;

create or replace function fn_is_party_elevated()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth_role() = 'wedding_party'
     and fn_my_tags() && array['best_man', 'maid_of_honour'];
$$;

-- Same logic as 0028's version, now comparing normalised tags.
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
  v_tags := fn_my_tags();
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

-- ---------------------------------------------------------------------------
-- 2. One resolver for the page / data / edit axes
-- ---------------------------------------------------------------------------
-- Returns the configured answer for the current user on one axis, or NULL
-- when no rule matches at all — each caller then applies its own default.
-- Same precedence as everywhere else: exact page before parent; tag rule
-- beats role rule; among several matching tags, deny wins. (cost_access
-- keeps its own resolver from 0031, untouched.)
create or replace function fn_resolve_permission(p_page_key text, p_axis text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text := auth_role();
  v_tags text[];
  v_key text := p_page_key;
  v_tag_rows boolean[];
  v_role_access boolean;
  v_role_found boolean;
  v_parent text;
  i int;
begin
  if v_role is null or p_page_key is null then
    return null;
  end if;
  if v_role = 'couple' then
    return true;
  end if;

  v_tags := fn_my_tags();

  for i in 1..2 loop
    select array_agg(case p_axis
             when 'page' then page_access
             when 'data' then data_access
             when 'edit' then edit_access
           end) into v_tag_rows
    from page_permissions
    where page_key = v_key
      and principal_type = 'tag'
      and fn_normalize_tag(principal_value) = any(v_tags);

    if v_tag_rows is not null then
      return not (false = any(v_tag_rows));
    end if;

    v_role_found := false;
    select case p_axis
             when 'page' then page_access
             when 'data' then data_access
             when 'edit' then edit_access
           end, true
      into v_role_access, v_role_found
    from page_permissions
    where page_key = v_key and principal_type = 'role' and principal_value = v_role
    limit 1;

    if v_role_found then
      return v_role_access;
    end if;

    select parent_page_key into v_parent from page_registry where page_key = v_key;
    if v_parent is null then
      v_parent := case
        when v_key like 'categories:%' then 'categories'
        when v_key like 'project:%' then 'project'
        else null
      end;
    end if;
    if v_parent is null then
      exit;
    end if;
    v_key := v_parent;
  end loop;

  return null;
end;
$$;

-- data_access keeps its existing meaning and default ("allowed" when no rule
-- matches), now via the shared resolver so its tag comparison is normalised.
create or replace function fn_resolve_data_access(p_page_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(fn_resolve_permission(p_page_key, 'data'), true);
$$;

-- ---------------------------------------------------------------------------
-- 3. Category-level answers
-- ---------------------------------------------------------------------------
create or replace function fn_category_page_key(p_category_page_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select 'categories:' || slug from category_pages where id = p_category_page_id;
$$;

-- May this user see this category at all. Family keeps its baseline (yes,
-- unless the couple has switched Page access off for them on it); best man /
-- maid of honour need a rule saying yes (seeded on 'categories' since 0027);
-- plain wedding party and guests never.
create or replace function fn_can_view_category(p_category_page_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple()
      or (auth_role() = 'family'
          and coalesce(fn_resolve_permission(fn_category_page_key(p_category_page_id), 'page'), true))
      or (fn_is_party_elevated()
          and coalesce(fn_resolve_permission(fn_category_page_key(p_category_page_id), 'page'), false));
$$;

-- May this user add to / edit this category's contents: they can see it AND
-- have "Can edit" on it. No rule means no.
create or replace function fn_can_edit_category(p_category_page_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple()
      or (fn_can_view_category(p_category_page_id)
          and coalesce(fn_resolve_permission(fn_category_page_key(p_category_page_id), 'edit'), false));
$$;

-- ---------------------------------------------------------------------------
-- 4. Option-group-level answers
-- ---------------------------------------------------------------------------
-- Category group  -> follows its category (plus the existing data_access
--                    switch that hides itemised options).
-- Tagged group    -> the stag/hen boards: holders of the tag (0028).
-- Untagged
-- standalone      -> the main project board: couple, family, best man / maid
--                    of honour. (Previously ANY wedding-party member could
--                    read and edit these; plain members have no access to
--                    that page, so the database now agrees.)
create or replace function fn_can_read_option_group(p_option_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
      when is_couple() then true
      when g.category_page_id is not null then
        fn_can_view_category(g.category_page_id)
        and fn_resolve_data_access(fn_category_page_key(g.category_page_id))
      when g.visible_tag is not null then fn_has_visible_tag(g.visible_tag)
      else is_family_or_above() or fn_is_party_elevated()
    end
    from option_groups g where g.id = p_option_group_id
  ), false);
$$;

create or replace function fn_can_edit_option_group(p_option_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
      when is_couple() then true
      when g.category_page_id is not null then
        fn_can_edit_category(g.category_page_id)
        and fn_resolve_data_access(fn_category_page_key(g.category_page_id))
      when g.visible_tag is not null then fn_has_visible_tag(g.visible_tag)
      else (is_family_or_above() or fn_is_party_elevated())
           and coalesce(fn_resolve_permission('project', 'edit'), false)
    end
    from option_groups g where g.id = p_option_group_id
  ), false);
$$;

-- 0031's cost tables ask this before allowing a price edit; it now follows
-- the same rule as editing the option itself.
create or replace function fn_can_manage_page_option(p_page_option_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select fn_can_edit_option_group(po.option_group_id) from page_options po where po.id = p_page_option_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------

-- Categories: read widened; create / rename / delete stay couple-only
-- (those three policies from 0001 are untouched).
drop policy if exists "family reads category pages" on category_pages;
create policy "read category pages" on category_pages for select using (
  fn_can_view_category(id)
);

-- Options.
drop policy if exists "family reads page options" on page_options;
drop policy if exists "manage page options" on page_options;
create policy "read page options" on page_options for select using (
  fn_can_read_option_group(option_group_id)
);
create policy "add page options" on page_options for insert with check (
  fn_can_edit_option_group(option_group_id)
);
create policy "edit page options" on page_options for update using (
  fn_can_edit_option_group(option_group_id)
) with check (
  fn_can_edit_option_group(option_group_id)
);
-- Removing an option from a CATEGORY is the couple's call; on the project
-- boards whoever can edit the board can remove from it, as before.
create policy "delete page options" on page_options for delete using (
  is_couple()
  or (
    fn_can_edit_option_group(option_group_id)
    and exists (
      select 1 from option_groups g
      where g.id = page_options.option_group_id and g.category_page_id is null
    )
  )
);

-- Choosing the winner on a category rewrites that category's live cost, date
-- and contact everywhere — the couple's decision. RLS can't single out one
-- column, so a trigger guards it. (auth.uid() is null for the SQL editor /
-- service role, which stay unrestricted.)
create or replace function fn_guard_category_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_winner is distinct from old.is_winner
     and auth.uid() is not null
     and not is_couple()
     and exists (
       select 1 from option_groups g
       where g.id = new.option_group_id and g.category_page_id is not null
     )
  then
    raise exception 'Only Nick or Ellie can choose the winning option for a category.';
  end if;
  return new;
end;
$$;

drop trigger if exists page_options_guard_category_winner on page_options;
create trigger page_options_guard_category_winner
  before update of is_winner on page_options
  for each row execute function fn_guard_category_winner();

-- Option photos: visible with the option; add/remove with edit rights on it.
drop policy if exists "family reads page option images" on page_option_images;
drop policy if exists "manage page option images" on page_option_images;
create policy "read page option images" on page_option_images for select using (
  exists (select 1 from page_options po where po.id = page_option_images.page_option_id)
);
create policy "manage page option images" on page_option_images for all using (
  fn_can_manage_page_option(page_option_id)
) with check (
  fn_can_manage_page_option(page_option_id)
);

-- Category contacts.
drop policy if exists "family reads category contacts" on category_contacts;
drop policy if exists "couple manages category contacts" on category_contacts;
create policy "read category contacts" on category_contacts for select using (
  fn_can_view_category(category_page_id)
);
create policy "add category contacts" on category_contacts for insert with check (
  fn_can_edit_category(category_page_id)
);
create policy "edit category contacts" on category_contacts for update using (
  fn_can_edit_category(category_page_id)
) with check (
  fn_can_edit_category(category_page_id)
);
create policy "couple deletes category contacts" on category_contacts for delete using (
  is_couple()
);

-- Key dates / diary milestones. Entries tied to a category follow that
-- category; free-standing ones are for couple, family and best man / maid of
-- honour to read, and couple-only to write. (Plain wedding party and guests
-- see EVENTS on the diary, which come from the events table, not from here.)
drop policy if exists "family reads diary" on diary_entries;
drop policy if exists "couple manages diary" on diary_entries;
create policy "read diary entries" on diary_entries for select using (
  is_couple()
  or (category_page_id is null and (is_family_or_above() or fn_is_party_elevated()))
  or (category_page_id is not null and fn_can_view_category(category_page_id))
);
create policy "add diary entries" on diary_entries for insert with check (
  is_couple()
  or (category_page_id is not null and fn_can_edit_category(category_page_id))
);
create policy "edit diary entries" on diary_entries for update using (
  is_couple()
  or (category_page_id is not null and fn_can_edit_category(category_page_id))
) with check (
  is_couple()
  or (category_page_id is not null and fn_can_edit_category(category_page_id))
);
create policy "couple deletes diary entries" on diary_entries for delete using (
  is_couple()
);

-- A category's headline cost: whoever can see its prices AND edit the
-- category may set it ("couple manages category costs" from 0001 stays, and
-- still covers delete).
create policy "cost editors add category costs" on category_costs for insert with check (
  fn_category_cost_access(category_page_id) and fn_can_edit_category(category_page_id)
);
create policy "cost editors update category costs" on category_costs for update using (
  fn_category_cost_access(category_page_id) and fn_can_edit_category(category_page_id)
) with check (
  fn_category_cost_access(category_page_id) and fn_can_edit_category(category_page_id)
);
