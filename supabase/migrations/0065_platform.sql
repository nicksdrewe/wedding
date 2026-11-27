-- The owner's console (/platform): editable copy for the commercial pages,
-- newsletters to couples with open/click tracking, and a social post planner.
-- Server only: row security is on and there are no policies, so only the
-- service role (used after checking the owner's email) can touch these.

create table if not exists site_copy (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists platform_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  audience text not null default 'couples',
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  recipients int not null default 0,
  created_at timestamptz not null default now()
);

-- One row per delivery event Resend reports back (delivered, opened, clicked,
-- bounced), so each newsletter shows how it landed.
create table if not exists platform_campaign_events (
  id bigserial primary key,
  campaign_id uuid not null references platform_campaigns(id) on delete cascade,
  email text not null,
  kind text not null check (kind in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  link text,
  at timestamptz not null default now()
);
create index if not exists platform_campaign_events_campaign_idx on platform_campaign_events (campaign_id, kind);

create table if not exists platform_social_posts (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'facebook' check (channel in ('facebook', 'instagram', 'both')),
  body text not null,
  image_url text,
  link text,
  planned_for timestamptz,
  status text not null default 'idea' check (status in ('idea', 'scheduled', 'posted')),
  created_at timestamptz not null default now()
);

alter table site_copy enable row level security;
alter table platform_campaigns enable row level security;
alter table platform_campaign_events enable row level security;
alter table platform_social_posts enable row level security;

grant all on site_copy, platform_campaigns, platform_campaign_events, platform_social_posts to service_role;
grant usage, select on sequence platform_campaign_events_id_seq to service_role;
-- the commercial pages read copy without signing in
grant select on site_copy to anon, authenticated;
create policy "anyone reads site copy" on site_copy for select using (true);

-- People who've asked not to get the newsletter (the link in every one).
create table if not exists platform_unsubscribes (
  email text primary key,
  at timestamptz not null default now()
);
alter table platform_unsubscribes enable row level security;
grant all on platform_unsubscribes to service_role;

-- links.<domain> carries Resend's click tracking, so no wedding can take it.
create or replace function fn_slug_reserved(p_slug text)
returns boolean
language sql immutable
as $$
  select p_slug = any (array[
    'www', 'app', 'api', 'admin', 'mail', 'email', 'smtp', 'help', 'support', 'status', 'blog',
    'docs', 'login', 'signin', 'signup', 'start', 'pricing', 'billing', 'pay', 'static', 'assets', 'cdn',
    'staging', 'dev', 'test', 'preview', 'demo', 'hello', 'team', 'weddings', 'weddingsweddings',
    'send', 'reply', 'rsend', 'bounce', 'inbound', 'mx', 'ns1', 'ns2',
    'links', 'track', 'click', 'platform', 'me'
  ]);
$$;
