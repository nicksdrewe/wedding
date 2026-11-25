-- ===== 0001_init.sql =====
-- Wedding platform — initial schema (Phase 1)
-- Role tiers: couple | family | wedding_party | guest

create type role_tier as enum ('couple', 'family', 'wedding_party', 'guest');

-- One row per authenticated user, linked 1:1 to auth.users.
-- Every contact eventually gets a matching profile once they sign in via their RSVP link.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  contact_id uuid, -- FK added below, once contacts exists
  role role_tier not null default 'guest',
  full_name text,
  created_at timestamptz not null default now()
);

-- The working guest list / CRM. Rows can exist before the person ever logs in.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  role role_tier not null default 'guest',
  tags text[] not null default '{}',
  plus_one_eligible boolean not null default false,
  rsvp_status text not null default 'pending', -- pending | attending | declined
  last_reminder_sent timestamptz,
  rsvp_token uuid not null default gen_random_uuid(), -- unique link, no password needed
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_contact_fk foreign key (contact_id) references contacts(id) on delete set null;

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- Wedding, Stag Do, Hen Do, Engagement Party, etc.
  starts_at timestamptz,
  location text,
  description text,
  created_at timestamptz not null default now()
);

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  attending boolean,
  plus_one_attending boolean,
  plus_one_name text,
  dietary_requirements text,
  notes text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contact_id, event_id)
);

create table category_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- venue, outfits, flowers, catering...
  title text not null,
  created_at timestamptz not null default now()
);

create table page_options (
  id uuid primary key default gen_random_uuid(),
  category_page_id uuid not null references category_pages(id) on delete cascade,
  name text not null,
  predicted_cost numeric(10,2),
  actual_cost numeric(10,2),
  option_date date,
  contact_name text,
  contact_phone text,
  contact_email text,
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);

create table category_costs (
  id uuid primary key default gen_random_uuid(),
  category_page_id uuid not null references category_pages(id) on delete cascade,
  predicted_cost numeric(10,2),
  actual_cost numeric(10,2),
  updated_at timestamptz not null default now()
);

create table category_contacts (
  id uuid primary key default gen_random_uuid(),
  category_page_id uuid not null references category_pages(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text
);

create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  entry_date date not null,
  source text, -- 'manual' | 'category_page' | 'page_option'
  category_page_id uuid references category_pages(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table gift_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create table gift_claims (
  id uuid primary key default gen_random_uuid(),
  gift_idea_id uuid not null references gift_ideas(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gift_idea_id)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null,
  paid_by_contact_id uuid references contacts(id),
  created_at timestamptz not null default now()
);

create table expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  amount numeric(10,2) not null,
  settled boolean not null default false
);

create table agenda_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  location text,
  notes text,
  updated_at timestamptz not null default now()
);

create table notification_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text unique
);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  channel text not null, -- push | email | both
  sent_to jsonb not null default '[]',
  sent_at timestamptz not null default now()
);

