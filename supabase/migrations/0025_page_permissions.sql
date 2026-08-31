-- Role/tag page-access admin. Layers on top of the existing is_couple()/
-- is_family_or_above()/is_wedding_party_or_above() functions rather than
-- replacing them (those stay the baseline on every existing table) — this
-- adds two independent, couple-configurable overrides per page: whether a
-- role/tag can navigate to it at all (page_access, enforced in the app,
-- since the underlying rows are separately protected regardless), and
-- whether they can see itemized data on it vs. just the coarser existing
-- aggregate (data_access, enforced here via RLS on page_options — see
-- fn_page_options_data_access below).

create table page_registry (
  page_key text primary key,
  parent_page_key text references page_registry(page_key),
  label text not null,
  is_dynamic boolean not null default false,
  default_min_role role_tier,
  created_at timestamptz not null default now()
);

create table page_permissions (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references page_registry(page_key) on delete cascade,
  principal_type text not null check (principal_type in ('role', 'tag')),
  -- Either a role_tier string or a freeform contact tag — tags stay
  -- unvalidated at the DB level since contacts.tags is itself freeform
  -- (see EditableGuestRow.tsx); the admin UI autocompletes against
  -- `select distinct unnest(tags) from contacts`.
  principal_value text not null,
  page_access boolean not null default true,
  data_access boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_key, principal_type, principal_value)
);

alter table page_registry enable row level security;
alter table page_permissions enable row level security;

create policy "family reads page registry" on page_registry for select using (is_family_or_above());
create policy "couple manages page registry" on page_registry for all using (is_couple()) with check (is_couple());

create policy "family reads page permissions" on page_permissions for select using (is_family_or_above());
create policy "couple manages page permissions" on page_permissions for all using (is_couple()) with check (is_couple());

-- Static pages that exist today. Dynamic per-category/per-event rows are
-- backfilled below and auto-created going forward by the category/event
-- create actions, so nothing is ever missing a registry row.
insert into page_registry (page_key, label, default_min_role) values
  ('guests', 'Guest List', 'couple'),
  ('budget', 'Budget Tracker', 'couple'),
  ('comms', 'Guest Communications', 'couple'),
  ('categories', 'Categories', 'family'),
  ('diary', 'Diary', 'family'),
  ('project', 'Project Management', 'wedding_party'),
  ('project:ideas', 'Idea Board', 'wedding_party'),
  ('project:expenses', 'Expense Splitting', 'wedding_party'),
  ('events', 'Events', 'family');

insert into page_registry (page_key, label, is_dynamic, default_min_role, parent_page_key)
select 'categories:' || slug, title, false, 'family', 'categories'
from category_pages;

insert into page_registry (page_key, label, is_dynamic, default_min_role, parent_page_key)
select 'events:' || slug, name, false, 'family', 'events'
from events
where slug is not null;

update page_registry set is_dynamic = true where page_key in ('categories', 'events');

-- Resolves whether the current user (by role, or by any tag on their
-- linked contact) has data_access for a page_key, walking up to the
-- parent registry row once if there's no exact-match row. Absence of any
-- matching row means "unchanged default" (allowed) — this table only ever
-- adds restriction, never grants beyond what the baseline tier functions
-- already allow. The couple always gets true, so this can never lock them
-- out of their own data. Among conflicting tag-level rows, deny wins (the
-- safer default when a contact has multiple tags with different grants).
create or replace function fn_resolve_data_access(p_page_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := auth_role();
  v_tags text[];
  v_key text := p_page_key;
  v_tag_rows boolean[];
  v_role_access boolean;
  v_role_found boolean;
  v_parent text;
  v_found boolean := false;
  v_result boolean := true;
  i int;
begin
  if v_role = 'couple' then
    return true;
  end if;

  select tags into v_tags
  from contacts
  where id = (select contact_id from profiles where id = auth.uid());

  for i in 1..2 loop
    select array_agg(data_access) into v_tag_rows
    from page_permissions
    where page_key = v_key and principal_type = 'tag' and principal_value = any(coalesce(v_tags, '{}'));

    if v_tag_rows is not null then
      v_found := true;
      v_result := not (false = any(v_tag_rows));
      exit;
    end if;

    select data_access, true into v_role_access, v_role_found
    from page_permissions
    where page_key = v_key and principal_type = 'role' and principal_value = v_role
    limit 1;

    if v_role_found then
      v_found := true;
      v_result := v_role_access;
      exit;
    end if;

    select parent_page_key into v_parent from page_registry where page_key = v_key;
    if v_parent is null then
      exit;
    end if;
    v_key := v_parent;
  end loop;

  if not v_found then
    return true;
  end if;

  return v_result;
end;
$$;

-- page_options-specific wrapper: resolves the option's owning category's
-- page_key from its option_group, then delegates. Standalone (Project
-- Management) groups have no category and no permissions concept here, so
-- they're always allowed — this table only ever governs category-linked
-- itemized data.
create or replace function fn_page_options_data_access(p_option_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_page_id uuid;
  v_slug text;
begin
  select category_page_id into v_category_page_id from option_groups where id = p_option_group_id;
  if v_category_page_id is null then
    return true;
  end if;

  select slug into v_slug from category_pages where id = v_category_page_id;
  if v_slug is null then
    return true;
  end if;

  return fn_resolve_data_access('categories:' || v_slug);
end;
$$;

-- Replaces "family reads page options" (0001_init.sql) with a version that
-- also checks data_access — is_couple() is kept as an unconditional OR
-- branch so the couple's own read access here can never depend on this
-- new mechanism being configured correctly.
drop policy if exists "family reads page options" on page_options;
create policy "family reads page options" on page_options for select using (
  is_couple() or (is_family_or_above() and fn_page_options_data_access(option_group_id))
);
