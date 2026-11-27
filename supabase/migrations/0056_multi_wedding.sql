-- Multi-wedding foundations (see docs/plans/multi-wedding.md).
--
-- 1. weddings: one row per wedding; the address (slug) picks it.
-- 2. current_wedding_id(): which wedding this request is about. The server sets
--    it on every database call (request header x-wedding-id, from the
--    subdomain); tests and scripts can set app.wedding_id instead.
-- 3. Every wedding-owned table gets wedding_id, back-filled to Nick & Ellie's
--    wedding, defaulting to the current wedding, and a RESTRICTIVE policy so
--    a request only ever sees rows of its own wedding, on top of every
--    existing rule (nothing existing is loosened).
-- 4. Membership = your contact on that wedding's guest list. contacts.user_id
--    links a login to its contact in each wedding. profiles becomes a view that
--    answers with your role and contact IN THE CURRENT WEDDING, so every
--    existing rule, helper and page that reads profiles is wedding-aware as is.
--    The per-login part (your name) moves to accounts.
-- 5. Helpers that look things up by name (slug, page key) rather than by id
--    are told which wedding to look in.

-- ── 1. weddings ──────────────────────────────────────────────────────────
create table weddings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  partner_one text not null,
  partner_two text not null,
  display_name text not null,           -- "Nick & Ellie"
  wedding_date date,
  date_label text,                       -- "Summer 2028" when there's no exact date yet
  theme jsonb not null default '{}',     -- palette, light/dark, set in phase 2
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  plan text not null default 'alpha',    -- alpha code / paid, phase 5
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into weddings (slug, partner_one, partner_two, display_name, date_label)
values ('nickellie', 'Nick', 'Ellie', 'Nick & Ellie', 'Summer 2028');

-- ── 2. which wedding is this request about ────────────────────────────────
create or replace function current_wedding_id() returns uuid
language plpgsql stable
set search_path = public
as $$
declare
  v text;
begin
  v := nullif(current_setting('app.wedding_id', true), '');
  if v is null then
    begin
      v := nullif(current_setting('request.headers', true)::json ->> 'x-wedding-id', '');
    exception when others then
      v := null;
    end;
  end if;
  if v is null then
    return null;
  end if;
  return v::uuid;
exception when others then
  return null;
end;
$$;

-- ── 3. wedding_id on every wedding-owned table ────────────────────────────
do $$
declare
  t text;
  w uuid := (select id from weddings where slug = 'nickellie');
  owned text[] := array[
    'agenda_items', 'big_day_items', 'big_day_settings', 'category_contacts', 'category_costs',
    'category_pages', 'comments', 'comms_messages', 'comms_recipients', 'contacts', 'cost_item_links',
    'diary_entries', 'engagement_photos', 'events', 'expense_splits', 'expenses', 'gift_claims',
    'gift_ideas', 'idea_board_images', 'idea_boards', 'invite_links', 'media_links',
    'notification_groups', 'notifications_log', 'option_cost_items', 'option_groups', 'org_comms',
    'page_option_costs', 'page_option_images', 'page_options', 'page_permissions', 'page_registry',
    'project_budget_items', 'reactions', 'rsvps', 'tasks'
  ];
begin
  foreach t in array owned loop
    execute format('alter table %I add column wedding_id uuid references weddings(id) on delete cascade', t);
    execute format('update %I set wedding_id = %L', t, w);
    execute format('alter table %I alter column wedding_id set not null', t);
    execute format('alter table %I alter column wedding_id set default current_wedding_id()', t);
    execute format('create index %I on %I (wedding_id)', t || '_wedding_idx', t);
    execute format(
      'create policy "only this wedding" on %I as restrictive for all using (wedding_id = (select current_wedding_id())) with check (wedding_id = (select current_wedding_id()))',
      t
    );
  end loop;

  -- Logs: a wedding where there is one, system-wide where there isn't.
  foreach t in array array['error_log', 'admin_audit'] loop
    execute format('alter table %I add column wedding_id uuid references weddings(id) on delete cascade', t);
    execute format('update %I set wedding_id = %L', t, w);
    execute format('alter table %I alter column wedding_id set default current_wedding_id()', t);
    execute format(
      'create policy "only this wedding" on %I as restrictive for all using (wedding_id = (select current_wedding_id())) with check (wedding_id is null or wedding_id = (select current_wedding_id()))',
      t
    );
  end loop;
end $$;

