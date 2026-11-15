# Step 8, part 2 — votes and comments: the screens

Hand-over notes for building the UI on top of migration `0037_reactions_and_comments.sql`. The database part is done and tested (`supabase/tests/rls_feedback.test.mjs`, 49 checks). **Do not change the migration** — it may already be applied; anything further goes in a new numbered file.

## What the database already guarantees (don't re-implement, don't fight it)

- Tables `reactions` and `comments`, both keyed by `target_type` (`'page_option' | 'idea' | 'task'`) + `target_id`.
- **Visibility = the item's visibility.** If a user can read the option/idea/task, they can read its votes and comments; otherwise they get zero rows. No extra filtering is needed in queries.
- **Voting/commenting:** any signed-in non-guest who can see the item. Guests get a refusal.
- **Server-stamped fields:** on insert the database sets `profile_id` (to the caller), `author_name` and `created_at`; on update it pins everything except a reaction's `value` and a comment's `body`, and stamps `edited_at` when the body changes. So inserts only need `{ target_type, target_id, value }` / `{ target_type, target_id, body }`.
- **One vote per person per item** — `unique (target_type, target_id, profile_id)`. A second insert errors.
- **Comment body:** 1–2000 characters after trimming (check constraint).
- **Deletes:** own vote; own comment; the couple can delete any comment; a stag/hen board's admin (best man → groomsman rows, maid of honour → bridesmaid rows) can delete any comment on that board. Nobody can delete another person's vote or edit another person's comment.
- **RLS refuses silently on update/delete** (zero rows, no error) and **loudly on insert** (error). Server actions must `.select()` after update/delete and treat zero rows as "not allowed".
- Deleting an option/idea/task removes its votes and comments (triggers).
- People **cannot read each other's `profiles`** — always display `author_name` from the row, never join to profiles.

## Build this

### 1. Server actions — `src/lib/feedback/actions.ts` (`"use server"`)
Use the session client (`@/lib/supabase/server`), never the admin client. Validate with zod `safeParse` and return `{ error: string | null }` (see `src/lib/gendered/budget.ts` for the house pattern).

- `setReaction(targetType, targetId, value: 1 | -1 | 0, revalidate)`
  - `0` → delete own row (`.eq("profile_id", profile.id)`).
  - otherwise upsert: `.upsert({ target_type, target_id, value }, { onConflict: "target_type,target_id,profile_id" })`. (The insert trigger fills `profile_id`; pass `profile_id: profile.id` too so the conflict target matches.)
- `addComment(targetType, targetId, body, revalidate)`
- `updateComment(id, body, revalidate)` — `.update({ body }).eq("id", id).select("id")`; zero rows → "You can only edit your own comment."
- `deleteComment(id, revalidate)` — `.delete().eq("id", id).select("id")`; zero rows → "That comment can't be removed by you."
- Add `checkRateLimit(\`feedback:${profile.id}\`, { max: 120, windowSeconds: 3600 })` to `setReaction` and `addComment` (helper in `src/lib/rate-limit.ts`).
- `revalidatePath(revalidate)` on success. Friendly error text only — never surface raw Postgres messages.

### 2. Loading data — `src/lib/feedback/load.ts` (server-only helper)
`loadFeedback(supabase, targetType, ids: string[], myProfileId)` → one query each on `reactions` and `comments` with `.eq("target_type", …).in("target_id", ids)`; return a map `id → { up, down, myVote, upNames, downNames, comments[] }`. Skip the queries when `ids` is empty. Comments ordered by `created_at` ascending. Each comment needs `{ id, author_name, body, created_at, edited_at, mine: profile_id === myProfileId }`.

### 3. Components — `src/components/feedback/`
- `ReactionBar.tsx` (client): 👍 count and 👎 count as two small pill buttons; the viewer's own vote is filled (accent). Clicking your current vote clears it; clicking the other switches. Optimistic update with `useOptimistic`/local state and roll back on error. `title`/tooltip lists who voted (`upNames`, `downNames`). Use lucide `ThumbsUp` / `ThumbsDown`, not emoji. Buttons need `aria-pressed` and an accessible label ("Thumbs up, 3").
- `CommentThread.tsx` (client): collapsed "💬 n" → use lucide `MessageCircle` + count; expands inline to the list plus a one-line add box. Each comment: name, relative time (reuse `timeAgo` from `src/lib/accounts/types.ts`), "(edited)" when `edited_at`, body with `whitespace-pre-wrap`. Edit/Delete on your own; Delete also when `canModerate`. `window.confirm` before delete, matching the rest of the app. 2000-char `maxLength` on the textarea.
- `Feedback.tsx`: small wrapper rendering both, taking `{ targetType, targetId, data, canInteract, canModerate, revalidate }`. When `canInteract` is false (guest), show counts read-only with no buttons.
- Match existing styling: `font-serif text-[11px]`, `rounded-full`, `border-ink/20`, `text-ink-soft`, accent for active. Compact — these sit inside cards that are already dense. Must work at 375px wide; tap targets ≥ 36px.

### 4. Where to mount
| Screen | File | Target | `canModerate` |
|---|---|---|---|
| Category option cards | `src/components/options/OptionsBoard.tsx` → `OptionCard.tsx` | `page_option` | couple |
| Compare rows (project, groomsmen, bridesmaids pages) | `src/app/(party)/project/OptionsCompareGroup.tsx` | `page_option` | `group.canManageGroup` (already computed per group) or couple |
| Idea cards | `src/app/(party)/project/IdeaCard.tsx` (used by project, groomsmen, bridesmaids pages) | `idea` | couple, or `isAdmin` on the gendered pages |
| Idea board tiles | `src/app/(party)/project/ideas/page.tsx` | `idea` | couple — show the reaction bar + comment count under each tile |
| Tasks | `src/app/(party)/project/TaskRow.tsx` | `task` | couple, or `isAdmin` on the gendered pages — comment thread only is enough for tasks; votes optional |

Load feedback once per page in the server component (collect the ids, call `loadFeedback`, pass each item its slice) — not one query per card.

`canInteract` = signed-in and `profile.role !== "guest"`.

### 5. Optional, only if time: "sort by votes" toggle on a comparison (net score = up − down, ties by created order).

## Rules to keep
- Every push needs the user's OK first (AskUserQuestion), after `rm -rf .next && npm run build` passes. `next/font` sometimes fails to download once — just re-run the build.
- Don't run or edit migrations; the user runs them in the Supabase SQL editor. `0037` must be run before this UI is useful (without it the queries return errors — make `loadFeedback` treat a query error as "no feedback" so pages still render).
- View-as is read-only: writes are blocked by middleware with a 403. Nothing to do, but don't be surprised by it when testing.
- Test at phone width and with a guest account (counts visible, no buttons) and as a groomsman (can vote on the stag board, can't delete others' comments). The view-as feature on the Guest List is the easy way to look as each person; `tests/view-as/README.md` explains the automated versions.
- Reply to the user in plain language, lead with what happened, and say plainly what was and wasn't tested.
