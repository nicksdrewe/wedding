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
