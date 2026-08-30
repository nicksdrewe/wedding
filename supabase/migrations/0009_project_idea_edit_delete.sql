-- idea_boards only ever had select + insert policies (0001, tightened in
-- 0003) — editing/deleting an idea was impossible even for its own author.
-- Project Management's edit/delete work needs this: author-or-couple, same
-- rule the brief calls for. created_by stores the posting profile's id,
-- which is the same value as auth.uid() (profiles.id = auth user id).
create policy "author or couple updates idea" on idea_boards for update using (
  is_couple() or created_by = auth.uid()
) with check (
  is_couple() or created_by = auth.uid()
);

create policy "author or couple deletes idea" on idea_boards for delete using (
  is_couple() or created_by = auth.uid()
);