-- Things that were unique for the whole site are now unique per wedding.
alter table category_pages drop constraint if exists category_pages_slug_key;
alter table category_pages add constraint category_pages_wedding_slug_key unique (wedding_id, slug);

alter table events drop constraint if exists events_slug_key;
alter table events add constraint events_wedding_slug_key unique (wedding_id, slug);

alter table notification_groups drop constraint if exists notification_groups_tag_key;
alter table notification_groups add constraint notification_groups_wedding_tag_key unique (wedding_id, tag);

alter table page_permissions drop constraint if exists page_permissions_page_key_principal_type_principal_value_key;
alter table page_permissions add constraint page_permissions_wedding_key unique (wedding_id, page_key, principal_type, principal_value);

-- page_registry was keyed on page_key alone; every wedding has its own pages now.
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    where c.contype = 'f' and c.confrelid = 'page_registry'::regclass
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;
alter table page_registry drop constraint page_registry_pkey;
alter table page_registry add primary key (wedding_id, page_key);

-- The Big Day settings were one row for the whole site; now one per wedding.
alter table big_day_settings drop constraint big_day_settings_pkey;
alter table big_day_settings add primary key (wedding_id);

-- ── 4. accounts (per login) and profiles (per login, per wedding) ─────────
alter table contacts add column user_id uuid references auth.users(id) on delete set null;
create index contacts_wedding_user_idx on contacts (wedding_id, user_id);

-- Link each existing login to its contact; anyone with a role but no contact
-- gets one, so nobody loses access in the move.
update contacts c set user_id = p.id from profiles p where p.contact_id = c.id;
insert into contacts (full_name, email, role, user_id, wedding_id)
select coalesce(p.full_name, u.email), u.email, p.role, p.id, (select id from weddings where slug = 'nickellie')
from profiles p
join auth.users u on u.id = p.id
where p.contact_id is null and p.role <> 'guest';

-- Rules elsewhere that read profiles' role / contact (my RSVPs, my gift claims,
-- my contact): kept word for word, dropped while profiles changes shape, then
-- re-created so they read the new per-wedding view.
create temporary table _profile_rules as
select distinct p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
from pg_policies p
join pg_policy pol on pol.polname = p.policyname and pol.polrelid = format('%I.%I', p.schemaname, p.tablename)::regclass
join pg_depend d on d.objid = pol.oid and d.classid = 'pg_policy'::regclass
where d.refobjid = 'profiles'::regclass and p.tablename <> 'profiles';

do $$
declare
  r record;
begin
  for r in select * from _profile_rules loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on profiles', r.policyname);
  end loop;
end $$;

alter table profiles rename to accounts;
alter table accounts drop column contact_id;
alter table accounts drop column role;

create policy "read own account" on accounts for select using (id = auth.uid());
create policy "update own account" on accounts for update using (id = auth.uid()) with check (id = auth.uid());

-- Your role comes straight from your guest-list entry in this wedding (not
-- through the view below, which itself asks "are you the couple?").
create or replace function auth_role() returns role_tier
language sql stable security definer set search_path = public as $$
  select role from contacts
  where wedding_id = current_wedding_id() and user_id = auth.uid()
  order by created_at
  limit 1;
$$;

-- Your role and contact in the wedding this request is about. Same visibility
-- as the old profiles table: your own row, everyone's for the couple, and
-- everything for the server.
create view profiles as
select distinct on (a.id)
  a.id,
  c.id as contact_id,
  c.role,
  coalesce(a.full_name, c.full_name) as full_name,
  a.created_at
from accounts a
join contacts c on c.user_id = a.id and c.wedding_id = current_wedding_id()
where a.id = auth.uid() or current_user in ('service_role', 'postgres', 'supabase_admin') or is_couple()
order by a.id, c.created_at;

grant select on profiles to anon, authenticated, service_role;

-- My own contact in the current wedding.
create or replace function fn_my_contact_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from contacts
  where wedding_id = current_wedding_id() and user_id = auth.uid()
  order by created_at
  limit 1;
$$;

do $$
declare
  r record;
begin
  for r in select * from _profile_rules loop
    execute format(
      'create policy %I on %I.%I as %s for %s to %s %s %s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd,
      array_to_string(r.roles, ', '),
      case when r.qual is not null then 'using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then 'with check (' || r.with_check || ')' else '' end
    );
  end loop;
end $$;

drop table _profile_rules;

