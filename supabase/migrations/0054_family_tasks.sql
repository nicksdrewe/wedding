-- Family can add and tick off to-dos on the planning page they can already see
-- (they could only read it before), and give them to anyone. Deleting stays
-- with the couple. The stag/hen boards already let their members add.
-- Additive; safe before or after the app deploy.

drop policy if exists "family adds tasks" on tasks;
create policy "family adds tasks" on tasks for insert with check (
  visible_tag is null and auth_role() = 'family'
);
drop policy if exists "family updates tasks" on tasks;
create policy "family updates tasks" on tasks for update using (
  visible_tag is null and auth_role() = 'family'
) with check (
  visible_tag is null and auth_role() = 'family'
);
