-- Idea board images + tags, so ideas can grow into a private Pinterest-style
-- board: free-text tags for grouping, and one-to-many images per idea via
-- the same child-table pattern page_option_images established in 0006 (one
-- upload pipeline — src/lib/google/drive.ts + /api/upload — feeds both).

-- tags: mirrors contacts.tags exactly (0001_init.sql) — plain text[],
-- default empty array, no separate lookup table. Comma-separated input is
-- split/trimmed server-side (same tagsToArray helper approach as
-- src/app/(admin)/guests/actions.ts's updateContact).
alter table idea_boards add column if not exists tags text[] not null default '{}';

create table if not exists idea_board_images (
  id uuid primary key default gen_random_uuid(),
  idea_board_id uuid not null references idea_boards(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table idea_board_images enable row level security;

-- Read: same tier-gated visibility as idea_boards itself (0001's "read idea
-- boards for your tier" policy), resolved by walking back to the parent row.
drop policy if exists "read idea board images for your tier" on idea_board_images;
create policy "read idea board images for your tier" on idea_board_images for select using (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and (
        is_couple() or
        (b.tier = 'family' and is_family_or_above()) or
        (b.tier = 'wedding_party' and is_wedding_party_or_above()) or
        (b.tier = 'guest' and auth.uid() is not null)
      )
  )
);

-- Write (insert/update/delete): same actors who can edit/delete the idea
-- itself — author-or-couple, per 0009_project_idea_edit_delete.sql's
-- "author or couple updates/deletes idea" policies — resolved the same way.
drop policy if exists "author or couple manages idea board images" on idea_board_images;
create policy "author or couple manages idea board images" on idea_board_images for all using (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and (is_couple() or b.created_by = auth.uid())
  )
) with check (
  exists (
    select 1 from idea_boards b
    where b.id = idea_board_images.idea_board_id
      and (is_couple() or b.created_by = auth.uid())
  )
);
