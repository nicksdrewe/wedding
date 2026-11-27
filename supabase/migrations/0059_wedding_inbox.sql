-- STAGING ONLY until the multi-wedding switch-over.
--
-- Replies to a wedding's emails. Guests write back to <slug>@weddingsweddings.co.uk;
-- Resend receives it and calls /api/email/inbound, which files it here under
-- that wedding. Only the couple can read them.

create table inbound_emails (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null default current_wedding_id() references weddings(id) on delete cascade,
  provider_id text,                     -- Resend's id for the received email
  from_email text not null,
  from_name text,
  contact_id uuid references contacts(id) on delete set null,  -- the guest, when the address is on the list
  to_email text not null,
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  attachment_count int not null default 0,
  received_at timestamptz not null default now(),
  read_at timestamptz,
  replied_at timestamptz,
  unique (wedding_id, provider_id)
);
create index inbound_emails_wedding_idx on inbound_emails (wedding_id, received_at desc);

alter table inbound_emails enable row level security;
create policy "only this wedding" on inbound_emails as restrictive for all
  using (wedding_id = (select current_wedding_id()))
  with check (wedding_id = (select current_wedding_id()));
create policy "couple reads the inbox" on inbound_emails for select using (is_couple());
create policy "couple marks the inbox" on inbound_emails for update using (is_couple()) with check (is_couple());
create policy "couple clears the inbox" on inbound_emails for delete using (is_couple());
-- no insert policy: only the server (service role) files new mail
