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