-- New logins: an account, linked to every guest-list entry (in any wedding)
-- with the same email.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into accounts (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  update contacts set user_id = new.id
  where user_id is null and email is not null and lower(email) = lower(new.email);
  return new;
end;
$$;

-- A guest-list entry added or re-emailed later links to an existing login.
create or replace function sync_profile_from_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is not null and (tg_op = 'INSERT' or new.email is distinct from old.email) then
    new.user_id := coalesce(
      (select id from auth.users where lower(email) = lower(new.email) limit 1),
      case when tg_op = 'UPDATE' then null else new.user_id end
    );
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  -- the old trigger ran AFTER and wrote to profiles; replace it with a BEFORE one
  for r in
    select tgname from pg_trigger
    where tgrelid = 'contacts'::regclass and not tgisinternal
      and tgfoid = 'sync_profile_from_contact'::regproc
  loop
    execute format('drop trigger %I on contacts', r.tgname);
  end loop;
end $$;
create trigger contacts_link_login
  before insert or update of email on contacts
  for each row execute function sync_profile_from_contact();

-- (Comments and reactions already stamp the author's name from profiles,
-- which now answers per wedding: nothing to change there.)

-- ── 5. helpers that look things up by name: in this wedding only ──────────
create or replace function fn_big_day_published()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select published from big_day_settings where wedding_id = current_wedding_id()), false);
$$;

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
  v_w uuid := current_wedding_id();
begin
  if p_page_key is null then
    return null;
  end if;
  if p_page_key like 'categories:%' then
    select 'categories:' || p.slug into v_parent
    from category_pages c
    join category_pages p on p.id = c.parent_id
    where c.wedding_id = v_w and c.slug = substr(p_page_key, 12);
    if v_parent is not null then
      return v_parent;
    end if;
    select board_tag into v_board from category_pages where wedding_id = v_w and slug = substr(p_page_key, 12);
    return case v_board
      when 'groomsman' then 'project:groomsmen'
      when 'bridesmaid' then 'project:bridesmaids'
      else 'categories'
    end;
  end if;
  select parent_page_key into v_parent from page_registry where wedding_id = v_w and page_key = p_page_key;
  if v_parent is null and p_page_key like 'project:%' then
    v_parent := 'project';
  end if;
  return v_parent;
end;
$$;

create or replace function fn_resolve_permission(p_page_key text, p_axis text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text := auth_role();
  v_w uuid := current_wedding_id();
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
    where wedding_id = v_w
      and page_key = v_key
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
    where wedding_id = v_w and page_key = v_key and principal_type = 'role' and principal_value = v_role
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

create or replace function fn_resolve_cost_access(p_page_key text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text := auth_role();
  v_w uuid := current_wedding_id();
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
    where wedding_id = v_w
      and page_key = v_key
      and principal_type = 'tag'
      and fn_normalize_tag(principal_value) = any(v_tags);

    if v_tag_rows is not null then
      return not (false = any(v_tag_rows));
    end if;

    v_role_found := false;
    select cost_access, true into v_role_access, v_role_found
    from page_permissions
    where wedding_id = v_w and page_key = v_key and principal_type = 'role' and principal_value = v_role
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

-- ── 6. weddings: who can see and change them ─────────────────────────────
alter table weddings enable row level security;
-- The address must resolve for anyone (signed out visitors included), and the
-- names and colours are on the public front page anyway.
create policy "anyone reads weddings" on weddings for select using (true);
create policy "couple edits their wedding" on weddings for update
  using (id = current_wedding_id() and is_couple())
  with check (id = current_wedding_id() and is_couple());

-- A new wedding starts with the same page list and default access as the
-- template wedding (category pages aside: they're created by the couple).
create or replace function fn_seed_wedding(p_wedding uuid, p_template uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into page_registry (wedding_id, page_key, parent_page_key, label, is_dynamic, default_min_role)
  select p_wedding, page_key, parent_page_key, label, is_dynamic, default_min_role
  from page_registry where wedding_id = p_template and page_key not like 'categories:%'
  on conflict do nothing;

  insert into page_permissions (wedding_id, page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
  select p_wedding, page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access
  from page_permissions where wedding_id = p_template and page_key not like 'categories:%'
  on conflict do nothing;

  insert into notification_groups (wedding_id, name, tag)
  select p_wedding, name, tag from notification_groups where wedding_id = p_template
  on conflict do nothing;

  insert into big_day_settings (wedding_id) values (p_wedding) on conflict do nothing;
end;
$$;
revoke execute on function fn_seed_wedding(uuid, uuid) from anon, authenticated;