create table idea_boards (
  id uuid primary key default gen_random_uuid(),
  tier role_tier not null,
  title text not null,
  body text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table media_links (
  id uuid primary key default gen_random_uuid(),
  onedrive_item_id text not null,
  name text,
  album text, -- maps to a role-tier subfolder
  min_role role_tier not null default 'guest',
  created_at timestamptz not null default now()
);

-- ---------- helper: current user's role, avoids RLS recursion ----------
create or replace function auth_role() returns role_tier
language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_couple() returns boolean
language sql stable security definer as $$
  select auth_role() = 'couple';
$$;

create or replace function is_family_or_above() returns boolean
language sql stable security definer as $$
  select auth_role() in ('couple', 'family');
$$;

create or replace function is_wedding_party_or_above() returns boolean
language sql stable security definer as $$
  select auth_role() in ('couple', 'family', 'wedding_party');
$$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table events enable row level security;
alter table rsvps enable row level security;
alter table category_pages enable row level security;
alter table page_options enable row level security;
alter table category_costs enable row level security;
alter table category_contacts enable row level security;
alter table diary_entries enable row level security;
alter table gift_ideas enable row level security;
alter table gift_claims enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table agenda_items enable row level security;
alter table notification_groups enable row level security;
alter table notifications_log enable row level security;
alter table idea_boards enable row level security;
alter table media_links enable row level security;

-- profiles: everyone can see their own; couple sees all
create policy "own profile" on profiles for select using (id = auth.uid() or is_couple());
create policy "update own profile" on profiles for update using (id = auth.uid());
create policy "couple manages profiles" on profiles for insert with check (is_couple());
create policy "couple deletes profiles" on profiles for delete using (is_couple());

-- contacts (guest list / CRM): couple only
create policy "couple manages contacts" on contacts for all using (is_couple()) with check (is_couple());
create policy "self read own contact" on contacts for select using (
  id = (select contact_id from profiles where id = auth.uid())
);

-- events: everyone logged in can read; couple manages
create policy "read events" on events for select using (auth.uid() is not null);
create policy "couple manages events" on events for insert with check (is_couple());
create policy "couple updates events" on events for update using (is_couple());
create policy "couple deletes events" on events for delete using (is_couple());

-- rsvps: guests manage their own; couple sees all
create policy "own rsvp read" on rsvps for select using (
  contact_id = (select contact_id from profiles where id = auth.uid()) or is_couple()
);
create policy "own rsvp write" on rsvps for insert with check (
  contact_id = (select contact_id from profiles where id = auth.uid()) or is_couple()
);
create policy "own rsvp update" on rsvps for update using (
  contact_id = (select contact_id from profiles where id = auth.uid()) or is_couple()
);

-- category pages + costs + contacts: family (contributors) and above
create policy "family reads category pages" on category_pages for select using (is_family_or_above());
create policy "couple manages category pages" on category_pages for insert with check (is_couple());
create policy "couple updates category pages" on category_pages for update using (is_couple());
create policy "couple deletes category pages" on category_pages for delete using (is_couple());

create policy "family reads page options" on page_options for select using (is_family_or_above());
create policy "couple manages page options" on page_options for all using (is_couple()) with check (is_couple());

create policy "family reads category costs" on category_costs for select using (is_family_or_above());
create policy "couple manages category costs" on category_costs for all using (is_couple()) with check (is_couple());

create policy "family reads category contacts" on category_contacts for select using (is_family_or_above());
create policy "couple manages category contacts" on category_contacts for all using (is_couple()) with check (is_couple());

-- diary: family and above
create policy "family reads diary" on diary_entries for select using (is_family_or_above());
create policy "couple manages diary" on diary_entries for all using (is_couple()) with check (is_couple());

-- gifting: any logged-in guest can read ideas + claim; claims are public-ish (no dup) but self-managed
create policy "anyone logged in reads gift ideas" on gift_ideas for select using (auth.uid() is not null);
create policy "couple manages gift ideas" on gift_ideas for insert with check (is_couple());
create policy "couple updates gift ideas" on gift_ideas for update using (is_couple());
create policy "couple deletes gift ideas" on gift_ideas for delete using (is_couple());

create policy "anyone logged in reads claims" on gift_claims for select using (auth.uid() is not null);
create policy "self claims a gift" on gift_claims for insert with check (
  contact_id = (select contact_id from profiles where id = auth.uid())
);
create policy "self unclaims own gift" on gift_claims for delete using (
  contact_id = (select contact_id from profiles where id = auth.uid()) or is_couple()
);

-- project management (expenses): wedding party and above
create policy "wedding party reads expenses" on expenses for select using (is_wedding_party_or_above());
create policy "wedding party manages expenses" on expenses for all using (is_wedding_party_or_above()) with check (is_wedding_party_or_above());

create policy "wedding party reads expense splits" on expense_splits for select using (is_wedding_party_or_above());
create policy "wedding party manages expense splits" on expense_splits for all using (is_wedding_party_or_above()) with check (is_wedding_party_or_above());

-- agenda: everyone logged in reads; wedding party and above edit
create policy "anyone logged in reads agenda" on agenda_items for select using (auth.uid() is not null);
create policy "wedding party manages agenda" on agenda_items for all using (is_wedding_party_or_above()) with check (is_wedding_party_or_above());

-- notifications: couple only
create policy "couple manages notification groups" on notification_groups for all using (is_couple()) with check (is_couple());
create policy "couple reads notifications log" on notifications_log for select using (is_couple());
create policy "couple writes notifications log" on notifications_log for insert with check (is_couple());

-- idea boards: visible to your tier and above (couple sees all)
create policy "read idea boards for your tier" on idea_boards for select using (
  is_couple() or
  (tier = 'family' and is_family_or_above()) or
  (tier = 'wedding_party' and is_wedding_party_or_above()) or
  (tier = 'guest' and auth.uid() is not null)
);
create policy "logged in users post ideas" on idea_boards for insert with check (auth.uid() is not null);

-- media: role-gated by min_role
create policy "read media for your tier" on media_links for select using (
  is_couple() or
  (min_role = 'family' and is_family_or_above()) or
  (min_role = 'wedding_party' and is_wedding_party_or_above()) or
  (min_role = 'guest' and auth.uid() is not null)
);
create policy "couple manages media" on media_links for insert with check (is_couple());
create policy "couple deletes media" on media_links for delete using (is_couple());

-- ===== 0002_profile_autocreate.sql =====
-- Every authenticated user must have a profiles row. Without one,
-- getCurrentProfile() returns null and the role gates bounce the user to
-- /login even though they signed in successfully — an infinite loop that
-- looks exactly like "the code didn't work".
--
-- Nothing created that row before this, so only the manually-seeded couple
-- account worked; every guest would have looped forever.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  matched_contact contacts%rowtype;
begin
  -- Match the sign-in email to the guest list so the person inherits the
  -- tier the couple already assigned them, rather than defaulting to guest.
  select * into matched_contact
  from contacts
  where lower(email) = lower(new.email)
  limit 1;

  insert into profiles (id, contact_id, role, full_name)
  values (
    new.id,
    matched_contact.id,
    coalesce(matched_contact.role, 'guest'),
    coalesce(matched_contact.full_name, new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill anyone who signed up before this trigger existed.
insert into profiles (id, contact_id, role, full_name)
select
  u.id,
  c.id,
  coalesce(c.role, 'guest'),
  coalesce(c.full_name, u.raw_user_meta_data ->> 'full_name')
from auth.users u
left join contacts c on lower(c.email) = lower(u.email)
where not exists (select 1 from profiles p where p.id = u.id);

-- When the couple adds a contact for someone who has already signed in,
-- promote that existing profile to the tier they were given.
create or replace function sync_profile_from_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update profiles p
  set role = new.role,
      contact_id = new.id,
      full_name = coalesce(p.full_name, new.full_name)
  from auth.users u
  where p.id = u.id
    and lower(u.email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_contact_upserted on contacts;
create trigger on_contact_upserted
  after insert or update of email, role on contacts
  for each row execute function sync_profile_from_contact();

-- ===== 0003_project_management.sql =====
-- Project Management module (couple + wedding party — NOT family, per the
-- brief's role table: family gets budget visibility only).

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  owner_contact_id uuid references contacts(id) on delete set null,
  status text not null default 'todo', -- todo | done
  due_date date,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

create or replace function is_couple_or_wedding_party() returns boolean
language sql stable security definer as $$
  select auth_role() in ('couple', 'wedding_party');
$$;

create policy "wedding party reads tasks" on tasks for select using (is_couple_or_wedding_party());
create policy "wedding party manages tasks" on tasks for all using (is_couple_or_wedding_party()) with check (is_couple_or_wedding_party());

-- Tighten expenses/expense_splits: 0001 scoped these to
-- is_wedding_party_or_above(), which (confusingly, given its name) includes
-- family. Family should not see project management or expense data.
drop policy if exists "wedding party reads expenses" on expenses;
drop policy if exists "wedding party manages expenses" on expenses;
create policy "wedding party reads expenses" on expenses for select using (is_couple_or_wedding_party());
create policy "wedding party manages expenses" on expenses for all using (is_couple_or_wedding_party()) with check (is_couple_or_wedding_party());

drop policy if exists "wedding party reads expense splits" on expense_splits;
drop policy if exists "wedding party manages expense splits" on expense_splits;
create policy "wedding party reads expense splits" on expense_splits for select using (is_couple_or_wedding_party());
create policy "wedding party manages expense splits" on expense_splits for all using (is_couple_or_wedding_party()) with check (is_couple_or_wedding_party());

-- idea_boards already scopes read access per-tier via role match in 0001;
-- restrict wedding-party board *writes* to couple + wedding_party (0001 let
-- any logged-in user post regardless of tier).
drop policy if exists "logged in users post ideas" on idea_boards;
create policy "post ideas for your tier" on idea_boards for insert with check (
  is_couple() or
  (tier = 'family' and is_family_or_above()) or
  (tier = 'wedding_party' and is_couple_or_wedding_party()) or
  (tier = 'guest' and auth.uid() is not null)
);

-- ===== 0004_option_groups.sql =====
-- Options mode. A single reusable structure: an option_group holds 2+
-- page_options that can be compared, then one can be picked as the winner.
-- category_page_id is nullable so the exact same mechanism works both on
-- category pages (Venue, Flowers...) and standalone inside Project
-- Management (stag/hen venue, activity...) per the brief.

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  category_page_id uuid references category_pages(id) on delete cascade,
  title text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A category page has at most one options comparison running on it.
create unique index option_groups_one_per_category
  on option_groups (category_page_id)
  where category_page_id is not null;

-- Re-point page_options at option_groups instead of category_pages directly.
-- Nothing has used this table yet (Options mode wasn't built until now), so
-- there's no data to migrate.
alter table page_options drop column category_page_id;
alter table page_options add column option_group_id uuid not null references option_groups(id) on delete cascade;

alter table option_groups enable row level security;

create policy "family reads option groups" on option_groups for select using (
  is_family_or_above() or is_couple_or_wedding_party()
);
create policy "couple manages category option groups" on option_groups for insert with check (
  (category_page_id is not null and is_couple())
  or (category_page_id is null and is_couple_or_wedding_party())
);
create policy "couple manages category option groups update" on option_groups for update using (
  (category_page_id is not null and is_couple())
  or (category_page_id is null and is_couple_or_wedding_party())
);
create policy "couple manages category option groups delete" on option_groups for delete using (
  (category_page_id is not null and is_couple())
  or (category_page_id is null and is_couple_or_wedding_party())
);

-- page_options RLS from 0001 (couple manages, family reads) already exists
-- and doesn't reference the dropped column, so it's untouched — but the
-- write policy should also allow wedding_party for standalone groups.
drop policy if exists "couple manages page options" on page_options;
create policy "manage page options" on page_options for all using (
  exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- ===== 0005_engagement_party.sql =====
-- Engagement party: an open, self-service RSVP separate from the main
-- wedding guest list. Anyone can add themselves via /engagement — no
-- personal invite link, no pre-sent email — unlike the token-gated
-- /rsvp/[token] flow. Seed the event row here so the public RSVP endpoint
-- has a stable row to attach responses to.
insert into events (name, description)
select
  'Engagement Party',
  'An open celebration ahead of the big day — everyone''s welcome, invite or no invite.'
where not exists (select 1 from events where name = 'Engagement Party');

-- ===== 0006_option_details.sql =====
-- Extend page_options with narrative detail (description, external link) and
-- support for multiple images per option, so category pages can show the
-- full visual board while project management keeps its skimmed
-- title-plus-cost view of the exact same rows. No upload pipeline exists yet
-- (Drive integration is separate, pending) — image_url is a plain URL column
-- for now; a future upload widget writes into this same column.

alter table page_options add column if not exists description text;
alter table page_options add column if not exists web_link text;

create table if not exists page_option_images (
  id uuid primary key default gen_random_uuid(),
  page_option_id uuid not null references page_options(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table page_option_images enable row level security;

-- Same access rules as page_options itself (0001's read policy, 0004's
-- write policy): family and above can read; couple manages images on
-- category-linked options, couple or wedding party manage images on
-- standalone (Project Management) options — resolved by walking
-- page_option -> option_group, same as 0004's "manage page options" policy.
drop policy if exists "family reads page option images" on page_option_images;
create policy "family reads page option images" on page_option_images for select using (
  is_family_or_above()
);

drop policy if exists "manage page option images" on page_option_images;
create policy "manage page option images" on page_option_images for all using (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- ===== 0007_auto_option_groups.sql =====
-- Every category was meant to support the same "options board with photos,
-- description, link" workflow from the moment it's created — requiring a
-- separate manual "Start Options Mode" click before any image/detail UI
-- appeared was friction nobody asked for, not a deliberate two-tier
-- design. Backfill an option_groups row for every category that doesn't
-- have one yet, so the board is just always there.
insert into option_groups (category_page_id, title)
select cp.id, cp.title
from category_pages cp
where not exists (
  select 1 from option_groups og where og.category_page_id = cp.id
);

-- ===== 0008_engagement_photos.sql =====
-- Real photo storage for the public engagement party page, backing the
-- gallery that previously only ever showed placeholder colour washes.
-- Public read (the page itself is unauthenticated/public), couple-only
-- write — this isn't part of the wedding guest list's RLS model at all,
-- it's simpler and fully open on the read side.
create table engagement_photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table engagement_photos enable row level security;

create policy "anyone reads engagement photos" on engagement_photos for select using (true);
create policy "couple manages engagement photos" on engagement_photos for all using (is_couple()) with check (is_couple());

-- ===== 0009_project_idea_edit_delete.sql =====
-- idea_boards only ever had select + insert policies (0001, tightened in
-- 0003) — editing/deleting an idea was impossible even for its own author.
-- Project Management's edit/delete work needs this: author-or-couple, same
-- rule the brief calls for. created_by stores the posting profile's id,
-- which is the same value as auth.uid() (profiles.id = auth user id).
create policy "author or couple updates idea" on idea_boards for update using (
  is_couple() or created_by = auth.uid()
) with check (
  is_couple() or created_by = auth.uid()
);

create policy "author or couple deletes idea" on idea_boards for delete using (
  is_couple() or created_by = auth.uid()
);

-- ===== 0010_idea_board_images_tags.sql =====
-- Idea board images + tags, so ideas can grow into a private Pinterest-style
-- board: free-text tags for grouping, and one-to-many images per idea via
-- the same child-table pattern page_option_images established in 0006 (one
-- upload pipeline — src/lib/google/drive.ts + /api/upload — feeds both).

-- tags: mirrors contacts.tags exactly (0001_init.sql) — plain text[],
-- default empty array, no separate lookup table. Comma-separated input is
-- split/trimmed server-side (same tagsToArray helper approach as
-- src/app/(admin)/guests/actions.ts's updateContact).
alter table idea_boards add column if not exists tags text[] not null default '{}';

create table if not exists idea_board_images (
  id uuid primary key default gen_random_uuid(),
  idea_board_id uuid not null references idea_boards(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table idea_board_images enable row level security;

-- Read: same tier-gated visibility as idea_boards itself (0001's "read idea
-- boards for your tier" policy), resolved by walking back to the parent row.
drop policy if exists "read idea board images for your tier" on idea_board_images;
create policy "read idea board images for your tier" on idea_board_images for select using (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and (
        is_couple() or
        (b.tier = 'family' and is_family_or_above()) or
        (b.tier = 'wedding_party' and is_wedding_party_or_above()) or
        (b.tier = 'guest' and auth.uid() is not null)
      )
  )
);

-- Write (insert/update/delete): same actors who can edit/delete the idea
-- itself — author-or-couple, per 0009_project_idea_edit_delete.sql's
-- "author or couple updates/deletes idea" policies — resolved the same way.
drop policy if exists "author or couple manages idea board images" on idea_board_images;
create policy "author or couple manages idea board images" on idea_board_images for all using (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and (is_couple() or b.created_by = auth.uid())
  )
) with check (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and (is_couple() or b.created_by = auth.uid())
  )
);

-- ===== 0011_contact_hierarchy.sql =====
-- Group RSVPs on the engagement party: a submitter can bring "others"
-- (not just a single plus one), and each of those becomes its own real
-- contact row nested under the person who submitted the RSVP, so they're
-- counted like any other guest everywhere contacts/rsvps are counted.

alter table contacts
  add column parent_contact_id uuid references contacts(id) on delete cascade;

-- Deleting a parent contact (e.g. from the guest list CRM) cascades to
-- remove any child contacts nested under them, same as rsvps already
-- cascade off contacts today.

create index if not exists contacts_parent_contact_id_idx on contacts (parent_contact_id);

-- No new RLS policy needed: this is just an additional nullable column on
-- the existing `contacts` table, already covered by the "couple manages
-- contacts" and "self read own contact" policies from 0001_init.sql. The
-- public /api/engagement-rsvp route writes via createAdminClient()
-- (service-role, bypasses RLS entirely) exactly as it already did before
-- this migration, so inserts of child rows work unchanged.

-- ===== 0012_option_coordinates.sql =====
-- Optional lat/long on page_options so options with a real-world location
-- (venues, primarily, but harmless on any category) can be plotted on a pin
-- map alongside the existing options board. Nullable — most options never
-- get coordinates, and the map UI skips any option missing either value.
alter table page_options add column if not exists latitude numeric(9,6);
alter table page_options add column if not exists longitude numeric(9,6);

-- ===== 0013_invite_links.sql =====
-- A single reusable "share link" the couple can hand to every engagement
-- party invitee (80+ people, same link for all of them) that bypasses the
-- client-side site gate (see SiteGate.tsx and /i/[token]) instead of
-- requiring each visitor to know/enter the gate code. Couple-only
-- read/write via RLS — the token is only ever looked up by the /i/[token]
-- route using the service-role admin client (bypasses RLS by design, same
-- pattern as the public engagement-rsvp endpoint), never queried directly
-- by an anonymous visitor's own Supabase client.
create table invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table invite_links enable row level security;

create policy "couple manages invite links" on invite_links for all using (is_couple()) with check (is_couple());

-- ===== 0014_security_hardening.sql =====
-- Security audit fixes (2026-08-31). See sections below — each is
-- independent and safe to review/run as one migration.

-- =====================================================================
-- 1. CRITICAL: self-role-escalation via the "update own profile" policy
-- =====================================================================
-- The original policy (0001_init.sql) was:
--   create policy "update own profile" on profiles for update
--     using (id = auth.uid());
-- with no WITH CHECK clause. Per Postgres RLS semantics, an UPDATE policy
-- with no WITH CHECK re-runs the USING expression against the NEW row —
-- but USING here only constrains `id`, saying nothing about `role`. Any
-- signed-in user (including the default 'guest' tier every new sign-in
-- gets) could therefore run, straight from the browser with nothing more
-- than the public anon key and their own session:
--   supabase.from('profiles').update({ role: 'couple' }).eq('id', myId)
-- and RLS would allow it — instantly granting is_couple()-gated write
-- access to nearly every table in the schema (the full guest CRM,
-- expenses, invite links, notification groups, everything). No app code
-- anywhere legitimately updates role or contact_id this way — both are
-- exclusively set by the SECURITY DEFINER triggers in
-- 0002_profile_autocreate.sql (handle_new_user / sync_profile_from_contact),
-- which bypass RLS entirely — so pinning both columns to their existing
-- value here removes a capability nothing legitimate ever used.
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from profiles p where p.id = auth.uid())
    and contact_id is not distinct from (select p.contact_id from profiles p where p.id = auth.uid())
  );

-- =====================================================================
-- 2. Pin search_path on every SECURITY DEFINER function
-- =====================================================================
-- Standard Postgres/Supabase hardening: a SECURITY DEFINER function
-- without a pinned search_path resolves unqualified identifiers against
-- whatever search_path the CALLER has set, which (in principle) lets a
-- caller with schema-creation rights shadow a table/function the
-- definer-privileged function relies on. These four run on every RLS
-- check in the app, so they're worth pinning even though this project's
-- Supabase role model doesn't currently grant callers schema-create
-- rights.
create or replace function auth_role() returns role_tier
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_couple() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() = 'couple';
$$;

create or replace function is_family_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('couple', 'family');
$$;

create or replace function is_wedding_party_or_above() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('couple', 'family', 'wedding_party');
$$;

-- =====================================================================
-- 3. rsvp_token should actually be unique, and indexed
-- =====================================================================
-- Declared `unique link, no password needed` in a comment but never
-- actually constrained — /api/rsvp/[token] looks it up with
-- .maybeSingle(), which errors if Postgres ever let two rows collide.
-- gen_random_uuid() makes a real collision astronomically unlikely, but
-- there's no reason not to have Postgres guarantee it outright, and the
-- unique constraint gives this hot lookup path an index for free.
alter table contacts add constraint contacts_rsvp_token_key unique (rsvp_token);

-- =====================================================================
-- 4. Indexes on frequently-queried foreign keys / lookup columns
-- =====================================================================
-- Postgres does not auto-index foreign key columns. These are the ones
-- on the app's hot paths: every RSVP read/write filters rsvps by
-- contact_id and event_id together; the sign-in and engagement-RSVP
-- flows both look a contact up by email.
create index if not exists rsvps_contact_id_idx on rsvps (contact_id);
create index if not exists rsvps_event_id_idx on rsvps (event_id);
create index if not exists contacts_email_idx on contacts (lower(email));

-- =====================================================================
-- 5. Lightweight rate limiting for the two public, unauthenticated
--    write/lookup endpoints (api/engagement-rsvp, api/auth/request-code)
-- =====================================================================
-- Fixed-window counter keyed by an arbitrary string (route name + IP, or
-- route name + email) — deliberately simple rather than a sliding window,
-- since this only needs to stop trivial scripted abuse, not survive a
-- determined attacker. Rows are cheap to prune (see the accompanying app
-- code, which deletes its own expired window on read).
create table rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  window_start timestamptz not null default now(),
  count int not null default 1
);
create unique index rate_limit_hits_bucket_key on rate_limit_hits (bucket_key);

alter table rate_limit_hits enable row level security;
-- No policies at all: only ever touched via the service-role admin
-- client from the two public route handlers above, same as
-- invite_links — never queried directly by a browser's own session.

-- ===== 0015_comms.sql =====
-- Guest-wide communications: the couple composes a message once, picks an
-- audience (by RSVP status, tag, role, or hand-picked names), and sends it
-- — with a durable record of exactly who got what and when, so "did I
-- already email the declined-but-still-invited group about the venue
-- change" has a real answer instead of relying on memory.
--
-- Two tables rather than one: comms_messages is the message itself
-- (subject/body, written once), comms_recipients is one row per person it
-- was (or is being) sent to, so a single send can partially succeed
-- without losing track of which addresses actually went out — the send
-- flow processes recipients one at a time from the client (see
-- lib/email/resend.ts's comment on why), so this table's per-row status
-- is genuinely load-bearing, not just a nice-to-have log.
create table comms_messages (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

create table comms_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references comms_messages(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  -- Snapshotted at send time rather than always joining live to
  -- contacts.email — a later email change on the contact shouldn't rewrite
  -- history about which actual address a past send went to.
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, contact_id)
);

create index comms_recipients_message_id_idx on comms_recipients (message_id);
create index comms_recipients_contact_id_idx on comms_recipients (contact_id);

alter table comms_messages enable row level security;
alter table comms_recipients enable row level security;

create policy "couple manages comms messages" on comms_messages for all using (is_couple()) with check (is_couple());
create policy "couple manages comms recipients" on comms_recipients for all using (is_couple()) with check (is_couple());

-- ===== 0016_comms_html_body.sql =====
-- Lets a message be composed as raw HTML (e.g. pasted from an external
-- email builder like Stripo) instead of always being treated as plain
-- text and escaped/paragraph-wrapped — see actions.ts's sendToRecipient,
-- which branches on this to decide whether to run the body through
-- toHtml() (escape + wrap) or send it through as-is.
alter table comms_messages
  add column body_type text not null default 'text' check (body_type in ('text', 'html'));

-- ===== 0017_events_system.sql =====
-- Generalizes the bespoke, hand-built "Engagement Party" page into a
-- reusable events system: create/configure a new event (hen do, stag do,
-- the wedding itself once the date's set, anything) through an admin
-- form instead of needing a new page hand-built each time. Extends the
-- existing `events` table (not a new one) so RSVPs, which already key off
-- event_id, keep working unchanged.

alter table events add column slug text unique;

-- Landing page CTA — at most one event should ever have this on at a
-- time (the home page reads whichever one does), but that's an app-level
-- rule, not enforced here; nothing stops the couple from toggling two on
-- briefly mid-edit.
alter table events add column is_landing_cta boolean not null default false;
alter table events add column landing_cta_copy text;

-- RSVP: enabled turns the form on for this event's page at all;
-- open decides whether a stranger can self-add (like the engagement
-- party today) or the submitted email must already match an existing
-- contact (checked the same way the sign-in code flow already gates
-- against the guest list).
alter table events add column rsvp_enabled boolean not null default false;
alter table events add column rsvp_open boolean not null default true;

-- Page section toggles + their content. Each section is independently
-- on/off so a future event can be as minimal or as full as it needs —
-- e.g. a save-the-date with just a header, no photo board or RSVP yet.
alter table events add column show_header boolean not null default true;
alter table events add column header_eyebrow text;
alter table events add column header_title text;
alter table events add column header_body text;

alter table events add column show_photo_board boolean not null default false;

alter table events add column show_details boolean not null default false;
alter table events add column details_eyebrow text;
alter table events add column details_title text;
alter table events add column venue_name text;
alter table events add column venue_body text;

-- Map reuses the existing `location` column as the address to embed
-- (the current engagement page's map is a Google Maps iframe built from
-- an address query string, not a lat/long pin like the options board's
-- Leaflet map) — no new columns needed, just its own toggle.
alter table events add column show_map boolean not null default false;

alter table events add column show_rsvp_form boolean not null default false;

-- Guests page: whether this event gets its own RSVP status column there.
alter table events add column show_guest_list_column boolean not null default false;

-- Diary timeline: on by default so a newly created event shows up
-- without an extra step, but can be hidden for something not worth its
-- own timeline entry.
alter table events add column show_on_diary boolean not null default true;

-- Generalizes engagement_photos (kept under its existing name — a rename
-- here would touch every reference to it for no functional gain) into a
-- photo board any event can use, not just the engagement party.
-- Nullable for now; backfilled to the existing Engagement Party row in
-- the follow-up data migration, since existing rows predate this column.
alter table engagement_photos add column event_id uuid references events(id) on delete cascade;
create index engagement_photos_event_id_idx on engagement_photos (event_id);

-- ===== 0018_migrate_engagement_party.sql =====
-- Migrates the existing, hand-built Engagement Party page into the new
-- generic events system (0017) — same content, same URL behaviour (see
-- the /engagement redirect in app code), same photos and RSVPs, now
-- config-driven instead of hardcoded. Values below are copied verbatim
-- from the constants EngagementPageClient.tsx hardcoded before this
-- migration, not new copy.
update events
set
  slug = 'engagement-party',
  is_landing_cta = true,
  landing_cta_copy = 'RSVP to the engagement party',
  rsvp_enabled = true,
  rsvp_open = true,
  show_header = true,
  header_eyebrow = 'Nick & Ellie',
  header_title = 'Let''s celebrate early',
  header_body = 'Before the wedding itself, we''d love to celebrate the engagement with anyone who can make it — no formal invite needed, just let us know you''re coming.',
  show_photo_board = true,
  show_details = true,
  details_eyebrow = 'When & where',
  details_title = 'Join us at The Black Lion',
  venue_name = 'The Black Lion',
  venue_body = 'This one''s drinks and catching up rather than a sit-down meal — come fed! RSVP below and we''ll see you there.',
  location = 'The Black Lion, Hammersmith, London',
  starts_at = ('2026-10-24 19:00:00'::timestamp at time zone 'Europe/London'),
  show_map = true,
  show_rsvp_form = true,
  show_guest_list_column = true,
  show_on_diary = true
where name = 'Engagement Party';

-- Every existing photo belongs to this one event — there was no other
-- event with a photo board before this migration.
update engagement_photos
set event_id = (select id from events where name = 'Engagement Party')
where event_id is null;

-- ===== 0019_landing_cta_copy.sql =====
-- The landing page's guest-state heading and body copy were still
-- hardcoded engagement-party wording in ScrollFlowerHero.tsx regardless
-- of which event was actually flagged as the featured CTA — once a
-- different event takes that flag, the button would correctly say "RSVP
-- to the hen do" while the heading above it still said "Join us for the
-- engagement party". These three fields let the couple set every piece
-- of that copy per event, same pattern as header_eyebrow/header_title/
-- header_body on the event's own page.
alter table events add column landing_cta_eyebrow text;
alter table events add column landing_cta_heading text;
alter table events add column landing_cta_body text;

-- ===== 0020_migrate_landing_cta_copy.sql =====
-- Carries the current hardcoded landing-page guest-state copy (see
-- ScrollFlowerHero.tsx's ctaCopy()) onto the Engagement Party event row,
-- matching 0018's approach — so the home page reads identically once
-- ScrollFlowerHero switches to reading these columns instead.
update events
set
  landing_cta_eyebrow = 'You''re invited',
  landing_cta_heading = 'Join us for the engagement party',
  landing_cta_body = 'The wedding date is still to come — for now, let us know you''ll be there to celebrate the engagement.'
where name = 'Engagement Party';

-- ===== 0021_wedding_event.sql =====
-- The wedding itself never had an events row at all — guests/page.tsx and
-- comms/page.tsx both already look one up by .eq("name", "Wedding") for
-- the wedding's separate RSVP column (contacts.rsvp_status, written by
-- the personal invite-link flow at api/rsvp/[token], not this events
-- system), and were silently matching nothing.
--
-- Created with every page-section toggle off and no date set — it exists
-- so it's manageable through /diary/events now, but stays invisible
-- everywhere public (no page section renders with nothing turned on, no
-- diary timeline entry with no starts_at) until the couple is ready to
-- flesh it out through the form themselves once a real date is set.
insert into events (name, slug, show_on_diary)
select 'Wedding', 'wedding', true
where not exists (select 1 from events where name = 'Wedding');

-- ===== 0022_plus_one_limits.sql =====
-- Replaces the simple plus_one_eligible boolean with a per-contact count
-- — the couple needs to say not just "can this person bring someone" but
-- "how many" (a family with kids might need up to 5, most guests just
-- one), and events need their own toggle for whether that count is even
-- enforced at all (the engagement party's "bring whoever" openness vs. a
-- more controlled guest-list-only event).
--
-- One field, not a separate eligible boolean plus a count — two fields
-- can drift out of sync (eligible=true but limit=0, or the reverse); 0
-- unambiguously means "not eligible" and reads the same as before.
alter table contacts add column plus_one_limit integer not null default 0 check (plus_one_limit >= 0);
update contacts set plus_one_limit = case when plus_one_eligible then 1 else 0 end;
alter table contacts drop column plus_one_eligible;

-- Per-event: true (the default, matching every event's current behavior)
-- means "bringing others" stays exactly as open/unlimited as it's always
-- been. false means the RSVP endpoint enforces each matched contact's own
-- plus_one_limit as a hard cap on how many names they can add.
alter table events add column plus_ones_open boolean not null default true;

-- ===== 0023_cost_ranges_and_currency.sql =====
-- Predicted costs become a min–max range instead of one number (actual/
-- final cost stays a single absolute number, since only the range that's
-- still being estimated benefits from a spread) — plus a currency per cost
-- entry (GBP or EUR), so a vendor quoted in euros doesn't have to be
-- manually converted before it's entered. Aggregated displays (the budget
-- page) live-convert everything to GBP at render time (see src/lib/currency/)
-- rather than storing a converted value, since a stored conversion goes
-- stale the moment rates move.

alter table category_costs add column predicted_cost_min numeric(10,2);
alter table category_costs add column predicted_cost_max numeric(10,2);
alter table category_costs add column currency text not null default 'GBP' check (currency in ('GBP', 'EUR'));
update category_costs set predicted_cost_min = predicted_cost, predicted_cost_max = predicted_cost;
alter table category_costs drop column predicted_cost;

alter table page_options add column predicted_cost_min numeric(10,2);
alter table page_options add column predicted_cost_max numeric(10,2);
alter table page_options add column currency text not null default 'GBP' check (currency in ('GBP', 'EUR'));
update page_options set predicted_cost_min = predicted_cost, predicted_cost_max = predicted_cost;
alter table page_options drop column predicted_cost;

-- ===== 0024_linked_cost_items.sql =====
-- Lets one cost line-item (e.g. a "Food" cost logged as an option under
-- Venue) also appear under a second category (Catering) without being
-- duplicated. This is a pure pointer table, not a second cost row — every
-- render re-reads the live page_options/page_option_images row through the
-- link, so an edit at the source (name, image, cost) automatically shows up
-- everywhere it's linked, with nothing to keep in sync.

create table cost_item_links (
  id uuid primary key default gen_random_uuid(),
  source_page_option_id uuid not null references page_options(id) on delete cascade,
  linked_category_page_id uuid not null references category_pages(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_page_option_id, linked_category_page_id)
);

alter table cost_item_links enable row level security;

-- Mirrors page_options' own read policy (0001_init.sql) — anyone who can
-- see the source item can see that it's linked.
create policy "family reads cost item links" on cost_item_links for select using (
  is_family_or_above()
);

-- Mirrors page_options' write policy for category-linked options
-- (0004_option_groups.sql) — only the couple manages links, since a linked
-- item is always sourced from a category-linked (couple-only) option.
create policy "couple manages cost item links" on cost_item_links for all using (
  is_couple()
) with check (
  is_couple()
);

-- ===== 0025_page_permissions.sql =====
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

-- ===== 0026_option_cost_items.sql =====
-- Real-world costs rarely come as one number: a venue's £20k headline hire
-- fee might come with a buy-in wedding breakfast, wine, staff, a planner —
-- and money coming BACK (guest room recoup). This adds a per-option
-- itemized cost breakdown, each line either a cost (adds) or income
-- (subtracts), optionally computed as quantity × rate (e.g. 40 guests ×
-- £50/night) so a later headcount change doesn't need re-doing the maths
-- by hand.
--
-- Headline vs additional, per the couple's own framing: the option's own
-- predicted/actual cost (already on page_options) stays the "headline"
-- figure, net of any income lines (guest recoup) — it does NOT fold in
-- the additional cost lines (breakfast, wine, staff...), which are shown
-- as their own single sum instead. See computeOptionTotals in
-- lib/options/totals.ts for the shared arithmetic every caller uses.

alter table page_options add column nights integer;
alter table page_options add column sleeps integer;

create table option_cost_items (
  id uuid primary key default gen_random_uuid(),
  page_option_id uuid not null references page_options(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cost', 'income')),
  -- quantity/rate are an optional calculation aid only — when both are
  -- set, the app computes amount = quantity * rate and keeps it in sync;
  -- amount is still the one persisted, authoritative figure so every
  -- reader (including SQL-level rollups) only ever needs to sum one
  -- column, never re-derive it.
  quantity numeric(10,2),
  rate numeric(10,2),
  amount numeric(10,2) not null check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table option_cost_items enable row level security;

-- Mirrors page_options' own read gate (0025_page_permissions.sql) exactly
-- — a line item is exactly as sensitive as the option it belongs to.
create policy "read option cost items" on option_cost_items for select using (
  is_couple() or (
    is_family_or_above()
    and fn_page_options_data_access((select option_group_id from page_options where id = page_option_id))
  )
);

-- Mirrors page_options' own write gate (0004_option_groups.sql, "manage
-- page options") exactly — couple manages category-linked items, couple
-- or wedding_party manages standalone (Project Management) items.
create policy "manage option cost items" on option_cost_items for all using (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = option_cost_items.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = option_cost_items.page_option_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- Linking moves from the whole option (0024_linked_cost_items.sql) down
-- to a single cost line — the couple's actual example links just the
-- "wedding breakfast" line into Catering, not the entire venue option.
-- Any existing link points at a whole page_options row, which has no
-- automatic equivalent line item to redirect to under the new model (a
-- link isn't just a foreign key value, it's "which specific cost" — that
-- has to be re-chosen by hand once the item exists). Cleared here rather
-- than migrated; re-adding a link via the new UI takes seconds and this
-- never touched the underlying cost data itself, only the "also show
-- under X" relationship.
delete from cost_item_links;
alter table cost_item_links drop constraint cost_item_links_source_page_option_id_fkey;
alter table cost_item_links rename column source_page_option_id to source_cost_item_id;
alter table cost_item_links add constraint cost_item_links_source_cost_item_id_fkey
  foreign key (source_cost_item_id) references option_cost_items(id) on delete cascade;

-- ===== 0027_guest_self_service_and_role_editing.sql =====
-- Guest self-service accounts + a third permissions axis (edit_access)
-- alongside the existing page_access/data_access from 0025 — the couple's
-- new brief needs "family can see this page but not edit it, except one
-- specific write action" and "best man can edit everything visible to him
-- except the other gender's page", which page_access/data_access alone
-- can't express (those only ever restrict, never distinguish read from
-- write). Same resolver, same admin UI, just a third boolean.

alter table contacts add column guest_note text;

-- A signed-in guest can maintain their own contact row and any +1 they
-- logged themselves (parent_contact_id pointing at them, see
-- 0011_contact_hierarchy.sql) — name, plus_one_limit, guest_note. Couple
-- retains full access via is_couple(), same pattern as every other
-- self-service policy in this schema (rsvps' "own rsvp *" policies).
create policy "guest updates own contact" on contacts for update using (
  is_couple()
  or id = (select contact_id from profiles where id = auth.uid())
  or parent_contact_id = (select contact_id from profiles where id = auth.uid())
) with check (
  is_couple()
  or id = (select contact_id from profiles where id = auth.uid())
  or parent_contact_id = (select contact_id from profiles where id = auth.uid())
);

-- Adding a new +1 is an insert, not an update — capped at the inserting
-- guest's own plus_one_limit via fn_guest_plus_one_count below, since a
-- plain RLS `with check` can't count existing sibling rows on its own.
create or replace function fn_guest_plus_one_count(p_parent_contact_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from contacts where parent_contact_id = p_parent_contact_id;
$$;

create policy "guest adds own plus ones" on contacts for insert with check (
  is_couple()
  or (
    parent_contact_id = (select contact_id from profiles where id = auth.uid())
    and fn_guest_plus_one_count(parent_contact_id) < (
      select plus_one_limit from contacts where id = parent_contact_id
    )
  )
);

-- Third permissions axis: can the resolved principal (role or tag) WRITE
-- on this page, not just see it / see its itemized data. Existing rows
-- default page_access/data_access=true (0025); backfilling edit_access to
-- match page_access keeps every already-configured row's current
-- behaviour (edit follows view, same as the app-wide default before this
-- migration) until the seed data below narrows specific roles/tags.
alter table page_permissions add column edit_access boolean not null default true;
update page_permissions set edit_access = page_access;

-- New page_registry entries this rollout introduces.
insert into page_registry (page_key, label, default_min_role, parent_page_key) values
  ('account', 'My Details', 'guest', null),
  ('project:bridesmaids', 'Bridesmaids', 'wedding_party', 'project'),
  ('project:groomsmen', 'Groomsmen', 'wedding_party', 'project');

-- Family: read access to guests/budget/project/categories, but no edit
-- rights anywhere except adding an expense — one explicit row per page
-- rather than relying on absence-means-allowed, since the couple's brief
-- draws a specific line ("read-only... can add expenses") that needs to
-- survive even if page_registry gains more pages later.
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access) values
  ('guests', 'role', 'family', true, true, false),
  ('budget', 'role', 'family', true, true, false),
  ('project', 'role', 'family', true, true, false),
  ('project:ideas', 'role', 'family', true, true, false),
  ('project:expenses', 'role', 'family', true, true, true),
  ('categories', 'role', 'family', true, true, false)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Plain wedding_party (no best_man/maid_of_honour tag): per the couple's
-- own framing, "all other pages same rights as guest" — this is NOT the
-- broad planning access the role used to imply before this rollout. Same
-- bulk pattern as the guest seed below: page_access true only on
-- diary/account, false everywhere else (including project itself and its
-- own gendered page — that page_access=true comes from the 'bridesmaid'/
-- 'groomsman' TAG row below, which the resolver prefers over this role
-- row once a member is actually tagged).
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
select page_key, 'role', 'wedding_party', (page_key in ('account', 'diary')), false, (page_key = 'account')
from page_registry
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Gendered wedding-party pages: only their own tag can see or edit theirs
-- — matching "ONLY visible to the bridesmaids OR groomsmen", not the
-- whole wedding party (the bulk row above already locked both pages out
-- for the bare role).
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access) values
  ('project:bridesmaids', 'tag', 'bridesmaid', true, true, true),
  ('project:groomsmen', 'tag', 'groomsman', true, true, true)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Best man / maid of honour: broad access matching the couple's brief
-- ("can see everything apart from the opposite function's page... edit
-- rights on everything visible to them") — granted per relevant page
-- rather than a blanket rule, then explicitly blocked from the opposite
-- gendered page. Applied to every page_key a wedding_party member would
-- otherwise reach, plus their OWN gendered page.
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
select page_key, 'tag', tag, true, true, true
from page_registry, (values ('best_man'), ('maid_of_honour')) as t(tag)
where page_key not in ('project:bridesmaids', 'project:groomsmen')
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access) values
  ('project:groomsmen', 'tag', 'best_man', true, true, true),
  ('project:bridesmaids', 'tag', 'best_man', false, false, false),
  ('project:bridesmaids', 'tag', 'maid_of_honour', true, true, true),
  ('project:groomsmen', 'tag', 'maid_of_honour', false, false, false)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- Guest: page_access only on their own "My Details" page and the Diary
-- (read-only there is enforced in the app, not here — Diary has no
-- itemized-data concept to restrict). Every other existing page_key
-- defaults to page_access=false for guests so a plain contact never sees
-- the household/planning tooling at all.
insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
select page_key, 'role', 'guest', (page_key in ('account', 'diary')), false, (page_key = 'account')
from page_registry
on conflict (page_key, principal_type, principal_value) do update
  set page_access = excluded.page_access, data_access = excluded.data_access, edit_access = excluded.edit_access;

-- ===== 0028_gendered_pages_and_family_access.sql =====
-- Two things, both from the couple's account-capabilities brief:
--
-- 1. Gendered wedding-party sub-pages (bridesmaids/groomsmen) reuse the
--    existing generic idea_boards/option_groups/tasks tables rather than
--    duplicating three tables for two near-identical audiences — scoped
--    by a new nullable visible_tag column, since 'bridesmaid'/'groomsman'
--    are contact TAGS, not role_tier values.
--
-- 2. Family gains read access to tasks (project page) and read+add (not
--    edit/delete/settle) on expenses — "same as guest, but can see
--    categories/project/guests/finance... can add expenses, but
--    otherwise all read-only". This reverses part of 0003's "family
--    should not see project management or expense data" — that was the
--    right call at the time, the brief has since changed.

alter table idea_boards add column visible_tag text;
alter table option_groups add column visible_tag text;
alter table tasks add column visible_tag text;

-- Resolves whether the current user can see/manage a visible_tag-scoped
-- row: couple always; a contact carrying that exact tag; best_man also
-- sees 'groomsman' rows and maid_of_honour also sees 'bridesmaid' rows
-- (mirroring the page-level grants in 0027), since best man/MoH are
-- framed as elevated members of their own side, not a separate tier.
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
  select tags into v_tags from contacts where id = (select contact_id from profiles where id = auth.uid());
  if v_tags is null then
    return false;
  end if;
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

-- idea_boards: narrow the existing tier-based policies to non-gendered
-- rows (visible_tag is null) — RLS policies are OR'd, so without this a
-- plain wedding_party member would still see a gendered row via the old
-- broad "tier = 'wedding_party'" policy regardless of visible_tag. A
-- second, additive tag-scoped policy grants access to gendered rows
-- instead. Original policy bodies preserved verbatim from
-- 0001_init.sql/0003_project_management.sql, just wrapped.
drop policy if exists "read idea boards for your tier" on idea_boards;
create policy "read idea boards for your tier" on idea_boards for select using (
  visible_tag is null and (
    is_couple() or
    (tier = 'family' and is_family_or_above()) or
    (tier = 'wedding_party' and is_wedding_party_or_above()) or
    (tier = 'guest' and auth.uid() is not null)
  )
);
create policy "read idea boards for your tag" on idea_boards for select using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "post ideas for your tier" on idea_boards;
create policy "post ideas for your tier" on idea_boards for insert with check (
  visible_tag is null and (
    is_couple() or
    (tier = 'family' and is_family_or_above()) or
    (tier = 'wedding_party' and is_couple_or_wedding_party()) or
    (tier = 'guest' and auth.uid() is not null)
  )
);
create policy "post ideas for your tag" on idea_boards for insert with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

-- option_groups: same narrow-then-add pattern. Only the standalone write
-- policies need it (category_page_id is null branch) — a category-linked
-- group is never gendered.
drop policy if exists "family reads option groups" on option_groups;
create policy "family reads option groups" on option_groups for select using (
  visible_tag is null and (is_family_or_above() or is_couple_or_wedding_party())
);
create policy "read option groups for your tag" on option_groups for select using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "couple manages category option groups" on option_groups;
create policy "couple manages category option groups" on option_groups for insert with check (
  visible_tag is null and (
    (category_page_id is not null and is_couple())
    or (category_page_id is null and is_couple_or_wedding_party())
  )
);
create policy "manage option groups for your tag" on option_groups for insert with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "couple manages category option groups update" on option_groups;
create policy "couple manages category option groups update" on option_groups for update using (
  visible_tag is null and (
    (category_page_id is not null and is_couple())
    or (category_page_id is null and is_couple_or_wedding_party())
  )
);
create policy "manage option groups for your tag update" on option_groups for update using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

drop policy if exists "couple manages category option groups delete" on option_groups;
create policy "couple manages category option groups delete" on option_groups for delete using (
  visible_tag is null and (
    (category_page_id is not null and is_couple())
    or (category_page_id is null and is_couple_or_wedding_party())
  )
);
create policy "manage option groups for your tag delete" on option_groups for delete using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

-- page_options/page_option_images already gate through option_groups via
-- EXISTS subqueries that don't reference visible_tag, so a gendered
-- group's options are only as reachable as the group itself — no change
-- needed there.

-- tasks: same pattern, plus (separately, see below) a NEW read grant for
-- family that must stay clear of gendered rows too.
drop policy if exists "wedding party reads tasks" on tasks;
create policy "wedding party reads tasks" on tasks for select using (
  visible_tag is null and is_couple_or_wedding_party()
);
drop policy if exists "wedding party manages tasks" on tasks;
create policy "wedding party manages tasks" on tasks for all using (
  visible_tag is null and is_couple_or_wedding_party()
) with check (
  visible_tag is null and is_couple_or_wedding_party()
);
create policy "read tasks for your tag" on tasks for select using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);
create policy "manage tasks for your tag" on tasks for all using (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
) with check (
  visible_tag is not null and fn_has_visible_tag(visible_tag)
);

-- Family: read access to (non-gendered) tasks.
create policy "family reads tasks" on tasks for select using (
  visible_tag is null and is_family_or_above()
);

-- Family: read + add expenses, not edit/delete/settle — narrower than the
-- existing "wedding party manages expenses" FOR ALL policy, added
-- alongside it rather than replacing it.
create policy "family reads expenses" on expenses for select using (is_family_or_above());
create policy "family adds expenses" on expenses for insert with check (is_family_or_above());
create policy "family reads expense splits" on expense_splits for select using (is_family_or_above());
create policy "family adds expense splits" on expense_splits for insert with check (is_family_or_above());

-- page_options/page_option_images gate through option_groups via inline
-- conditions rather than trusting option_groups' own RLS (each rewrites
-- the visibility check itself) — so the visible_tag narrowing above
-- doesn't automatically apply to them; without this, a gendered
-- standalone group's OPTIONS (not just the group row itself) would still
-- be readable/writable by any wedding_party member via the old
-- is_couple_or_wedding_party() branch, regardless of visible_tag.
create or replace function fn_option_group_visible(p_option_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select fn_has_visible_tag(visible_tag) from option_groups where id = p_option_group_id;
$$;

drop policy if exists "family reads page options" on page_options;
create policy "family reads page options" on page_options for select using (
  is_couple()
  or (is_family_or_above() and fn_page_options_data_access(option_group_id) and fn_option_group_visible(option_group_id))
);

drop policy if exists "manage page options" on page_options;
create policy "manage page options" on page_options for all using (
  fn_option_group_visible(option_group_id) and exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  fn_option_group_visible(option_group_id) and exists (
    select 1 from option_groups g
    where g.id = page_options.option_group_id
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- page_option_images' read policy was a blanket is_family_or_above() with
-- no group-awareness at all (pre-existing, not introduced by gendered
-- pages) — tightened here to actually check the owning option's
-- visibility, which also happens to close the same gendered-leak gap.
drop policy if exists "family reads page option images" on page_option_images;
create policy "family reads page option images" on page_option_images for select using (
  exists (
    select 1 from page_options po
    where po.id = page_option_images.page_option_id
      and (is_couple() or (is_family_or_above() and fn_option_group_visible(po.option_group_id)))
  )
);

drop policy if exists "manage page option images" on page_option_images;
create policy "manage page option images" on page_option_images for all using (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and fn_has_visible_tag(g.visible_tag)
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
) with check (
  exists (
    select 1 from page_options po
    join option_groups g on g.id = po.option_group_id
    where po.id = page_option_images.page_option_id
      and fn_has_visible_tag(g.visible_tag)
      and ((g.category_page_id is not null and is_couple())
        or (g.category_page_id is null and is_couple_or_wedding_party()))
  )
);

-- ===== 0029_fix_contacts_insert_recursion.sql =====
-- Fixes a live bug in 0027's "guest adds own plus ones" INSERT policy:
-- it contains a raw (non-security-definer) subquery reading
-- contacts.plus_one_limit FROM contacts itself. A self-referential
-- subquery embedded directly in a policy ON the same table forces
-- Postgres to re-apply that table's own RLS to evaluate it — producing
-- the confirmed live error "infinite recursion detected in policy for
-- relation \"contacts\"" every time this policy's WITH CHECK is
-- evaluated (i.e. on every insert into contacts, including the couple
-- adding a guest's +1 from the guest list, since is_couple() being true
-- doesn't stop Postgres from still needing to evaluate — and thus plan —
-- this policy's full expression as part of the combined check).
--
-- fn_guest_plus_one_count (right next to the broken subquery in 0027)
-- already avoided this exact trap for its own lookup by being
-- security definer, which bypasses RLS for that query. This wraps the
-- second, previously-unwrapped subquery the same way.

create or replace function fn_contact_plus_one_limit(p_contact_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select plus_one_limit from contacts where id = p_contact_id;
$$;

drop policy if exists "guest adds own plus ones" on contacts;
create policy "guest adds own plus ones" on contacts for insert with check (
  is_couple()
  or (
    parent_contact_id = (select contact_id from profiles where id = auth.uid())
    and fn_guest_plus_one_count(parent_contact_id) < coalesce(fn_contact_plus_one_limit(parent_contact_id), 0)
  )
);

-- ===== 0030_normalise_contact_tags.sql =====
-- Contact tags drive access: page_permissions tag rows, fn_has_visible_tag(),
-- and the nav all compare tags by EXACT string against snake_case keys
-- (best_man, maid_of_honour, groomsman, bridesmaid). Tags were saved exactly
-- as typed ("Best Man", "Maid Of Honour", "Groomsman"), so none of that
-- matched a real person. This normalises what's already stored; the app now
-- normalises on every write too (src/lib/tags.ts).
--
-- Same algorithm as normalizeTag() in TypeScript: lowercase, whitespace and
-- hyphens -> underscore, drop anything else non-alphanumeric, collapse
-- repeated underscores, trim leading/trailing underscores.

create or replace function fn_normalize_tag(p_tag text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '_' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(p_tag)), '[\s-]+', '_', 'g'),
          '[^a-z0-9_]', '', 'g'),
        '_+', '_', 'g')
    ),
    ''
  );
$$;

-- 1. contacts.tags
update contacts c
set tags = coalesce(
  (select array_agg(distinct n)
   from (select fn_normalize_tag(t) as n from unnest(c.tags) as t) x
   where n is not null),
  '{}'
)
where c.tags is not null and cardinality(c.tags) > 0;

-- 2. page_permissions tag rows saved through the Roles & Access screen with
-- the old capitalised spelling. A legacy row whose normalised twin already
-- exists is dropped (the twin is the seeded/authoritative one — notably the
-- stray 'comms' rows for Best Man / Maid Of Honour, which must not stand);
-- the rest are renamed in place.
delete from page_permissions p
where p.principal_type = 'tag'
  and p.principal_value <> fn_normalize_tag(p.principal_value)
  and exists (
    select 1 from page_permissions q
    where q.page_key = p.page_key
      and q.principal_type = 'tag'
      and q.principal_value = fn_normalize_tag(p.principal_value)
  );

update page_permissions
set principal_value = fn_normalize_tag(principal_value)
where principal_type = 'tag'
  and principal_value <> fn_normalize_tag(principal_value);

-- 3. Best man / maid of honour are not meant to reach Comms, the access
-- admin, the Budget, or the full guest list. 0027 seeded page_access = true
-- on every registry page for them, which the nav then advertised even though
-- the route layouts turn them away. Switch those rows off so permissions,
-- nav and layouts agree. (Reversible per row from Roles & Access.)
update page_permissions
set page_access = false, data_access = false, edit_access = false, updated_at = now()
where principal_type = 'tag'
  and principal_value in ('best_man', 'maid_of_honour')
  and page_key in ('comms', 'access', 'budget', 'guests');

-- ===== 0031_cost_access.sql =====
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

-- ===== 0032_drop_option_cost_columns.sql =====
-- Second half of 0031_cost_access.sql. Run this only AFTER the deploy that
-- reads prices from page_option_costs is live — it removes the old price
-- columns from page_options, which is the step that actually stops a price
-- travelling with a venue's row.
--
-- Until this runs, anyone who can read an option row can still read its old
-- (now stale) price columns directly, so it must be in place before
-- page_options is opened up to best man / maid of honour.

-- The temporary mirror trigger from 0031 goes first (it references the
-- columns being dropped).
drop trigger if exists page_option_costs_sync on page_options;
drop function if exists fn_page_option_costs_sync();

-- Permanent replacement: every new option gets its (empty) cost row, so
-- "no cost row visible" always means "hidden from you". Security definer
-- because the person adding an option may not be allowed to see prices.
create or replace function fn_page_option_costs_ensure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into page_option_costs (page_option_id)
  values (new.id)
  on conflict (page_option_id) do nothing;
  return new;
end;
$$;

create trigger page_option_costs_ensure
  after insert on page_options
  for each row execute function fn_page_option_costs_ensure();

-- Belt and braces: any option that somehow has no cost row yet.
insert into page_option_costs (page_option_id)
select po.id from page_options po
where not exists (select 1 from page_option_costs c where c.page_option_id = po.id);

alter table page_options
  drop column predicted_cost_min,
  drop column predicted_cost_max,
  drop column actual_cost,
  drop column currency;

-- ===== 0033_party_planner_access.sql =====
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

-- ===== 0034_project_admins_and_budgets.sql =====
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

-- ===== 0035_admin_accounts.sql =====
-- Support for the couple managing people's accounts from the guest list.
--
-- Accounts are now GIVEN, not self-created: the couple creates them from the
-- guest list, and sign-in only works for an account that exists. Everything
-- those actions need beyond Supabase's own admin API lives here:
--
--   * admin_audit      — who did what to whose account, and when;
--   * fn_admin_revoke_sessions — signs a person out of every device.
--
-- New table + function only, nothing existing is changed, so it is safe to
-- run before or after the matching app deploy (the new buttons that call
-- these simply report an error until it has been run).

-- ---------------------------------------------------------------------------
-- 1. Audit trail
-- ---------------------------------------------------------------------------
create table admin_audit (
  id uuid primary key default gen_random_uuid(),
  -- The couple member who did it. Kept even if their profile is later removed.
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  -- Whose account was affected. contacts rows can be deleted, so the email
  -- is recorded too: the trail must still make sense afterwards.
  target_contact_id uuid references contacts(id) on delete set null,
  target_email text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_audit_created_at_idx on admin_audit (created_at desc);

alter table admin_audit enable row level security;

-- Couple can read it. Nobody writes through RLS: entries are written only by
-- the server (service role, which bypasses RLS) as part of each action, so a
-- logged-in browser can never forge or erase a line.
create policy "couple reads admin audit" on admin_audit for select using (is_couple());

-- ---------------------------------------------------------------------------
-- 2. Sign out everywhere
-- ---------------------------------------------------------------------------
-- Supabase's admin API can only end a session if you hold that person's own
-- token, which the couple never do. Deleting the rows is what "sign out of
-- every device" means: their next request finds no session and must sign in
-- again (an already-issued access token still lives until it expires, up to
-- an hour, but can no longer be refreshed).
--
-- Callable ONLY by the server's service role — locked down below, because
-- letting anyone call it would let them sign other people out.
create or replace function fn_admin_revoke_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Compared as text so this works whether Supabase's auth schema types
  -- user_id as uuid or varchar.
  delete from auth.refresh_tokens where user_id::text = p_user_id::text;
  delete from auth.sessions where user_id::text = p_user_id::text;
end;
$$;

revoke all on function fn_admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function fn_admin_revoke_sessions(uuid) to service_role;

-- ===== 0036_view_as_support.sql =====
-- Support for "view as": the couple temporarily seeing the site exactly as
-- one particular person does.
--
-- View-as works by opening a real, short-lived session as that person (the
-- only way to get exactly their access, since every rule keys off who is
-- signed in). A side effect is that Supabase stamps the person's "last
-- signed in" time — which would make the guest list claim they had signed in
-- when it was really the couple looking. This function puts that timestamp
-- back to what it was.
--
-- Callable ONLY by the server's service role. It never raises: if this
-- database won't allow the write, it returns false and view-as still works —
-- the audit log (admin_audit, 0035) remains the true record either way.
--
-- New function only; safe to run before or after the matching app deploy.

create or replace function fn_admin_restore_last_sign_in(p_user_id uuid, p_last_sign_in_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set last_sign_in_at = p_last_sign_in_at
  where id = p_user_id;
  return found;
exception when others then
  return false;
end;
$$;

revoke all on function fn_admin_restore_last_sign_in(uuid, timestamptz) from public, anon, authenticated;
grant execute on function fn_admin_restore_last_sign_in(uuid, timestamptz) to service_role;

-- ===== 0037_reactions_and_comments.sql =====
-- Thumbs up / thumbs down and comments on options, ideas and tasks.
--
-- One pair of tables serves all three kinds of item (target_type +
-- target_id) rather than a pair per kind, so the screens and rules are
-- written once.
--
-- The central rule: you can see, vote on and comment on an item exactly when
-- you can see the item itself. That is enforced by asking the item's own
-- table under the READER'S access (the EXISTS checks below run as the caller,
-- so every existing rule on options/ideas/tasks applies unchanged — category
-- access, hidden categories, and the stag/hen boards' privacy). Nothing about
-- item visibility is re-implemented here, so it can't drift.
--
--   * Voting and commenting: anyone signed in who can see the item, except
--     plain guests.
--   * One vote per person per item; change it or take it back any time.
--   * Edit your own comment; delete your own. The couple can delete any
--     comment; a stag/hen project's admin can delete any on their board.
--
-- New tables only. Safe to run before or after the matching app deploy.
-- Depends on 0034 (fn_is_project_admin).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('page_option', 'idea', 'task')),
  target_id uuid not null,
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  -- Name as it was when they voted. People can't read each other's profiles
  -- (by design), so the name travels with the row; stamped by trigger, never
  -- taken from the client.
  author_name text,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, profile_id)
);
create index reactions_target_idx on reactions (target_type, target_id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('page_option', 'idea', 'task')),
  target_id uuid not null,
  -- Kept (as "set null") if the account is ever removed, so a thread doesn't
  -- lose its history; author_name still says who it was.
  profile_id uuid default auth.uid() references profiles(id) on delete set null,
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_target_idx on comments (target_type, target_id, created_at);

alter table reactions enable row level security;
alter table comments enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Server-set fields
-- ---------------------------------------------------------------------------
-- On insert: who and their name come from the session, whatever the client
-- sent. On update: the only things that may change are a vote's value and a
-- comment's text; everything identifying is pinned, and edited_at is stamped.
-- (When there is no signed-in user — the SQL editor or the server's service
-- role — rows are left as given.)
create or replace function fn_stamp_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.profile_id := auth.uid();
      new.author_name := (select full_name from profiles where id = auth.uid());
      new.created_at := now();
      if tg_table_name = 'comments' then
        new.edited_at := null;
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  new.id := old.id;
  new.target_type := old.target_type;
  new.target_id := old.target_id;
  new.profile_id := old.profile_id;
  new.author_name := old.author_name;
  new.created_at := old.created_at;
  if tg_table_name = 'comments' then
    if new.body is distinct from old.body then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger reactions_stamp before insert or update on reactions
  for each row execute function fn_stamp_feedback();
create trigger comments_stamp before insert or update on comments
  for each row execute function fn_stamp_feedback();

-- ---------------------------------------------------------------------------
-- 3. Tidy up when an item is deleted
-- ---------------------------------------------------------------------------
-- target_id can't be a real foreign key (it points at one of three tables),
-- so deleting an option/idea/task removes its votes and comments here.
create or replace function fn_delete_feedback_for_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from reactions where target_type = tg_argv[0] and target_id = old.id;
  delete from comments where target_type = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;

create trigger page_options_delete_feedback after delete on page_options
  for each row execute function fn_delete_feedback_for_target('page_option');
create trigger idea_boards_delete_feedback after delete on idea_boards
  for each row execute function fn_delete_feedback_for_target('idea');
create trigger tasks_delete_feedback after delete on tasks
  for each row execute function fn_delete_feedback_for_target('task');

-- ---------------------------------------------------------------------------
-- 4. Who may moderate a thread
-- ---------------------------------------------------------------------------
-- The couple anywhere; on a stag/hen board, that project's admin. Looks the
-- item up with definer rights only to read its visible_tag.
create or replace function fn_can_moderate_target(p_target_type text, p_target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple() or coalesce((
    select fn_is_project_admin(t.visible_tag)
    from (
      select g.visible_tag
        from page_options po join option_groups g on g.id = po.option_group_id
        where p_target_type = 'page_option' and po.id = p_target_id
      union all
      select i.visible_tag from idea_boards i where p_target_type = 'idea' and i.id = p_target_id
      union all
      select k.visible_tag from tasks k where p_target_type = 'task' and k.id = p_target_id
    ) t
    where t.visible_tag is not null
    limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------
-- "Can see the item" — written out per kind because each EXISTS must name a
-- real table for the caller's own access rules on it to apply.

create policy "read reactions on visible items" on reactions for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
);

create policy "vote on visible items" on reactions for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
  )
);

-- Changing your vote. Still requires seeing the item (access can be taken
-- away after a vote was cast).
create policy "change own vote" on reactions for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
  )
);

create policy "withdraw own vote" on reactions for delete using (
  profile_id = auth.uid()
);

create policy "read comments on visible items" on comments for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
);

create policy "comment on visible items" on comments for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
  )
);

create policy "edit own comment" on comments for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
  )
);

create policy "delete own comment or moderate" on comments for delete using (
  profile_id = auth.uid() or fn_can_moderate_target(target_type, target_id)
);

-- ===== 0038_moodboard_contributors.sql =====
-- Who may see and add to the MAIN moodboard (idea_boards with no visible_tag).
--
-- Decision (Nick, Nov 2026): family, best man and maid of honour can add to
-- the main moodboard, with no approval step; the couple can too. Bridesmaids
-- and groomsmen add to their OWN stag/hen boards (already the case via
-- visible_tag, 0028/0034) and are NOT part of the main board. Plain wedding
-- party aren't either, and neither are guests.
--
-- What this changes:
--   * READ of a main-board idea: couple, family, best man, maid of honour.
--     Previously every wedding-party member could also read it (the policy
--     used is_wedding_party_or_above) although they have no page for it.
--   * ADD: family joins the people who can post; plain wedding party no
--     longer can on the main board. (Best man/MoH are role wedding_party, so
--     they are admitted by the elevated-tag check, not by role.)
--   * AUTHORSHIP: created_by is stamped by the database from the signed-in
--     person, so nobody can post as someone else. (The author-or-couple
--     edit/delete rules from 0009/0010 and the project-admin ones from 0034
--     are unchanged.)
--
-- Policies and one trigger only; safe to run before or after the app deploy.
-- Depends on 0033 (fn_is_party_elevated).

drop policy if exists "read idea boards for your tier" on idea_boards;
create policy "read idea boards for your tier" on idea_boards for select using (
  visible_tag is null and (
    is_couple()
    or (tier = 'family' and is_family_or_above())
    or (tier = 'wedding_party' and (is_family_or_above() or fn_is_party_elevated()))
    or (tier = 'guest' and auth.uid() is not null)
  )
);

drop policy if exists "post ideas for your tier" on idea_boards;
create policy "post ideas for your tier" on idea_boards for insert with check (
  visible_tag is null and (
    is_couple()
    or (tier = 'family' and is_family_or_above())
    or (tier = 'wedding_party' and (is_family_or_above() or fn_is_party_elevated()))
    or (tier = 'guest' and auth.uid() is not null)
  )
);
-- ("read idea boards for your tag" / "post ideas for your tag" from 0028 are
-- unchanged: the stag and hen boards.)

create or replace function fn_stamp_idea_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists idea_boards_stamp_author on idea_boards;
create trigger idea_boards_stamp_author before insert on idea_boards
  for each row execute function fn_stamp_idea_author();

-- ===== 0039_error_log.sql =====
-- A private record of server errors, so the couple can see what is going
-- wrong without digging through hosting logs.
--
-- Written only by the server (service role, via instrumentation.ts), read and
-- cleared only by the couple. Deliberately holds no personal data: no names,
-- emails, user ids or raw URLs — just which page template failed (e.g.
-- "/categories/[slug]", never a link containing someone's RSVP token), a
-- shortened error message, and the error's reference code (digest).
--
-- New table only; safe to run before or after the app deploy.

create table error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null,
  route_type text,
  method text,
  message text not null,
  digest text
);

create index error_log_created_at_idx on error_log (created_at desc);
create index error_log_digest_idx on error_log (digest);

alter table error_log enable row level security;

create policy "couple reads error log" on error_log for select using (is_couple());
create policy "couple clears error log" on error_log for delete using (is_couple());
-- No insert/update policy: only the server (service role bypasses RLS) can
-- add lines, so a browser can never forge or alter one.

-- ===== 0040_family_not_on_stag_hen_pages.sql =====
-- Family can open the Groomsmen and Bridesmaids pages (they inherit "Project",
-- which family may see) even though everything on those boards is hidden from
-- them by the database, so they only ever saw an empty page. Found by the
-- per-person smoke test (tests/personas). Give those two pages an explicit
-- "no access" rule for family, so they are turned away like everyone else who
-- isn't on that board. The couple can still change this in Roles & Access.
--
-- Data only; safe to run before or after the app deploy.

insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
values
  ('project:groomsmen', 'role', 'family', false, false, false, false),
  ('project:bridesmaids', 'role', 'family', false, false, false, false)
on conflict (page_key, principal_type, principal_value) do update
  set page_access = false, data_access = false, edit_access = false, cost_access = false;

-- ===== 0041_task_priority_and_done_date.sql =====
-- Tasks get a priority flag and a completion date (the created date already
-- exists as created_at). Priority: 0 optional, 1 not urgent, 2 normal,
-- 3 important, 4 urgent. Existing tasks become "normal".
--
-- Additive only, and existing row-level rules already cover these columns
-- (who may update a task is unchanged), so there is nothing to re-test.
-- Safe to run before or after the app deploy: the old app ignores the new
-- columns; the new app needs them.

alter table tasks
  add column if not exists priority smallint not null default 2,
  add column if not exists done_at timestamptz;

alter table tasks drop constraint if exists tasks_priority_range;
alter table tasks add constraint tasks_priority_range check (priority between 0 and 4);

-- Tasks already marked done keep no date (it was never recorded); only
-- newly completed ones are stamped.

-- ===== 0042_nested_categories.sql =====
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

-- ===== 0043_organising_comms.sql =====
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

-- ===== 0044_big_day.sql =====
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

-- ===== 0045_contact_photos.sql =====
-- A photo for each person on the guest list, shown on the Groomsmen and
-- Bridesmaids group charts. Just a link to the picture in the couple's Drive
-- (the same way every other photo on the site is stored). Who can change it is
-- whoever can already edit a contact (the couple); nothing about access
-- changes.
--
-- Additive only; safe to run before or after the app deploy (the app copes
-- with the column not existing yet, it just shows initials until it does).

alter table contacts add column if not exists photo_url text;

-- ===== 0046_category_option_kind.sql =====
-- What kind of options a category holds decides which boxes its option forms
-- show: food has no use for a map pin, nights or beds, a venue wants a pin, a
-- place to stay wants a pin plus nights and how many it sleeps.
--
--   general : name, description, link, price, date, contact, photos
--   venue   : general + map pin (latitude / longitude)
--   stay    : venue + nights + sleeps
--
-- Existing categories are set from what they already hold, so nothing that is
-- in use disappears from its form: any category with an option that has nights
-- or beds becomes 'stay'; otherwise any with a map pin (or the Venue category)
-- becomes 'venue'; everything else is 'general'. The couple can change it per
-- category afterwards.
--
-- Safe to run before or after the app deploy (the app shows every box until it
-- can read this column).

alter table category_pages
  add column if not exists option_kind text not null default 'general'
  check (option_kind in ('general', 'venue', 'stay'));

update category_pages c set option_kind = 'stay'
where exists (
  select 1 from option_groups g join page_options o on o.option_group_id = g.id
  where g.category_page_id = c.id and (o.nights is not null or o.sleeps is not null)
);

update category_pages c set option_kind = 'venue'
where c.option_kind = 'general'
  and (
    c.slug = 'venue'
    or exists (
      select 1 from option_groups g join page_options o on o.option_group_id = g.id
      where g.category_page_id = c.id and (o.latitude is not null or o.longitude is not null)
    )
  );

-- ===== 0047_board_categories.sql =====
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

-- ===== 0048_category_locations.sql =====
-- A category can have a place on the map. A destination like "Porto" is a
-- category with its own pin; its parent ("Stag do") then shows every
-- destination on one map with each one's total, and Porto's own page maps the
-- accommodation, activities and so on inside it from their pins.
--
-- A category without a pin of its own is placed automatically from the pins of
-- the options beneath it (the app averages them), so this is only needed for a
-- place with no pinned options yet.
--
-- Who can set it is whoever can already rename the category (the couple; a
-- board's admin on a stag/hen board). Additive; safe before or after the app
-- deploy (the app copes with the columns not existing yet).

alter table category_pages
  add column if not exists latitude double precision check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude is null or longitude between -180 and 180);

-- ===== 0049_category_feedback.sql =====
-- Thumbs up/down and comments on a plan itself ("Porto" as an idea for a
-- stag location), not just on the options inside it. Same rule as 0037: you
-- can see, vote on and comment on a category exactly when you can see the
-- category (the EXISTS runs as the caller, so category access, hidden
-- categories and the stag/hen boards' privacy all apply unchanged).
--
-- A board's admin (best man / maid of honour) can delete any comment on their
-- board's categories; the couple anywhere. Additive; safe before or after the
-- app deploy.

alter table reactions drop constraint if exists reactions_target_type_check;
alter table reactions add constraint reactions_target_type_check
  check (target_type in ('page_option', 'idea', 'task', 'category'));
alter table comments drop constraint if exists comments_target_type_check;
alter table comments add constraint comments_target_type_check
  check (target_type in ('page_option', 'idea', 'task', 'category'));

-- Tidy up when a category is deleted.
drop trigger if exists category_pages_delete_feedback on category_pages;
create trigger category_pages_delete_feedback after delete on category_pages
  for each row execute function fn_delete_feedback_for_target('category');

-- Who may moderate a thread: now also knows about categories.
create or replace function fn_can_moderate_target(p_target_type text, p_target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple() or coalesce((
    select fn_is_project_admin(t.visible_tag)
    from (
      select g.visible_tag
        from page_options po join option_groups g on g.id = po.option_group_id
        where p_target_type = 'page_option' and po.id = p_target_id
      union all
      select i.visible_tag from idea_boards i where p_target_type = 'idea' and i.id = p_target_id
      union all
      select k.visible_tag from tasks k where p_target_type = 'task' and k.id = p_target_id
      union all
      select c.board_tag from category_pages c where p_target_type = 'category' and c.id = p_target_id
    ) t
    where t.visible_tag is not null
    limit 1
  ), false);
$$;

-- Policies, with the extra kind.
drop policy if exists "read reactions on visible items" on reactions;
create policy "read reactions on visible items" on reactions for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
  or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = reactions.target_id))
);

drop policy if exists "vote on visible items" on reactions;
create policy "vote on visible items" on reactions for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = reactions.target_id))
  )
);

