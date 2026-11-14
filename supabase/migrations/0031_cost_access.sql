-- Cost visibility as its own permission axis.
--
-- Until now an option's prices lived in the same page_options row as its
-- name, photos, date and contact. RLS is per ROW, so anyone allowed to see
-- a venue necessarily saw what it costs. The couple needs to show the
-- wedding party WHICH venue without showing its price, per category — so
-- prices move into their own table with their own policies, gated by a new
-- page_permissions.cost_access flag.
--
-- ADDITIVE ONLY. The old cost columns on page_options stay (and are kept in
-- step by a temporary trigger) so the currently-deployed app keeps working
-- between this migration and the deploy that reads the new table.
-- 0032_drop_option_cost_columns.sql removes them afterwards. Run this BEFORE
-- that deploy, and 0032 AFTER it.
--
-- Depends on 0030 (fn_normalize_tag).

-- ---------------------------------------------------------------------------
-- 1. The permission flag
-- ---------------------------------------------------------------------------
-- Default false: a new rule never exposes prices unless the couple ticks it.
alter table page_permissions add column cost_access boolean not null default false;

-- Family keeps exactly what it has today (it already reads every cost).
update page_permissions
set cost_access = data_access
where principal_type = 'role' and principal_value = 'family';

-- Best man / maid of honour: prices only on their OWN project board. Venue,
-- food and every other couple-run category stay price-free for them unless
-- the couple switches it on per category in Roles & Access. Every other
-- existing row (plain wedding party, guests, bridesmaid/groomsman tags)
-- stays at the false default.
update page_permissions
set cost_access = true
where principal_type = 'tag'
  and ((principal_value = 'best_man' and page_key = 'project:groomsmen')
    or (principal_value = 'maid_of_honour' and page_key = 'project:bridesmaids'));

-- ---------------------------------------------------------------------------
-- 2. Resolver
-- ---------------------------------------------------------------------------
-- Same shape as fn_resolve_data_access (0025): exact page_key first, then its
-- parent; a tag-level rule beats a role-level one; among several matching
-- tags, deny wins. The difference is the fallback when NO rule matches at
-- all: data_access falls back to "allowed", but prices fall back to the
-- pre-existing baseline only — couple and family — never to wedding party or
-- guests. Tags are compared normalised on both sides so a hand-edited value
-- can't slip past.
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
  v_parent text;
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

  select coalesce(array_agg(fn_normalize_tag(t)), '{}') into v_tags
  from contacts c, unnest(c.tags) as t
  where c.id = (select contact_id from profiles where id = auth.uid());

  for i in 1..2 loop
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

    select parent_page_key into v_parent from page_registry where page_key = v_key;
    -- A category whose registry row is missing (its insert is best-effort,
    -- see categories/actions.ts) must still inherit the parent's rules
    -- rather than fall straight through to the baseline.
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

  return v_role = 'family';
end;
$$;

-- Which page's rules govern an option group: its category, or (standalone
-- groups) the project board it sits on.
create or replace function fn_option_group_page_key(p_option_group_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when g.category_page_id is not null then 'categories:' || cp.slug
    when g.visible_tag = 'groomsman' then 'project:groomsmen'
    when g.visible_tag = 'bridesmaid' then 'project:bridesmaids'
    else 'project'
  end
  from option_groups g
  left join category_pages cp on cp.id = g.category_page_id
  where g.id = p_option_group_id;
$$;

create or replace function fn_option_cost_access(p_page_option_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select fn_resolve_cost_access(fn_option_group_page_key(po.option_group_id))
     from page_options po where po.id = p_page_option_id),
    false
  );
$$;

create or replace function fn_category_cost_access(p_category_page_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select fn_resolve_cost_access('categories:' || cp.slug)
     from category_pages cp where cp.id = p_category_page_id),
    false
  );
$$;

