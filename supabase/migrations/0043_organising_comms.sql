-- Organising comms: a log of what was said and done while organising — an
-- email pasted in from a venue, a note that something was agreed. For the
-- couple, family, best man and maid of honour only. Each entry can be tagged
-- to a category and/or one option, and then follows that thing's visibility
-- (a stag-board entry is only seen by people on that board).
--
-- New table only; safe to run before the app deploy.

create table if not exists org_comms (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'note' check (kind in ('received', 'sent', 'note')),
  counterparty text,
  subject text not null check (char_length(subject) between 1 and 200),
  body text check (body is null or char_length(body) <= 20000),
  occurred_on date not null default current_date,
  -- 0 minor (small grey line on the timeline), 1 standard, 2 milestone.
  importance smallint not null default 0 check (importance between 0 and 2),
  category_page_id uuid references category_pages(id) on delete set null,
  page_option_id uuid references page_options(id) on delete set null,
  -- Copied from the option's comparison when an option is tagged, so the
  -- entry keeps its privacy even if that option is later deleted.
  board_tag text,
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists org_comms_occurred_idx on org_comms(occurred_on desc);
create index if not exists org_comms_option_idx on org_comms(page_option_id);
create index if not exists org_comms_category_idx on org_comms(category_page_id);

alter table org_comms enable row level security;

create or replace function fn_can_use_org_comms()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple() or auth_role() = 'family' or fn_is_party_elevated();
$$;

-- Tagging an option fills in where it belongs: its category (if it is a
-- category's option) and its board tag (if it is a stag/hen comparison).
create or replace function fn_org_comms_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_tag text;
begin
  if new.page_option_id is not null then
    select g.category_page_id, g.visible_tag into v_category, v_tag
    from page_options po join option_groups g on g.id = po.option_group_id
    where po.id = new.page_option_id;
    new.category_page_id := coalesce(v_category, new.category_page_id);
    new.board_tag := v_tag;
  elsif tg_op = 'INSERT' then
    new.board_tag := null;
  else
    -- Nobody can hand-edit the privacy tag; it only ever comes from an option.
    new.board_tag := old.board_tag;
  end if;
  return new;
end;
$$;

drop trigger if exists org_comms_stamp on org_comms;
create trigger org_comms_stamp
  before insert or update on org_comms
  for each row execute function fn_org_comms_stamp();

create or replace function fn_can_see_org_comm(p_category uuid, p_option uuid, p_board_tag text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select fn_can_use_org_comms()
     and (p_category is null or fn_can_view_category(p_category))
     and (p_board_tag is null or fn_has_visible_tag(p_board_tag))
     and (p_option is null or coalesce(
            (select fn_can_read_option_group(po.option_group_id) from page_options po where po.id = p_option),
            false));
$$;

drop policy if exists "read org comms" on org_comms;
create policy "read org comms" on org_comms for select using (
  fn_can_see_org_comm(category_page_id, page_option_id, board_tag)
);

drop policy if exists "add org comms" on org_comms;
create policy "add org comms" on org_comms for insert with check (
  created_by = auth.uid()
  and fn_can_see_org_comm(category_page_id, page_option_id, board_tag)
);

-- Your own entries, or any entry if you are the couple.
drop policy if exists "edit org comms" on org_comms;
create policy "edit org comms" on org_comms for update using (
  is_couple() or (created_by = auth.uid() and fn_can_use_org_comms())
) with check (
  (is_couple() or created_by = auth.uid())
  and fn_can_see_org_comm(category_page_id, page_option_id, board_tag)
);

drop policy if exists "delete org comms" on org_comms;
create policy "delete org comms" on org_comms for delete using (
  is_couple() or (created_by = auth.uid() and fn_can_use_org_comms())
);
