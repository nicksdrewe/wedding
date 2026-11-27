-- Each wedding connects its own Google Drive for photos (Settings > Your
-- wedding > Photos). The sign-in is stored encrypted (the key lives only in
-- the hosting settings) next to the wedding's other secrets; nobody can read
-- this table except the server. Deleting the wedding deletes it too.
alter table wedding_secrets add column if not exists drive_refresh_token text;
alter table wedding_secrets add column if not exists drive_folder_id text;
alter table wedding_secrets add column if not exists drive_folder_name text;
alter table wedding_secrets add column if not exists drive_account text;
alter table wedding_secrets add column if not exists drive_connected_at timestamptz;
