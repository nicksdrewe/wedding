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
