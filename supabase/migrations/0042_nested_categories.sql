-- Nested categories: a category can sit under another, to any sensible depth
-- (Catering -> Food -> Friday breakfast). Options live on whichever category
-- they were added to; a category's cost is worked out by the app from its own
-- options plus everything beneath it (lib/categories/rollup.ts) — nothing
-- about money is stored here.
--
-- Access cascades down the tree: a rule set on a category (page / data / edit
-- / costs) applies to everything under it unless a category further down has
-- its own rule. Previously the resolvers only looked one level up.
--
-- Safe to run before the app deploy (existing categories simply have no
-- parent). The new app needs it.

alter table category_pages
  add column if not exists parent_id uuid references category_pages(id) on delete cascade,
  add column if not exists sort_order integer not null default 0;

create index if not exists category_pages_parent_idx on category_pages(parent_id);

-- A category can't be put under itself or one of its own descendants, and the
-- tree is capped at 8 levels so nothing can loop or run away.
create or replace function fn_guard_category_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cursor uuid := new.parent_id;
  v_depth int := 1;
begin
  if new.parent_id is null then
    return new;
  end if;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'A category cannot sit inside itself.';
    end if;
    v_depth := v_depth + 1;
    if v_depth > 8 then
      raise exception 'Categories can only be nested 8 levels deep.';
    end if;
    select parent_id into v_cursor from category_pages where id = v_cursor;
  end loop;
  return new;
end;
$$;

drop trigger if exists category_pages_guard_parent on category_pages;
create trigger category_pages_guard_parent
  before insert or update of parent_id on category_pages
  for each row execute function fn_guard_category_parent();

-- The page whose rules a page inherits. For a category that is its parent
-- category (or the top-level 'categories' page); for everything else the
-- registry's parent, as before.
create or replace function fn_parent_page_key(p_page_key text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_parent text;
begin
  if p_page_key is null then
    return null;
  end if;
  if p_page_key like 'categories:%' then
    select 'categories:' || p.slug into v_parent
    from category_pages c
    join category_pages p on p.id = c.parent_id
    where c.slug = substr(p_page_key, 12);
    return coalesce(v_parent, 'categories');
  end if;
  select parent_page_key into v_parent from page_registry where page_key = p_page_key;
  if v_parent is null and p_page_key like 'project:%' then
    v_parent := 'project';
  end if;
  return v_parent;
end;
$$;

-- Same rules and precedence as 0033's version — exact page first, tag rule
-- beats role rule, deny wins among tags — but it now climbs the whole chain
-- of parents instead of stopping after one.
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
  i int;
begin
  if v_role is null or p_page_key is null then
    return null;
  end if;
  if v_role = 'couple' then
    return true;
  end if;

  v_tags := fn_my_tags();

  for i in 1..10 loop
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

    v_key := fn_parent_page_key(v_key);
    if v_key is null then
      exit;
    end if;
  end loop;

  return null;
end;
$$;

-- Prices: same change, same fallback as 0031 (no rule anywhere = couple and
-- family only).
create or replace function fn_resolve_cost_access(p_page_key text)
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
  i int;
begin
  if v_role is null then
    return false;
  end if;
  if v_role = 'couple' then
    return true;
  end if;
  if p_page_key is null then
    return false;
  end if;

  v_tags := fn_my_tags();

  for i in 1..10 loop
    select array_agg(cost_access) into v_tag_rows
    from page_permissions
    where page_key = v_key
      and principal_type = 'tag'
      and fn_normalize_tag(principal_value) = any(v_tags);

    if v_tag_rows is not null then
      return not (false = any(v_tag_rows));
    end if;

    v_role_found := false;
    select cost_access, true into v_role_access, v_role_found
    from page_permissions
    where page_key = v_key and principal_type = 'role' and principal_value = v_role
    limit 1;

    if v_role_found then
      return v_role_access;
    end if;

    v_key := fn_parent_page_key(v_key);
    if v_key is null then
      exit;
    end if;
  end loop;

  return v_role = 'family';
end;
$$;
