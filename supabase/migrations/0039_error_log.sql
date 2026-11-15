-- A private record of server errors, so the couple can see what is going
-- wrong without digging through hosting logs.
--
-- Written only by the server (service role, via instrumentation.ts), read and
-- cleared only by the couple. Deliberately holds no personal data: no names,
-- emails, user ids or raw URLs — just which page template failed (e.g.
-- "/categories/[slug]", never a link containing someone's RSVP token), a
-- shortened error message, and the error's reference code (digest).
--
-- New table only; safe to run before or after the app deploy.

create table error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null,
  route_type text,
  method text,
  message text not null,
  digest text
);

create index error_log_created_at_idx on error_log (created_at desc);
create index error_log_digest_idx on error_log (digest);

alter table error_log enable row level security;

create policy "couple reads error log" on error_log for select using (is_couple());
create policy "couple clears error log" on error_log for delete using (is_couple());
-- No insert/update policy: only the server (service role bypasses RLS) can
-- add lines, so a browser can never forge or alter one.
