-- Every authenticated user must have a profiles row. Without one,
-- getCurrentProfile() returns null and the role gates bounce the user to
-- /login even though they signed in successfully — an infinite loop that
-- looks exactly like "the code didn't work".
--
-- Nothing created that row before this, so only the manually-seeded couple
-- account worked; every guest would have looped forever.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  matched_contact contacts%rowtype;
begin
  -- Match the sign-in email to the guest list so the person inherits the
  -- tier the couple already assigned them, rather than defaulting to guest.
  select * into matched_contact
  from contacts
  where lower(email) = lower(new.email)
  limit 1;

  insert into profiles (id, contact_id, role, full_name)
  values (
    new.id,
    matched_contact.id,
    coalesce(matched_contact.role, 'guest'),
    coalesce(matched_contact.full_name, new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill anyone who signed up before this trigger existed.
insert into profiles (id, contact_id, role, full_name)
select
  u.id,
  c.id,
  coalesce(c.role, 'guest'),
  coalesce(c.full_name, u.raw_user_meta_data ->> 'full_name')
from auth.users u
left join contacts c on lower(c.email) = lower(u.email)
where not exists (select 1 from profiles p where p.id = u.id);

-- When the couple adds a contact for someone who has already signed in,
-- promote that existing profile to the tier they were given.
create or replace function sync_profile_from_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update profiles p
  set role = new.role,
      contact_id = new.id,
      full_name = coalesce(p.full_name, new.full_name)
  from auth.users u
  where p.id = u.id
    and lower(u.email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_contact_upserted on contacts;
create trigger on_contact_upserted
  after insert or update of email, role on contacts
  for each row execute function sync_profile_from_contact();
