-- Stag and hen boards get the full planning system: nested categories with
-- options, contacts, dates, costs, votes and comments, exactly like the main
-- wedding planning, but private to the board.
--
-- A category belongs to a board when category_pages.board_tag is 'groomsman' or
-- 'bridesmaid' (null = the main wedding planning, as always). Everything
-- nested inside a board category belongs to the same board (a trigger copies
-- it down), and each category's options comparison carries the board tag too.
--
-- Who can do what on a board category:
--   * see it: the couple, and people on that board (groomsman tag, or best man
--     for the groomsmen; bridesmaid tag, or maid of honour for the
--     bridesmaids), unless the couple has switched it off in Roles & Access.
--   * add and edit options, contacts and dates, vote, comment: the same people.
--   * create / rename / move / delete categories, choose or remove a winner,
--     delete options, contacts and dates: the board's admin (best man /
--     maid of honour) and the couple.
-- Access rules the couple sets on the board's page ('project:groomsmen' /
-- 'project:bridesmaids') cascade down into its categories, the same way a
-- category's rules cascade to the categories inside it (0042).
--
-- Main-wedding behaviour is unchanged. Safe to run before the app deploy.

alter table category_pages
  add column if not exists board_tag text check (board_tag in ('groomsman', 'bridesmaid'));
create index if not exists category_pages_board_idx on category_pages(board_tag);

-- ---------------------------------------------------------------------------
-- Everything inside a board category is on the same board
-- ---------------------------------------------------------------------------
create or replace function fn_category_inherit_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    select board_tag into new.board_tag from category_pages where id = new.parent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists category_pages_inherit_board on category_pages;
create trigger category_pages_inherit_board
  before insert or update of parent_id, board_tag on category_pages
  for each row execute function fn_category_inherit_board();

-- When a category changes board, what is inside it follows, and so does its
-- options comparison.
create or replace function fn_category_board_cascade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update option_groups set visible_tag = new.board_tag where category_page_id = new.id;
  update category_pages set board_tag = new.board_tag where parent_id = new.id;
  return null;
end;
$$;

drop trigger if exists category_pages_board_cascade_ins on category_pages;
create trigger category_pages_board_cascade_ins
  after insert on category_pages
  for each row
  when (new.board_tag is not null)
  execute function fn_category_board_cascade();

drop trigger if exists category_pages_board_cascade_upd on category_pages;
create trigger category_pages_board_cascade_upd
  after update of board_tag on category_pages
  for each row
  when (old.board_tag is distinct from new.board_tag)
  execute function fn_category_board_cascade();

-- A category's options comparison carries its category's board tag.
create or replace function fn_option_group_inherit_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_page_id is not null then
    new.visible_tag := (select board_tag from category_pages where id = new.category_page_id);
  end if;
  return new;
end;
$$;

drop trigger if exists option_groups_inherit_board on option_groups;
create trigger option_groups_inherit_board
  before insert or update of category_page_id on option_groups
  for each row execute function fn_option_group_inherit_board();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function fn_category_board(p_category_page_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select board_tag from category_pages where id = p_category_page_id;
$$;

-- Admin of the board a category sits on (the couple count as admin). False for
-- a main-wedding category: those stay the couple's alone.
create or replace function fn_is_board_category_admin(p_category_page_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select fn_is_project_admin(board_tag) from category_pages where id = p_category_page_id and board_tag is not null),
    false
  );
$$;

