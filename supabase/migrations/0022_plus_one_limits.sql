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
