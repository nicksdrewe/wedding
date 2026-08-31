-- The landing page's guest-state heading and body copy were still
-- hardcoded engagement-party wording in ScrollFlowerHero.tsx regardless
-- of which event was actually flagged as the featured CTA — once a
-- different event takes that flag, the button would correctly say "RSVP
-- to the hen do" while the heading above it still said "Join us for the
-- engagement party". These three fields let the couple set every piece
-- of that copy per event, same pattern as header_eyebrow/header_title/
-- header_body on the event's own page.
alter table events add column landing_cta_eyebrow text;
alter table events add column landing_cta_heading text;
alter table events add column landing_cta_body text;
