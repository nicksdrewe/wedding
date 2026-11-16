-- Surprises. The best man (groomsmen) and maid of honour (bridesmaids) can hide
-- a parent plan, a task or an idea from the bride and groom.
--
--   * A hidden PLAN stays visible to the couple by name only. Everything inside
--     it (the plans nested in it, its options, prices, contacts, dates, photos)
--     becomes invisible to them, in the database itself, not just on screen.
--   * A hidden TASK or IDEA is invisible to them.
--   * Only the board's own admin (not the couple) can switch it on or off.
--   * Totals the couple see are simply what they can see; the app shows a
--     blurred "excluding" figure beside them.
--
-- Done with RESTRICTIVE policies: they are ANDed with every existing rule, so
-- nothing already in place is loosened and nothing needs rewriting.
-- Also: plans that have plans inside them stop inviting votes/comments by
-- default (people react to the options, not to "Stag").
-- Additive. Run after 0047-0051.

alter table category_pages add column if not exists hidden_from_couple boolean not null default false;
alter table tasks add column if not exists hidden_from_couple boolean not null default false;
alter table idea_boards add column if not exists hidden_from_couple boolean not null default false;

-- Parents no longer invite votes by default; options carry the reactions.
alter table category_pages alter column feedback_enabled set default false;
update category_pages set feedback_enabled = false
  where exists (select 1 from category_pages c where c.parent_id = category_pages.id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer: they read past row security on purpose)
-- ---------------------------------------------------------------------------
-- True when the caller is the couple and the category, or (strict = true: only)
-- something above it, is hidden from them.
create or replace function fn_cat_hidden_from_couple(p_category_id uuid, p_strict boolean)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_cursor uuid := p_category_id;
  v_first boolean := true;
  v_flag boolean;
  v_depth int := 0;
begin
  if p_category_id is null or not is_couple() then
    return false;
  end if;
  while v_cursor is not null and v_depth < 12 loop
    select hidden_from_couple, parent_id into v_flag, v_cursor from category_pages where id = v_cursor;
    if v_flag and not (v_first and p_strict) then
      return true;
    end if;
    v_first := false;
    v_depth := v_depth + 1;
  end loop;
  return false;
end;
$$;

create or replace function fn_group_hidden_from_couple(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select fn_cat_hidden_from_couple(g.category_page_id, false) from option_groups g where g.id = p_group_id), false);
$$;

create or replace function fn_option_hidden_from_couple(p_option_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select fn_group_hidden_from_couple(o.option_group_id) from page_options o where o.id = p_option_id), false);
$$;

-- ---------------------------------------------------------------------------
-- Restrictive policies
-- ---------------------------------------------------------------------------
-- The category itself: its name stays visible to the couple, but not what is
-- inside it, and they cannot change or delete it (or add inside it).
create policy "hidden: couple cannot see inside" on category_pages as restrictive for select
  using (not fn_cat_hidden_from_couple(id, true));
create policy "hidden: couple cannot change" on category_pages as restrictive for update
  using (not fn_cat_hidden_from_couple(id, false));
create policy "hidden: couple cannot delete" on category_pages as restrictive for delete
  using (not fn_cat_hidden_from_couple(id, false));
create policy "hidden: couple cannot add inside" on category_pages as restrictive for insert
  with check (not fn_cat_hidden_from_couple(parent_id, false));

create policy "hidden: option groups" on option_groups as restrictive for all
  using (not fn_cat_hidden_from_couple(category_page_id, false))
  with check (not fn_cat_hidden_from_couple(category_page_id, false));
create policy "hidden: options" on page_options as restrictive for all
  using (not fn_group_hidden_from_couple(option_group_id))
  with check (not fn_group_hidden_from_couple(option_group_id));
create policy "hidden: option prices" on page_option_costs as restrictive for all
  using (not fn_option_hidden_from_couple(page_option_id))
  with check (not fn_option_hidden_from_couple(page_option_id));
create policy "hidden: option images" on page_option_images as restrictive for all
  using (not fn_option_hidden_from_couple(page_option_id))
  with check (not fn_option_hidden_from_couple(page_option_id));
create policy "hidden: option cost lines" on option_cost_items as restrictive for all
  using (not fn_option_hidden_from_couple(page_option_id))
  with check (not fn_option_hidden_from_couple(page_option_id));
create policy "hidden: category contacts" on category_contacts as restrictive for all
  using (not fn_cat_hidden_from_couple(category_page_id, false))
  with check (not fn_cat_hidden_from_couple(category_page_id, false));
create policy "hidden: category costs" on category_costs as restrictive for all
  using (not fn_cat_hidden_from_couple(category_page_id, false))
  with check (not fn_cat_hidden_from_couple(category_page_id, false));
create policy "hidden: diary entries" on diary_entries as restrictive for all
  using (not fn_cat_hidden_from_couple(category_page_id, false))
  with check (not fn_cat_hidden_from_couple(category_page_id, false));

-- Tasks and ideas.
create policy "hidden: tasks" on tasks as restrictive for all
  using (not (hidden_from_couple and is_couple()))
  with check (not (hidden_from_couple and is_couple()));
create policy "hidden: ideas" on idea_boards as restrictive for all
  using (not (hidden_from_couple and is_couple()))
  with check (not (hidden_from_couple and is_couple()));
create policy "hidden: idea images" on idea_board_images as restrictive for all
  using (not exists (select 1 from idea_boards i where i.id = idea_board_images.idea_board_id and i.hidden_from_couple and is_couple()))
  with check (not exists (select 1 from idea_boards i where i.id = idea_board_images.idea_board_id and i.hidden_from_couple and is_couple()));

-- ---------------------------------------------------------------------------
-- Who can switch it
-- ---------------------------------------------------------------------------
-- Only the board's own admin who is not the couple. (The SQL editor and the
-- service role are left alone.)
create or replace function fn_guard_hidden_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board text;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not new.hidden_from_couple then
      return new;
    end if;
  elsif new.hidden_from_couple is not distinct from old.hidden_from_couple then
    return new;
  end if;
  v_board := to_jsonb(new) ->> (case tg_table_name when 'category_pages' then 'board_tag' else 'visible_tag' end);
  if v_board is null or is_couple() or not fn_is_project_admin(v_board) then
    raise exception 'Only the best man or maid of honour can hide something from the couple.';
  end if;
  return new;
end;
$$;

create trigger category_pages_guard_hidden before insert or update of hidden_from_couple on category_pages
  for each row execute function fn_guard_hidden_flag();
create trigger tasks_guard_hidden before insert or update of hidden_from_couple on tasks
  for each row execute function fn_guard_hidden_flag();
create trigger idea_boards_guard_hidden before insert or update of hidden_from_couple on idea_boards
  for each row execute function fn_guard_hidden_flag();