drop policy if exists "change own vote" on reactions;
create policy "change own vote" on reactions for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = reactions.target_id))
  )
);

drop policy if exists "read comments on visible items" on comments;
create policy "read comments on visible items" on comments for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
  or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = comments.target_id))
);

drop policy if exists "comment on visible items" on comments;
create policy "comment on visible items" on comments for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = comments.target_id))
  )
);

drop policy if exists "edit own comment" on comments;
create policy "edit own comment" on comments for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = comments.target_id))
  )
);

-- ===== 0050_copy_stag_plans_to_hen.sql =====
-- One-off: copy everything planned on the groomsmen board (stag plans) onto
-- the bridesmaids board, renaming "Stag" to "Hen", so the maid of honour can
-- see how it works. Plans, nesting, map pins, option kinds, options (with
-- details, images and cost lines), winners.
--
-- Not copied: votes and comments (they are people's own), tasks and ideas.
-- Safe to run once; if the bridesmaids board already has plans it does
-- nothing (so it can't duplicate them a second time). Run AFTER 0047-0049.

do $$
declare
  r record;
  v_new uuid;
  v_new_group uuid;
  v_opt uuid;
  v_slug text;
  v_title text;
  v_parent_new uuid;
  v_parent_slug text;
  o record;
  n int;
begin
  if exists (select 1 from category_pages where board_tag = 'bridesmaid') then
    raise notice 'The bridesmaids board already has plans; nothing copied.';
    return;
  end if;

  create temp table _copy_map (old_id uuid primary key, new_id uuid not null, new_slug text not null) on commit drop;

  -- Parents before children.
  for r in
    with recursive tree as (
      select c.*, 0 as depth from category_pages c where c.board_tag = 'groomsman' and c.parent_id is null
      union all
      select c.*, t.depth + 1 from category_pages c join tree t on c.parent_id = t.id
    )
    select * from tree order by depth, sort_order, title
  loop
    v_title := regexp_replace(r.title, 'stag', 'Hen', 'gi');
    v_slug := regexp_replace(r.slug, 'stag', 'hen', 'gi');
    if v_slug = r.slug then
      v_slug := v_slug || '-hen';
    end if;
    n := 1;
    while exists (select 1 from category_pages where slug = v_slug) loop
      n := n + 1;
      v_slug := regexp_replace(r.slug, 'stag', 'hen', 'gi') || '-' || n;
    end loop;

    v_parent_new := null;
    v_parent_slug := null;
    if r.parent_id is not null then
      select new_id, new_slug into v_parent_new, v_parent_slug from _copy_map where old_id = r.parent_id;
    end if;

    insert into category_pages (slug, title, parent_id, sort_order, option_kind, latitude, longitude, board_tag)
    values (v_slug, v_title, v_parent_new, r.sort_order, r.option_kind, r.latitude, r.longitude, 'bridesmaid')
    returning id into v_new;

    insert into _copy_map values (r.id, v_new, v_slug);

    insert into page_registry (page_key, parent_page_key, label, default_min_role)
    values ('categories:' || v_slug, coalesce('categories:' || v_parent_slug, 'project:bridesmaids'), v_title, 'family')
    on conflict (page_key) do nothing;

    -- Its options comparison (every category has one).
    select id into v_new_group from option_groups where category_page_id = v_new;
    if v_new_group is null then
      insert into option_groups (category_page_id, title, created_by)
      select v_new, v_title, g.created_by from option_groups g where g.category_page_id = r.id
      returning id into v_new_group;
      if v_new_group is null then
        insert into option_groups (category_page_id, title) values (v_new, v_title) returning id into v_new_group;
      end if;
    end if;

    -- Options, with their details, images, prices and cost lines.
    for o in
      select po.* from page_options po
      join option_groups g on g.id = po.option_group_id
      where g.category_page_id = r.id
      order by po.created_at
    loop
      insert into page_options
        (option_group_id, name, description, web_link, option_date, contact_name, contact_phone, contact_email,
         latitude, longitude, nights, sleeps, is_winner)
      values
        (v_new_group, o.name, o.description, o.web_link, o.option_date, o.contact_name, o.contact_phone, o.contact_email,
         o.latitude, o.longitude, o.nights, o.sleeps, o.is_winner)
      returning id into v_opt;

      update page_option_costs c
         set predicted_cost_min = oc.predicted_cost_min,
             predicted_cost_max = oc.predicted_cost_max,
             actual_cost = oc.actual_cost,
             currency = oc.currency
        from page_option_costs oc
       where c.page_option_id = v_opt and oc.page_option_id = o.id;

      insert into page_option_images (page_option_id, image_url, sort_order)
      select v_opt, image_url, sort_order from page_option_images where page_option_id = o.id;

      insert into option_cost_items (page_option_id, name, kind, quantity, rate, amount, sort_order)
      select v_opt, name, kind, quantity, rate, amount, sort_order from option_cost_items where page_option_id = o.id;
    end loop;
  end loop;
end $$;

-- ===== 0051_category_feedback_toggle.sql =====
-- Whether a category invites votes and comments. Some plans ("Stag") are just
-- containers where voting makes no sense; others ("Porto") are ideas worth
-- voting on. Nothing can tell which, so it is a switch on each category
-- (default on, as it has been). Additive; safe before or after the deploy.
alter table category_pages add column if not exists feedback_enabled boolean not null default true;

-- ===== 0052_hide_from_couple.sql =====
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

-- ===== 0053_big_day_access.sql =====
-- The Big Day joins Roles & Access, so who can see and edit it can be granted
-- or taken away per role or per tag (best man, maid of honour...) like every
-- other page, instead of being fixed in code.
--
-- Today's behaviour is seeded as explicit rules so nothing changes until you
-- change it: the couple and family see and edit; best man and maid of honour
-- see and edit; every other wedding-party member sees; guests see only what has
-- been published (that is not a matrix rule, so it is not seeded here). The existing built-in rules stay too, so nothing already
-- working can break; a rule you add here GRANTS on top of them.
-- Safe to run before or after the app deploy.

insert into page_registry (page_key, label, default_min_role)
values ('big-day', 'The Big Day', 'wedding_party')
on conflict (page_key) do nothing;

insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access)
values
  ('big-day', 'role', 'family', true, true, true),
  ('big-day', 'tag', 'best_man', true, true, true),
  ('big-day', 'tag', 'maid_of_honour', true, true, true),
  ('big-day', 'role', 'wedding_party', true, true, false)
on conflict (page_key, principal_type, principal_value) do nothing;

-- Editing: the built-in groups OR anyone the matrix grants edit to.
create or replace function fn_can_edit_big_day()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple()
      or auth_role() = 'family'
      or fn_is_party_elevated()
      or coalesce(fn_resolve_permission('big-day', 'edit'), false);
$$;

-- Reading: editors, wedding party, or anyone the matrix grants data access to
-- (a tag such as "bridesmaid" can be given the schedule, for instance).
drop policy if exists "read big day items" on big_day_items;
create policy "read big day items" on big_day_items for select using (
  fn_can_edit_big_day()
  or auth_role() = 'wedding_party'
  or coalesce(fn_resolve_permission('big-day', 'data'), false)
  or (auth.uid() is not null and visible_to_guests and fn_big_day_published())
);

-- ===== 0054_family_tasks.sql =====
-- Family can add and tick off to-dos on the planning page they can already see
-- (they could only read it before), and give them to anyone. Deleting stays
-- with the couple. The stag/hen boards already let their members add.
-- Additive; safe before or after the app deploy.

drop policy if exists "family adds tasks" on tasks;
create policy "family adds tasks" on tasks for insert with check (
  visible_tag is null and auth_role() = 'family'
);
drop policy if exists "family updates tasks" on tasks;
create policy "family updates tasks" on tasks for update using (
  visible_tag is null and auth_role() = 'family'
) with check (
  visible_tag is null and auth_role() = 'family'
);

-- ===== 0055_push_notifications.sql =====
-- Phone and desktop notifications (web push). One row per device someone turned
-- notifications on for. You can only see and change your own; the server reads
-- all of them (with its own access) when it needs to send.
--
-- prefs is a small object like {"winner_chosen": false}: a type is on unless it
-- is set to false here.
-- New table only; safe before or after the app deploy.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

create policy "read own push subscriptions" on push_subscriptions for select using (profile_id = auth.uid());
create policy "add own push subscription" on push_subscriptions for insert with check (profile_id = auth.uid());
create policy "change own push subscription" on push_subscriptions for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "remove own push subscription" on push_subscriptions for delete using (profile_id = auth.uid());

