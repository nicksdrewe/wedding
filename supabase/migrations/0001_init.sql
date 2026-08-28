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