-- A board category inherits the rules of its board's page, not "categories".
create or replace function fn_parent_page_key(p_page_key text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_parent text;
  v_board text;
begin
  if p_page_key is null then
    return null;
  end if;
  if p_page_key like 'categories:%' then
    select 'categories:' || p.slug into v_parent
    from category_pages c
    join category_pages p on p.id = c.parent_id
    where c.slug = substr(p_page_key, 12);
    if v_parent is not null then
      return v_parent;
    end if;
    select board_tag into v_board from category_pages where slug = substr(p_page_key, 12);
    return case v_board
      when 'groomsman' then 'project:groomsmen'
      when 'bridesmaid' then 'project:bridesmaids'
      else 'categories'
    end;
  end if;
  select parent_page_key into v_parent from page_registry where page_key = p_page_key;
  if v_parent is null and p_page_key like 'project:%' then
    v_parent := 'project';
  end if;
  return v_parent;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seeing and editing a category
-- ---------------------------------------------------------------------------
create or replace function fn_can_view_category(p_category_page_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_board text;
  v_key text;
begin
  if is_couple() then
    return true;
  end if;
  select board_tag into v_board from category_pages where id = p_category_page_id;
  v_key := fn_category_page_key(p_category_page_id);
  if v_board is not null then
    return fn_has_visible_tag(v_board) and coalesce(fn_resolve_permission(v_key, 'page'), true);
  end if;
  return (auth_role() = 'family' and coalesce(fn_resolve_permission(v_key, 'page'), true))
      or (fn_is_party_elevated() and coalesce(fn_resolve_permission(v_key, 'page'), false));
end;
$$;

create or replace function fn_can_edit_category(p_category_page_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_board text;
  v_key text;
begin
  if is_couple() then
    return true;
  end if;
  if not fn_can_view_category(p_category_page_id) then
    return false;
  end if;
  select board_tag into v_board from category_pages where id = p_category_page_id;
  v_key := fn_category_page_key(p_category_page_id);
  if v_board is not null then
    return coalesce(fn_resolve_permission(v_key, 'edit'), true);
  end if;
  return coalesce(fn_resolve_permission(v_key, 'edit'), false);
end;
$$;

-- Reading: the lookup by id cannot see a row that is being created in the same
-- statement, so a board's admin is also let through on the row's own board_tag.
-- Without it an admin could not get their new category back from the insert.
drop policy if exists "read category pages" on category_pages;
create policy "read category pages" on category_pages for select using (
  fn_can_view_category(id)
  or (board_tag is not null and fn_is_project_admin(board_tag))
);

-- ---------------------------------------------------------------------------
-- Creating, renaming, moving and deleting categories
-- ---------------------------------------------------------------------------
drop policy if exists "couple manages category pages" on category_pages;
drop policy if exists "couple updates category pages" on category_pages;
drop policy if exists "couple deletes category pages" on category_pages;

-- True when the parent (if any) is on the same board as the new category.
create or replace function fn_board_parent_ok(p_parent_id uuid, p_board_tag text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_parent_id is null
      or exists (select 1 from category_pages p where p.id = p_parent_id and p.board_tag is not distinct from p_board_tag);
$$;

create policy "add category pages" on category_pages for insert with check (
  is_couple()
  or (
    board_tag is not null
    and fn_is_project_admin(board_tag)
    and fn_board_parent_ok(parent_id, board_tag)
  )
);
create policy "edit category pages" on category_pages for update using (
  is_couple() or fn_is_board_category_admin(id)
) with check (
  is_couple() or (board_tag is not null and fn_is_project_admin(board_tag))
);
create policy "delete category pages" on category_pages for delete using (
  is_couple() or fn_is_board_category_admin(id)
);

-- ---------------------------------------------------------------------------
-- Choosing / removing a winner, deleting options, contacts and dates
-- ---------------------------------------------------------------------------
create or replace function fn_guard_category_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
begin
  if new.is_winner is distinct from old.is_winner and auth.uid() is not null and not is_couple() then
    select g.category_page_id into v_category from option_groups g where g.id = new.option_group_id;
    if v_category is not null and not fn_is_board_category_admin(v_category) then
      raise exception 'Only Nick or Ellie can choose the winning option for a category.';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "delete page options" on page_options;
create policy "delete page options" on page_options for delete using (
  is_couple()
  or (
    fn_can_manage_option_group(option_group_id)
    and exists (
      select 1 from option_groups g
      where g.id = page_options.option_group_id and g.category_page_id is null
    )
  )
  or exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and g.category_page_id is not null
      and fn_is_board_category_admin(g.category_page_id)
  )
);

drop policy if exists "couple deletes category contacts" on category_contacts;
create policy "delete category contacts" on category_contacts for delete using (
  is_couple() or fn_is_board_category_admin(category_page_id)
);

drop policy if exists "couple deletes diary entries" on diary_entries;
create policy "delete diary entries" on diary_entries for delete using (
  is_couple() or (category_page_id is not null and fn_is_board_category_admin(category_page_id))
);
