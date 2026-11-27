-- STAGING ONLY. The staging project was created after Supabase stopped giving
-- the API roles access to tables by default, so nothing built by
-- all_migrations.sql was reachable. This gives staging the same access the
-- live project has always had. Row security still decides which rows.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ...except the server-only signup functions.
revoke execute on function fn_create_wedding(text, text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function fn_check_signup_code(text) from public, anon, authenticated;
revoke execute on function fn_seed_wedding(uuid, uuid) from public, anon, authenticated;
