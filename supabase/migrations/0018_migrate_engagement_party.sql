-- Migrates the existing, hand-built Engagement Party page into the new
-- generic events system (0017) — same content, same URL behaviour (see
-- the /engagement redirect in app code), same photos and RSVPs, now
-- config-driven instead of hardcoded. Values below are copied verbatim
-- from the constants EngagementPageClient.tsx hardcoded before this
-- migration, not new copy.
update events
set
  slug = 'engagement-party',
  is_landing_cta = true,
  landing_cta_copy = 'RSVP to the engagement party',
  rsvp_enabled = true,
  rsvp_open = true,
  show_header = true,
  header_eyebrow = 'Nick & Ellie',
  header_title = 'Let''s celebrate early',
  header_body = 'Before the wedding itself, we''d love to celebrate the engagement with anyone who can make it — no formal invite needed, just let us know you''re coming.',
  show_photo_board = true,
  show_details = true,
  details_eyebrow = 'When & where',
  details_title = 'Join us at The Black Lion',
  venue_name = 'The Black Lion',
  venue_body = 'This one''s drinks and catching up rather than a sit-down meal — come fed! RSVP below and we''ll see you there.',
  location = 'The Black Lion, Hammersmith, London',
  starts_at = ('2026-10-24 19:00:00'::timestamp at time zone 'Europe/London'),
  show_map = true,
  show_rsvp_form = true,
  show_guest_list_column = true,
  show_on_diary = true
where name = 'Engagement Party';

-- Every existing photo belongs to this one event — there was no other
-- event with a photo board before this migration.
update engagement_photos
set event_id = (select id from events where name = 'Engagement Party')
where event_id is null;
