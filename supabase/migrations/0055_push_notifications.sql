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
