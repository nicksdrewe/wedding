-- Carries the current hardcoded landing-page guest-state copy (see
-- ScrollFlowerHero.tsx's ctaCopy()) onto the Engagement Party event row,
-- matching 0018's approach — so the home page reads identically once
-- ScrollFlowerHero switches to reading these columns instead.
update events
set
  landing_cta_eyebrow = 'You''re invited',
  landing_cta_heading = 'Join us for the engagement party',
  landing_cta_body = 'The wedding date is still to come — for now, let us know you''ll be there to celebrate the engagement.'
where name = 'Engagement Party';
