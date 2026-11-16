-- THE BIG DAY: a schedule across however many days are chosen (Friday to
-- Monday, a whole week). Each item has a day, optional start/end time, a
-- colour, and can point at a chosen option or an idea (its picture and cost
-- are read from there — the option's cost stays where it is).
--
-- Who: the couple, family, best man and maid of honour edit it. All of the
-- wedding party can see it. An item ticked "visible to guests" can be seen by
-- any signed-in guest once the couple publishes the schedule.
--
-- New tables only; safe to run before the app deploy.

create table if not exists big_day_settings (
  id boolean primary key default true check (id),
  start_date date,
  end_date date,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or (end_date >= start_date and end_date - start_date <= 13))
);
insert into big_day_settings (id) values (true) on conflict (id) do nothing;

create table if not exists big_day_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  notes text check (notes is null or char_length(notes) <= 4000),
  day date not null,
  start_time time,
  end_time time,
  colour text not null default 'moss' check (colour in ('moss', 'rose', 'gold', 'dusk', 'lagoon', 'plum', 'ink')),
  image_url text,
  page_option_id uuid references page_options(id) on delete set null,
  idea_id uuid references idea_boards(id) on delete set null,
  visible_to_guests boolean not null default false,
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time)
);

create index if not exists big_day_items_day_idx on big_day_items(day, start_time);

alter table big_day_settings enable row level security;
alter table big_day_items enable row level security;

create or replace function fn_can_edit_big_day()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple() or auth_role() = 'family' or fn_is_party_elevated();
$$;

create or replace function fn_big_day_published()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select published from big_day_settings where id), false);
$$;

-- Settings: any signed-in person may read the dates; editors change them;
-- only the couple may publish or unpublish.
drop policy if exists "read big day settings" on big_day_settings;
create policy "read big day settings" on big_day_settings for select using (auth.uid() is not null);

drop policy if exists "edit big day settings" on big_day_settings;
create policy "edit big day settings" on big_day_settings for update using (fn_can_edit_big_day())
  with check (fn_can_edit_big_day());

create or replace function fn_guard_big_day_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published is distinct from old.published and auth.uid() is not null and not is_couple() then
    raise exception 'Only the couple can publish the schedule.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists big_day_settings_guard on big_day_settings;
create trigger big_day_settings_guard
  before update on big_day_settings
  for each row execute function fn_guard_big_day_publish();

-- Items.
drop policy if exists "read big day items" on big_day_items;
create policy "read big day items" on big_day_items for select using (
  fn_can_edit_big_day()
  or auth_role() = 'wedding_party'
  or (auth.uid() is not null and visible_to_guests and fn_big_day_published())
);

drop policy if exists "add big day items" on big_day_items;
create policy "add big day items" on big_day_items for insert with check (fn_can_edit_big_day());

drop policy if exists "edit big day items" on big_day_items;
create policy "edit big day items" on big_day_items for update using (fn_can_edit_big_day())
  with check (fn_can_edit_big_day());

drop policy if exists "delete big day items" on big_day_items;
create policy "delete big day items" on big_day_items for delete using (fn_can_edit_big_day());
