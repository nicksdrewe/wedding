-- Stag / hen projects: an admin each, and a budget each.
--
-- The groomsmen and bridesmaids boards (rows carrying visible_tag, 0028) were
-- flat: anyone holding the tag could do anything to anything on their board —
-- including deleting other people's tasks and whole comparisons. They become
-- managed projects:
--
--   * PROJECT ADMIN — best man for 'groomsman', maid of honour for
--     'bridesmaid' (and the couple for both). Full control of everything on
--     the board: ideas, tasks, comparisons, options, photos, costs, and the
--     project's own budget.
--   * MEMBERS — everyone else holding the tag. They contribute: add ideas
--     (and edit/remove their own), add tasks and tick them off, add options
--     to a comparison. They don't delete other people's work, start or remove
--     comparisons, choose winners, or see money (cost_access, 0031).
--
-- New table (project_budget_items) plus policies/functions. Safe to run
-- before or after the matching app deploy — until the deploy, the budget
-- section simply isn't shown.
--
-- Depends on 0033.

-- ---------------------------------------------------------------------------
-- 1. Who administers a project
-- ---------------------------------------------------------------------------
create or replace function fn_is_project_admin(p_visible_tag text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple()
      or (auth_role() = 'wedding_party' and (
            (p_visible_tag = 'groomsman' and 'best_man' = any(fn_my_tags()))
         or (p_visible_tag = 'bridesmaid' and 'maid_of_honour' = any(fn_my_tags()))
      ));
$$;

-- ---------------------------------------------------------------------------
-- 2. Comparisons (option_groups) on a project board: admin-managed
-- ---------------------------------------------------------------------------
drop policy if exists "manage option groups for your tag" on option_groups;
drop policy if exists "manage option groups for your tag update" on option_groups;
drop policy if exists "manage option groups for your tag delete" on option_groups;
create policy "project admin adds option groups" on option_groups for insert with check (
  visible_tag is not null and fn_is_project_admin(visible_tag)
);
create policy "project admin updates option groups" on option_groups for update using (
  visible_tag is not null and fn_is_project_admin(visible_tag)
) with check (
  visible_tag is not null and fn_is_project_admin(visible_tag)
);
create policy "project admin deletes option groups" on option_groups for delete using (
  visible_tag is not null and fn_is_project_admin(visible_tag)
);
-- ("read option groups for your tag" from 0028 is unchanged.)

-- ---------------------------------------------------------------------------
-- 3. Options: members add, admins manage
-- ---------------------------------------------------------------------------
-- fn_can_edit_option_group (0033) stays as the rule for ADDING an option —
-- on a tagged board that is any holder of the tag. Changing or removing an
-- existing option is this stricter rule: on a tagged board, the admin.
create or replace function fn_can_manage_option_group(p_option_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
      when is_couple() then true
      when g.visible_tag is not null and g.category_page_id is null then fn_is_project_admin(g.visible_tag)
      else fn_can_edit_option_group(g.id)
    end
    from option_groups g where g.id = p_option_group_id
  ), false);
$$;

drop policy if exists "edit page options" on page_options;
create policy "edit page options" on page_options for update using (
  fn_can_manage_option_group(option_group_id)
) with check (
  fn_can_manage_option_group(option_group_id)
);

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
);
-- Choosing a winner is an UPDATE of the option, so on a project board it is
-- now admin-only by the policy above (category winners stay couple-only via
-- the 0033 trigger).

-- Photos, prices and cost lines on an option all ask this before a change;
-- it now follows the stricter rule, so on a project board they are the
-- admin's. (Prices additionally need cost_access, as before.)
create or replace function fn_can_manage_page_option(p_page_option_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select fn_can_manage_option_group(po.option_group_id) from page_options po where po.id = p_page_option_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Tasks on a project board: members add and update, admins delete
-- ---------------------------------------------------------------------------
drop policy if exists "manage tasks for your tag" on tasks;
create policy "add tasks for your tag" on tasks for insert with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);
create policy "update tasks for your tag" on tasks for update using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
) with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);
create policy "project admin deletes tasks" on tasks for delete using (
  visible_tag is not null and fn_is_project_admin(visible_tag)
);
-- ("read tasks for your tag" from 0028 is unchanged.)

-- ---------------------------------------------------------------------------
-- 5. Ideas: author-or-couple already (0009); add the project admin
-- ---------------------------------------------------------------------------
create policy "project admin updates idea" on idea_boards for update using (
  visible_tag is not null and fn_is_project_admin(visible_tag)
) with check (
  visible_tag is not null and fn_is_project_admin(visible_tag)
);
create policy "project admin deletes idea" on idea_boards for delete using (
  visible_tag is not null and fn_is_project_admin(visible_tag)
);

-- Idea photos are visible exactly when their idea is. The EXISTS runs under
-- the reader's own RLS on idea_boards, so tier AND visible_tag both apply.
-- (The old policy repeated the tier check on top of that; it was already
-- safe for the same reason, this just states the rule once.)
drop policy if exists "read idea board images for your tier" on idea_board_images;
create policy "read idea board images" on idea_board_images for select using (
  exists (select 1 from idea_boards b where b.id = idea_board_images.idea_board_id)
);
-- ("author or couple manages idea board images" from 0010 is unchanged.)
create policy "project admin manages idea board images" on idea_board_images for all using (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and b.visible_tag is not null and fn_is_project_admin(b.visible_tag)
  )
) with check (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and b.visible_tag is not null and fn_is_project_admin(b.visible_tag)
  )
);

-- ---------------------------------------------------------------------------
-- 6. Each project's own budget
-- ---------------------------------------------------------------------------
-- Free-standing budget lines for a stag/hen project (travel, deposit, kitty…),
-- shown on that project's board alongside the cost of its chosen options.
-- Deliberately a separate table from category_costs: the wedding Budget page
-- sums category_costs only, so nothing here can ever leak into (or inflate)
-- the wedding budget.
create table project_budget_items (
  id uuid primary key default gen_random_uuid(),
  visible_tag text not null check (visible_tag in ('groomsman', 'bridesmaid')),
  name text not null,
  predicted_cost numeric(10,2) check (predicted_cost is null or predicted_cost >= 0),
  actual_cost numeric(10,2) check (actual_cost is null or actual_cost >= 0),
  currency text not null default 'GBP' check (currency in ('GBP', 'EUR')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index project_budget_items_visible_tag_idx on project_budget_items (visible_tag);

alter table project_budget_items enable row level security;

create or replace function fn_project_page_key(p_visible_tag text)
returns text
language sql
immutable
as $$
  select case p_visible_tag
    when 'groomsman' then 'project:groomsmen'
    when 'bridesmaid' then 'project:bridesmaids'
  end;
$$;

-- Read: on the board AND allowed to see its money (so the couple can open a
-- project's budget up to its members with one tick in Roles & Access).
-- Write: the project's admin, who must also be allowed to see its money.
create policy "read project budget" on project_budget_items for select using (
  is_couple()
  or (fn_has_visible_tag(visible_tag) and fn_resolve_cost_access(fn_project_page_key(visible_tag)))
);
create policy "project admin manages budget" on project_budget_items for all using (
  is_couple()
  or (fn_is_project_admin(visible_tag) and fn_resolve_cost_access(fn_project_page_key(visible_tag)))
) with check (
  is_couple()
  or (fn_is_project_admin(visible_tag) and fn_resolve_cost_access(fn_project_page_key(visible_tag)))
);