-- "May this user change this option at all" — the same rule as the "manage
-- page options" policy (0028), as a function so the cost tables below reuse
-- it instead of each carrying a copy that could drift.
create or replace function fn_can_manage_page_option(p_page_option_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select fn_has_visible_tag(g.visible_tag)
        and ((g.category_page_id is not null and is_couple())
          or (g.category_page_id is null and is_couple_or_wedding_party()))
     from page_options po
     join option_groups g on g.id = po.option_group_id
     where po.id = p_page_option_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Option prices in their own table
-- ---------------------------------------------------------------------------
create table page_option_costs (
  page_option_id uuid primary key references page_options(id) on delete cascade,
  predicted_cost_min numeric(10,2),
  predicted_cost_max numeric(10,2),
  actual_cost numeric(10,2),
  currency text not null default 'GBP' check (currency in ('GBP', 'EUR')),
  updated_at timestamptz not null default now()
);

insert into page_option_costs (page_option_id, predicted_cost_min, predicted_cost_max, actual_cost, currency)
select id, predicted_cost_min, predicted_cost_max, actual_cost, currency
from page_options;

alter table page_option_costs enable row level security;

-- Every option always has exactly one cost row (created by trigger, removed
-- by cascade), so clients only ever SELECT or UPDATE here — no insert/delete
-- policy exists on purpose. That also gives the app a clean signal: an
-- option whose cost row comes back missing means "hidden from you", never
-- "not entered yet".
--
-- The EXISTS re-checks, under the caller's own RLS, that they can see the
-- option itself — so data_access and gendered-board visibility still apply
-- on top of cost_access. (page_options' policies never reference this table,
-- so there is no recursion.)
create policy "read option costs" on page_option_costs for select using (
  is_couple()
  or (
    fn_option_cost_access(page_option_id)
    and exists (select 1 from page_options po where po.id = page_option_costs.page_option_id)
  )
);

-- Seeing a price and being allowed to edit the option = may edit the price.
create policy "update option costs" on page_option_costs for update using (
  is_couple()
  or (fn_option_cost_access(page_option_id) and fn_can_manage_page_option(page_option_id))
) with check (
  is_couple()
  or (fn_option_cost_access(page_option_id) and fn_can_manage_page_option(page_option_id))
);

-- TEMPORARY (dropped in 0032): creates each new option's cost row, and
-- mirrors anything the previously-deployed app still writes to the old
-- page_options cost columns, until the new deploy is live.
create or replace function fn_page_option_costs_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into page_option_costs (page_option_id, predicted_cost_min, predicted_cost_max, actual_cost, currency)
  values (new.id, new.predicted_cost_min, new.predicted_cost_max, new.actual_cost, new.currency)
  on conflict (page_option_id) do update
    set predicted_cost_min = excluded.predicted_cost_min,
        predicted_cost_max = excluded.predicted_cost_max,
        actual_cost = excluded.actual_cost,
        currency = excluded.currency,
        updated_at = now();
  return new;
end;
$$;

create trigger page_option_costs_sync
  after insert or update of predicted_cost_min, predicted_cost_max, actual_cost, currency
  on page_options
  for each row execute function fn_page_option_costs_sync();

-- ---------------------------------------------------------------------------
-- 4. Existing cost tables now answer to cost_access too
-- ---------------------------------------------------------------------------
-- A category's headline total.
drop policy if exists "family reads category costs" on category_costs;
create policy "read category costs" on category_costs for select using (
  is_couple() or fn_category_cost_access(category_page_id)
);
-- ("couple manages category costs" is unchanged.)

-- An option's cost/income line items. The old manage policy also let ANY
-- wedding-party member read and edit line items on standalone groups without
-- checking the gendered-board tag; fn_can_manage_page_option closes that.
drop policy if exists "read option cost items" on option_cost_items;
create policy "read option cost items" on option_cost_items for select using (
  is_couple()
  or (
    fn_option_cost_access(page_option_id)
    and exists (select 1 from page_options po where po.id = option_cost_items.page_option_id)
  )
);

drop policy if exists "manage option cost items" on option_cost_items;
create policy "manage option cost items" on option_cost_items for all using (
  is_couple()
  or (fn_option_cost_access(page_option_id) and fn_can_manage_page_option(page_option_id))
) with check (
  is_couple()
  or (fn_option_cost_access(page_option_id) and fn_can_manage_page_option(page_option_id))
);

-- A link is only as visible as the cost line it points at.
drop policy if exists "family reads cost item links" on cost_item_links;
create policy "read cost item links" on cost_item_links for select using (
  is_couple()
  or exists (select 1 from option_cost_items i where i.id = cost_item_links.source_cost_item_id)
);
-- ("couple manages cost item links" is unchanged.)
