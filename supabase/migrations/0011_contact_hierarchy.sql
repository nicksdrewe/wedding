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
