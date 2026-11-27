-- Newer Supabase projects don't give the API roles access to new tables
-- automatically, so the tables and server-only functions added in 0056–0059
-- get their access spelled out here. Row security still decides which rows.

-- The wedding list: anyone reads (addresses are public), the couple edits theirs.
grant select on weddings to anon, authenticated;
grant update on weddings to authenticated;
grant all on weddings to service_role;

-- Replies to a wedding's emails: the couple reads, marks and clears them.
grant select, update, delete on inbound_emails to authenticated;
grant all on inbound_emails to service_role;

-- Server only.
grant all on signup_codes to service_role;
grant all on wedding_secrets to service_role;
grant execute on function fn_create_wedding(text, text, text, text, text, text, uuid, text) to service_role;
grant execute on function fn_check_signup_code(text) to service_role;
grant execute on function fn_seed_wedding(uuid, uuid) to service_role;
grant execute on function fn_slug_available(text) to service_role;

-- Helpers the row rules and the app call.
grant execute on function current_wedding_id() to anon, authenticated, service_role;
grant execute on function auth_role() to anon, authenticated, service_role;
grant execute on function fn_my_contact_id() to anon, authenticated, service_role;
grant execute on function fn_slug_reserved(text) to anon, authenticated, service_role;
