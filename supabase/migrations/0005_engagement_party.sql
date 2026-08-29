-- Engagement party: an open, self-service RSVP separate from the main
-- wedding guest list. Anyone can add themselves via /engagement — no
-- personal invite link, no pre-sent email — unlike the token-gated
-- /rsvp/[token] flow. Seed the event row here so the public RSVP endpoint
-- has a stable row to attach responses to.
insert into events (name, description)
select
  'Engagement Party',
  'An open celebration ahead of the big day — everyone''s welcome, invite or no invite.'
where not exists (select 1 from events where name = 'Engagement Party');
