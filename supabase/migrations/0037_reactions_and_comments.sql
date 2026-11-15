-- Thumbs up / thumbs down and comments on options, ideas and tasks.
--
-- One pair of tables serves all three kinds of item (target_type +
-- target_id) rather than a pair per kind, so the screens and rules are
-- written once.
--
-- The central rule: you can see, vote on and comment on an item exactly when
-- you can see the item itself. That is enforced by asking the item's own
-- table under the READER'S access (the EXISTS checks below run as the caller,
-- so every existing rule on options/ideas/tasks applies unchanged — category
-- access, hidden categories, and the stag/hen boards' privacy). Nothing about
-- item visibility is re-implemented here, so it can't drift.
--
--   * Voting and commenting: anyone signed in who can see the item, except
--     plain guests.
--   * One vote per person per item; change it or take it back any time.
--   * Edit your own comment; delete your own. The couple can delete any
--     comment; a stag/hen project's admin can delete any on their board.
--
-- New tables only. Safe to run before or after the matching app deploy.
-- Depends on 0034 (fn_is_project_admin).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('page_option', 'idea', 'task')),
  target_id uuid not null,
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  -- Name as it was when they voted. People can't read each other's profiles
  -- (by design), so the name travels with the row; stamped by trigger, never
  -- taken from the client.
  author_name text,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, profile_id)
);
create index reactions_target_idx on reactions (target_type, target_id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('page_option', 'idea', 'task')),
  target_id uuid not null,
  -- Kept (as "set null") if the account is ever removed, so a thread doesn't
  -- lose its history; author_name still says who it was.
  profile_id uuid default auth.uid() references profiles(id) on delete set null,
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_target_idx on comments (target_type, target_id, created_at);

alter table reactions enable row level security;
alter table comments enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Server-set fields
-- ---------------------------------------------------------------------------
-- On insert: who and their name come from the session, whatever the client
-- sent. On update: the only things that may change are a vote's value and a
-- comment's text; everything identifying is pinned, and edited_at is stamped.
-- (When there is no signed-in user — the SQL editor or the server's service
-- role — rows are left as given.)
create or replace function fn_stamp_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.profile_id := auth.uid();
      new.author_name := (select full_name from profiles where id = auth.uid());
      new.created_at := now();
      if tg_table_name = 'comments' then
        new.edited_at := null;
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  new.id := old.id;
  new.target_type := old.target_type;
  new.target_id := old.target_id;
  new.profile_id := old.profile_id;
  new.author_name := old.author_name;
  new.created_at := old.created_at;
  if tg_table_name = 'comments' then
    if new.body is distinct from old.body then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger reactions_stamp before insert or update on reactions
  for each row execute function fn_stamp_feedback();
create trigger comments_stamp before insert or update on comments
  for each row execute function fn_stamp_feedback();

-- ---------------------------------------------------------------------------
-- 3. Tidy up when an item is deleted
-- ---------------------------------------------------------------------------
-- target_id can't be a real foreign key (it points at one of three tables),
-- so deleting an option/idea/task removes its votes and comments here.
create or replace function fn_delete_feedback_for_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from reactions where target_type = tg_argv[0] and target_id = old.id;
  delete from comments where target_type = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;

create trigger page_options_delete_feedback after delete on page_options
  for each row execute function fn_delete_feedback_for_target('page_option');
create trigger idea_boards_delete_feedback after delete on idea_boards
  for each row execute function fn_delete_feedback_for_target('idea');
create trigger tasks_delete_feedback after delete on tasks
  for each row execute function fn_delete_feedback_for_target('task');

-- ---------------------------------------------------------------------------
-- 4. Who may moderate a thread
-- ---------------------------------------------------------------------------
-- The couple anywhere; on a stag/hen board, that project's admin. Looks the
-- item up with definer rights only to read its visible_tag.
create or replace function fn_can_moderate_target(p_target_type text, p_target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_couple() or coalesce((
    select fn_is_project_admin(t.visible_tag)
    from (
      select g.visible_tag
        from page_options po join option_groups g on g.id = po.option_group_id
        where p_target_type = 'page_option' and po.id = p_target_id
      union all
      select i.visible_tag from idea_boards i where p_target_type = 'idea' and i.id = p_target_id
      union all
      select k.visible_tag from tasks k where p_target_type = 'task' and k.id = p_target_id
    ) t
    where t.visible_tag is not null
    limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------
-- "Can see the item" — written out per kind because each EXISTS must name a
-- real table for the caller's own access rules on it to apply.

create policy "read reactions on visible items" on reactions for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
);

create policy "vote on visible items" on reactions for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
  )
);

-- Changing your vote. Still requires seeing the item (access can be taken
-- away after a vote was cast).
create policy "change own vote" on reactions for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
  )
);

create policy "withdraw own vote" on reactions for delete using (
  profile_id = auth.uid()
);

create policy "read comments on visible items" on comments for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
);

create policy "comment on visible items" on comments for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
  )
);

create policy "edit own comment" on comments for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
  )
);

create policy "delete own comment or moderate" on comments for delete using (
  profile_id = auth.uid() or fn_can_moderate_target(target_type, target_id)
);
