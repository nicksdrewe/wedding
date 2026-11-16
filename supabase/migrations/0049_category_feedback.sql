-- Thumbs up/down and comments on a plan itself ("Porto" as an idea for a
-- stag location), not just on the options inside it. Same rule as 0037: you
-- can see, vote on and comment on a category exactly when you can see the
-- category (the EXISTS runs as the caller, so category access, hidden
-- categories and the stag/hen boards' privacy all apply unchanged).
--
-- A board's admin (best man / maid of honour) can delete any comment on their
-- board's categories; the couple anywhere. Additive; safe before or after the
-- app deploy.

alter table reactions drop constraint if exists reactions_target_type_check;
alter table reactions add constraint reactions_target_type_check
  check (target_type in ('page_option', 'idea', 'task', 'category'));
alter table comments drop constraint if exists comments_target_type_check;
alter table comments add constraint comments_target_type_check
  check (target_type in ('page_option', 'idea', 'task', 'category'));

-- Tidy up when a category is deleted.
drop trigger if exists category_pages_delete_feedback on category_pages;
create trigger category_pages_delete_feedback after delete on category_pages
  for each row execute function fn_delete_feedback_for_target('category');

-- Who may moderate a thread: now also knows about categories.
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
      union all
      select c.board_tag from category_pages c where p_target_type = 'category' and c.id = p_target_id
    ) t
    where t.visible_tag is not null
    limit 1
  ), false);
$$;

-- Policies, with the extra kind.
drop policy if exists "read reactions on visible items" on reactions;
create policy "read reactions on visible items" on reactions for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
  or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = reactions.target_id))
);

drop policy if exists "vote on visible items" on reactions;
create policy "vote on visible items" on reactions for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = reactions.target_id))
  )
);

drop policy if exists "change own vote" on reactions;
create policy "change own vote" on reactions for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = reactions.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = reactions.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = reactions.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = reactions.target_id))
  )
);

drop policy if exists "read comments on visible items" on comments;
create policy "read comments on visible items" on comments for select using (
     (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
  or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
  or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
  or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = comments.target_id))
);

drop policy if exists "comment on visible items" on comments;
create policy "comment on visible items" on comments for insert with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = comments.target_id))
  )
);

drop policy if exists "edit own comment" on comments;
create policy "edit own comment" on comments for update using (
  profile_id = auth.uid()
) with check (
  profile_id = auth.uid()
  and auth_role() <> 'guest'
  and (
       (target_type = 'page_option' and exists (select 1 from page_options x where x.id = comments.target_id))
    or (target_type = 'idea'        and exists (select 1 from idea_boards  x where x.id = comments.target_id))
    or (target_type = 'task'        and exists (select 1 from tasks        x where x.id = comments.target_id))
    or (target_type = 'category'    and exists (select 1 from category_pages x where x.id = comments.target_id))
  )
);
