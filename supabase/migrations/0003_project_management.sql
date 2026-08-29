-- Project Management module (couple + wedding party — NOT family, per the
-- brief's role table: family gets budget visibility only).

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  owner_contact_id uuid references contacts(id) on delete set null,
  status text not null default 'todo', -- todo | done
  due_date date,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

create or replace function is_couple_or_wedding_party() returns boolean
language sql stable security definer as $$
  select auth_role() in ('couple', 'wedding_party');
$$;

create policy "wedding party reads tasks" on tasks for select using (is_couple_or_wedding_party());
create policy "wedding party manages tasks" on tasks for all using (is_couple_or_wedding_party()) with check (is_couple_or_wedding_party());

-- Tighten expenses/expense_splits: 0001 scoped these to
-- is_wedding_party_or_above(), which (confusingly, given its name) includes
-- family. Family should not see project management or expense data.
drop policy if exists "wedding party reads expenses" on expenses;
drop policy if exists "wedding party manages expenses" on expenses;
create policy "wedding party reads expenses" on expenses for select using (is_couple_or_wedding_party());
create policy "wedding party manages expenses" on expenses for all using (is_couple_or_wedding_party()) with check (is_couple_or_wedding_party());

drop policy if exists "wedding party reads expense splits" on expense_splits;
drop policy if exists "wedding party manages expense splits" on expense_splits;
create policy "wedding party reads expense splits" on expense_splits for select using (is_couple_or_wedding_party());
create policy "wedding party manages expense splits" on expense_splits for all using (is_couple_or_wedding_party()) with check (is_couple_or_wedding_party());

-- idea_boards already scopes read access per-tier via role match in 0001;
-- restrict wedding-party board *writes* to couple + wedding_party (0001 let
-- any logged-in user post regardless of tier).
drop policy if exists "logged in users post ideas" on idea_boards;
create policy "post ideas for your tier" on idea_boards for insert with check (
  is_couple() or
  (tier = 'family' and is_family_or_above()) or
  (tier = 'wedding_party' and is_couple_or_wedding_party()) or
  (tier = 'guest' and auth.uid() is not null)
);
