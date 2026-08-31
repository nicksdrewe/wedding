-- Lets a message be composed as raw HTML (e.g. pasted from an external
-- email builder like Stripo) instead of always being treated as plain
-- text and escaped/paragraph-wrapped — see actions.ts's sendToRecipient,
-- which branches on this to decide whether to run the body through
-- toHtml() (escape + wrap) or send it through as-is.
alter table comms_messages
  add column body_type text not null default 'text' check (body_type in ('text', 'html'));
