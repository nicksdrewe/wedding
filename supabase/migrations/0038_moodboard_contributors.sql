-- Who may see and add to the MAIN moodboard (idea_boards with no visible_tag).
--
-- Decision (Nick, Nov 2026): family, best man and maid of honour can add to
-- the main moodboard, with no approval step; the couple can too. Bridesmaids
-- and groomsmen add to their OWN stag/hen boards (already the case via
-- visible_tag, 0028/0034) and are NOT part of the main board. Plain wedding
-- party aren't either, and neither are guests.
--
-- What this changes:
--   * READ of a main-board idea: couple, family, best man, maid of honour.
--     Previously every wedding-party member could also read it (the policy
--     used is_wedding_party_or_above) although they have no page for it.
--   * ADD: family joins the people who can post; plain wedding party no
--     longer can on the main board. (Best man/MoH are role wedding_party, so
--     they are admitted by the elevated-tag check, not by role.)
--   * AUTHORSHIP: created_by is stamped by the database from the signed-in
--     person, so nobody can post as someone else. (The author-or-couple
--     edit/delete rules from 0009/0010 and the project-admin ones from 0034
--     are unchanged.)
--
-- Policies and one trigger only; safe to run before or after the app deploy.
-- Depends on 0033 (fn_is_party_elevated).

drop policy if exists "read idea boards for your tier" on idea_boards;
create policy "read idea boards for your tier" on idea_boards for select using (
  visible_tag is null and (
    is_couple()
    or (tier = 'family' and is_family_or_above())
    or (tier = 'wedding_party' and (is_family_or_above() or fn_is_party_elevated()))
    or (tier = 'guest' and auth.uid() is not null)
  )
);

drop policy if exists "post ideas for your tier" on idea_boards;
create policy "post ideas for your tier" on idea_boards for insert with check (
  visible_tag is null and (
    is_couple()
    or (tier = 'family' and is_family_or_above())
    or (tier = 'wedding_party' and (is_family_or_above() or fn_is_party_elevated()))
    or (tier = 'guest' and auth.uid() is not null)
  )
);
-- ("read idea boards for your tag" / "post ideas for your tag" from 0028 are
-- unchanged: the stag and hen boards.)

create or replace function fn_stamp_idea_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists idea_boards_stamp_author on idea_boards;
create trigger idea_boards_stamp_author before insert on idea_boards
  for each row execute function fn_stamp_idea_author();
