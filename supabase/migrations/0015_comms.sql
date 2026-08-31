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
