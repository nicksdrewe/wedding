# Wedding-party rollout: audit + plan of action
Written 14 Nov 2026. Goal: best man (Alex Cummings) and maid of honour (Grace Adams) can reliably sign in, add things, see venues/dates/events, and collaborate with 👍/👎/comments; admin can see accounts, reset access, and view the site as any user type. Then open to third parties.

## 0. Decisions (updated 14 Nov)

**Answered by Nick**
- **D1 (writes).** Best man / MoH can add options, photos, dates and contacts on Categories; they **cannot delete categories**. For any category where they can see costs, they can **edit those costs too**.
- **D3 (costs, per category).** Couple can **hide costs per category from specific roles/tags**. Best man / MoH default to **no costs** on couple-run categories (venue, food, rings…), seeing only venues, options, dates, contacts. Costs they *are* allowed to see (e.g. groomsmen suits) they can edit.
- **Stag / hen projects.** Their boards and budgets are separate. Best man administers the **groomsmen** project, MoH the **bridesmaids** project, with full administrative rights over everything in it, **including costs and deletes**.
- **D6 (moodboards).** **No approval step.** Family, best man and MoH can add to the main moodboards. Bridesmaids/groomsmen can add to their own stag/hen moodboards. (Phase 3 is therefore simpler: no moderation queue.)
- **D7 (tags).** All tags updated. Live check: Best Man (Alex Cummings), Maid Of Honour (Grace Adams), Groomsman ×4 (Henry Paveley, Samuel Thompson, Jamie Bulteel, Alex Godliman), Bridesmaid ×2 (Maddy Wilkinson, Luella Williamson). The Godliman duplicate is gone. Tags are stored capitalised with spaces, so **B1 below still applies** (code expects `best_man`, `groomsman`, …).

**Not yet answered — I'm proceeding with these defaults; tell me if any is wrong**
- **D2.** Plain wedding party see Diary events read-only.
- **D4.** Errors: in-app `error_log` + admin panel (no third party).
- **D5.** Anyone who can see an item can 👍/👎/comment on it (couple, family, wedding party for their own boards; not plain guests).
- **D8.** View-as uses real-user session swap, read-only by default, audited, with persona test accounts.
- **D9 (new).** Can the couple see the stag/hen budgets? Default: **yes** (couple always has access) but they are **excluded from the wedding budget totals**.
- **D10 (new).** Can ordinary bridesmaids/groomsmen see their project's costs, or only the project admins (MoH/BM)? Default: **admins only** see/edit costs; other members see ideas, options, tasks and can vote/comment.

**Design consequences of these answers (the big ones)**
1. **A new permission axis: cost visibility.** Today `data_access` hides whole option rows; it can't show a venue while hiding its price. Costs currently sit in the same rows (`page_options` cost columns, `category_costs`, `option_cost_items`, `cost_item_links`). RLS works per row, not per column, so real security needs the costs **separated into their own table(s)** with their own policies, plus a `cost_access` flag on `page_permissions` (per page, per role or tag, so the couple can toggle it per category in Roles & Access). `cost_access = true` implies cost edit rights. See 0.2/0.6.
2. **Project-scoped administration.** The stag and hen boards need a "project admin" notion: best man administers groomsmen, MoH bridesmaids, with delete + cost rights limited to that project's rows. See 0.7.
3. **Only two categories exist today (food, venue)** so the default can be safe-by-default: every new category starts with costs hidden from non-couple tags unless the couple turns them on.

## 1. Audit — what I found

I read the sign-in flow, role/permission code, RLS migrations (0001–0029) and the live data (read-only, service role).

### Blockers (each one means best man / maid of honour would hit a broken site today)

| # | Finding | Evidence | Effect |
|---|---|---|---|
| B1 | **Tag names don't match.** Live tags are `Best Man` / `Maid Of Honour`; every permission row, nav rule and SQL function looks for `best_man` / `maid_of_honour` (exact match). | Live `contacts.tags`; `fn_has_visible_tag`, `page_permissions` seeds, `AppShell.NAV_LINKS` | The whole best-man/MoH elevation built in 0027/0028 matches **nobody**. They'd be treated as plain wedding party. |
| B2 | **Database rules block them even when the app allows them.** `category_pages`, `category_costs`, `category_contacts`, `diary_entries`, `page_options`, `cost_item_links`, `option_cost_items` all read via `is_family_or_above()` (couple + family only). Best man/MoH have role `wedding_party`. | `0001_init.sql:250-266`, `0028` | Venues, dates, contacts, costs, diary come back **empty** for them, even after B1 is fixed. App-side permissions say yes; RLS (the real security) says no. |
| B3 | **Writes are couple-only on category data.** "manage page options" on category-linked groups is `is_couple()`. | `0028` | "Add things" on Categories fails for them. Only `/project` boards (wedding-party writable) work. |
| B4 | **Plain wedding-party members land on `/no-access` after sign-in.** `HOME_FOR_ROLE.wedding_party = "/categories"`, but plain wedding party have `page_access = false` there. | `role-types.ts`, 0027 seeds | First-ever login for 5 of the 7 wedding party ends on an error page. |
| B5 | **Photo uploads are broken right now.** Drive OAuth token returns `invalid_grant` (I patched *viewing* photos; uploads still need a valid token). | Earlier fix, `/api/upload` | They can't add to moodboards. Will recur weekly until the Google consent screen is moved out of "Testing". |
| B6 | **Sign-in email delivery is unverified at scale.** Sign-in is a Supabase email code. Supabase's built-in email sender is heavily rate-limited (a handful per hour, project-wide). Resend is wired for Comms only, not auth emails. | `SignInFields.tsx`, `lib/email/resend.ts` | Invite the whole wedding party in one evening and codes will silently not arrive. This is the most likely "can't log in" report. |

### Risks / smaller issues
- **No one but the couple has ever signed in.** 3 auth users (Nick, Ellie, and one more); 0 wedding-party/family/guest accounts. Every non-couple path is untested by a real person.
- **Duplicate email:** "Alex Godliman" exists as both wedding_party and guest (flagged "needs review — duplicate email"). The profile-sync trigger matches by email, so which role they get is arbitrary.
- **5 wedding party have no gender tag** (Henry, Jamie, Alex G., Luella, Maddy). Bridesmaids/groomsmen pages can't route them until tagged. Needs your input.
- **No unique constraint on `lower(email)`** for top-level contacts, so duplicates can recur.
- **Diary:** plain wedding party have page access to Diary, but `diary_entries` RLS is family+, so it renders empty.
- **No reactions/comments exist** anywhere in the schema or UI (new build).
- **No admin visibility of accounts:** `/guests` has no "has account / last sign-in" column; no password reset; no view-as; errors only visible in Vercel logs.

### Not verified
I have not signed in as a non-couple user (would need a test account — Phase 4 creates those). Everything above is from reading code/migrations and live data, so it's strong evidence but not a click-through.

---

## 2. Plan

Order matters: **Phase 0 first** (nothing else is testable until best man/MoH can actually see data). Phases 1 and 2 are independent and can be built in parallel after Phase 0. Phase 3 depends on 2. Phase 4 runs alongside, and gates each rollout stage.

Model guidance: **[Fable]** = security-critical or design-heavy, do once and carefully. **[Cheaper]** = mechanical once the pattern exists; Sonnet is fine. Every migration is a new numbered file (0030+), never edited after push; I never apply them, you run them in the Supabase SQL editor in order. Standing rules still apply: clean `rm -rf .next` build before each commit, ask before pushing (except live-breaking fixes).

### Phase 0 — Make best man / MoH actually work (blockers B1–B6)

0.1 **Canonical tags** [Cheaper]
- Migration 0030: normalise existing tags (`lower`, spaces/hyphens → `_`): `Best Man`→`best_man`, `Maid Of Honour`→`maid_of_honour`.
- Normalise on write in `guests/actions.ts` (`tagsToArray`) and the account/gendered actions.
- Replace free-text tags in the guest editor with a tag picker: fixed role tags (`best_man`, `maid_of_honour`, `bridesmaid`, `groomsman`) plus free-form others, shown with friendly labels.
- Add partial unique index on `lower(email)` where `parent_contact_id is null`; resolve the Alex Godliman duplicate first.
- You: tell me who is a bridesmaid vs groomsman.

0.6 **Separate costs from options, add `cost_access`** [Fable — security-critical; must ship BEFORE 0.2]
- Why first: opening category rows to best man/MoH (0.2) would otherwise expose every price, because prices live in the same rows as venue names.
- Migration: new table(s) holding cost fields (e.g. `option_costs`: predicted min/max, actual, currency, keyed to `page_options`), backfilled from the existing columns, with the old columns dropped in a follow-up migration once the app reads the new table. Same treatment for `category_costs` visibility, `option_cost_items`, `cost_item_links`.
- `page_permissions` gets a 4th boolean `cost_access` (migration 0030+, new file). Resolver (`getEffectivePermission`) returns it; `fn_cost_access(page_key)` security-definer helper for RLS. Tag beats role; deny wins among tags (existing rule).
- Default is **safe**: cost_access false for every non-couple principal on every category (including future ones); couple opts in per category/principal in Roles & Access (new 4th checkbox).
- App changes to read costs from the new place: `OptionCard`, `CostItemsPanel`, `CostForm`, category page header totals, `budget` page, `selectWinner`/`markOptionWinner` rollup, `computeOptionTotals`. When `cost_access` is false the UI hides cost sections entirely (no blank gaps) and the budget link is hidden.
- `cost_access = true` also grants cost **edit** where the principal has category edit (D1).

0.2 **RLS for elevated party members** [Fable — security-critical]
- New `security definer` helper `fn_is_party_elevated()` (role `wedding_party` AND tag in best_man/maid_of_honour; no table self-reference, per the 0029 lesson).
- Extend **read** policies on the seven tables in B2 to `is_family_or_above() or fn_is_party_elevated()`, keeping the existing `data_access` and `visible_tag` checks so the gendered pages stay private. Cost tables use `fn_cost_access` (0.6), not this helper.
- **Writes (D1):** elevated members may INSERT/UPDATE `page_options`, option images, `category_dates`/diary entries and `category_contacts` on category pages. **No DELETE of categories** (and none of other people's rows unless they own the row). Cost edits only where `cost_access` is true.
- Plain wedding party: read `diary_entries` only (D2).
- Deliverable includes RLS negative tests (see Phase 4): bridesmaid can't read groomsmen board; plain party can't read costs; best man can't read venue/food costs by default; couple switching cost_access on for one category exposes only that category; guest can't read anything planning.

0.7 **Stag / hen project administration** [Fable for RLS, Cheaper for UI]
- Treat the existing gendered boards (`visible_tag` = `groomsman` / `bridesmaid`) as two **projects**. Project admin = best man for groomsmen, MoH for bridesmaids (extend `fn_has_visible_tag`-style helper: `fn_is_project_admin(visible_tag)`).
- Project admins get **full CRUD, including delete and costs**, on everything carrying their `visible_tag`: ideas, tasks, option groups, options, expenses/budget lines. Other members of that tag can add ideas/options/tasks and vote/comment, and see costs only if D10 says so.
- **Separate project budget** per project (expenses/costs tagged with the project's `visible_tag`), shown on the gendered page, **excluded from the main wedding budget totals**; couple can view all (D9).
- Needs a `visible_tag` column on `expenses`/`expense_splits` (or a small `projects` table) — Fable to pick the simpler of the two.

0.3 **Sign-in lands in the right place** [Cheaper]
- Replace static `HOME_FOR_ROLE` use with a server `homeFor(profile, tags)`: couple `/guests`; best man/MoH `/project`; plain wedding party `/diary` (or `/account` on first login); family `/categories`; guest `/account`. `/hub` and `SignInFields` use it.
- Tighten `/no-access` copy so a wrong-permission landing is a clear message with a "go to your page" button.

0.4 **Reliable email sign-in** [Cheaper, plus your Supabase/Resend settings]
- Configure Supabase Auth → custom SMTP using Resend (your verified sending domain); raise the email rate limit; confirm the template shows the **code** (not a link) and set a sensible expiry.
- Deliverability test to Gmail, Outlook, iCloud, and a work address; record results in this doc.
- Add a fallback path: "I'm having trouble" → couple can send an invite (Phase 1) or set a temp password.
- Keep the guest-list gate in `/api/auth/request-code`; add a friendlier message when an email has no contact.

0.5 **Drive upload reliability** [Cheaper, plus your Google Cloud step]
- You: reconnect via `/api/google/oauth/start`, update `GOOGLE_OAUTH_REFRESH_TOKEN` in Vercel, move the OAuth consent screen to "In production".
- Code: admin banner/health check that shows "Drive connected / needs reconnecting" so this never fails silently again; per-user upload rate limit on `/api/upload`.

**Exit test for Phase 0:** a test account tagged `best_man` signs in with an emailed code, lands on `/project`, sees Categories → Venue with options, dates and contacts, adds an option with a photo, sees the Groomsmen board but not Bridesmaids, can't see Budget costs if you choose that (D3).

### Phase 1 — Admin: accounts, resets, view-as, errors

1.0 **Accounts are GIVEN, not self-created** (Nick, 14 Nov) [Cheaper; sign-in change reviewed by Fable]
- Today an account only appears when someone signs in with an email on the guest list (a database trigger creates it), and only family/wedding-party/couple have been through that. No ordinary guest contact is linked to an account.
- New model: the couple **provisions** an account from the CRM for any contact with an email ("Create account", plus a bulk "Create accounts for selected"). It creates the sign-in user via the admin API, links it to the contact, sets the role from the contact, and optionally sends the invite email. The contact row shows its account status.
- Sign-in then only works for provisioned accounts (`signInWithOtp` with `shouldCreateUser: false`, and `/api/auth/request-code` checks for an account, not just a contact), so being on the guest list alone never creates access.
- Role/tag changes on a contact keep syncing to their profile (existing `sync_profile_from_contact` trigger).

1.1 **Account status in the CRM** [Cheaper after the helper exists]
- Server-only helper (service role) joins `contacts` ↔ `profiles` ↔ `auth.users`: status = No account / Account (never signed in) / Active, plus last sign-in. New column + filter on `/guests`.
- Couple-only server actions, each written to a new `admin_audit` table (who/what/when):
  - **Send invite** — Resend email with the site link + instructions for the code sign-in.
  - **Reset password** — clear the password (back to code sign-in) or send recovery email; show the result clearly.
  - **Sign out everywhere** and **disable account**.
- Never display or log a password/code.

1.2 **View-as** [Fable — security-critical]
- Recommended design: **real-user session swap**, because RLS keys off `auth.uid()`, so only a real session shows exactly what that person sees. A cookie-only "pretend role" would still show *your* data and mislead you.
  - Create 5 **persona test accounts** (best_man, maid_of_honour, plain wedding party, family, guest), clearly flagged `is_test`, hidden from CRM counts/comms/RSVP totals.
  - "View as…" (couple-only) mints a session for the chosen persona **or a real user**, stores your own session in a separate httpOnly cookie, shows a persistent banner with "Exit".
  - **Read-only by default** (middleware blocks non-GET and server-action POSTs while impersonating) with an explicit "allow edits on test personas only" switch, so you can't accidentally edit as a real guest.
  - Every start/stop goes to `admin_audit`.
- Cheaper companion that needs no impersonation: an **Access Explorer** table (pages × personas showing page / data / edit) computed from `getEffectivePermission`, to spot gaps quickly. [Cheaper]

1.3 **Seeing errors** [Cheaper]
- `error_log` table written by `error.tsx`/`global-error.tsx` and key server-action catch blocks (route, role, message, digest; no personal data), plus an admin "Recent errors" panel. Alternative: Sentry (decision D4).

### Phase 2 — Collaboration: 👍 / 👎 / comments

2.1 **Schema + RLS** [Fable]
- `reactions(id, target_type, target_id, profile_id, value smallint check (value in (1,-1)), created_at, unique(target_type, target_id, profile_id))` — one vote per person per item; clicking again toggles off.
- `comments(id, target_type, target_id, profile_id, body, created_at, edited_at, deleted_at)`; soft delete.
- `target_type` ∈ `page_option`, `idea`, `task` (others later). `security definer` function `fn_can_see_target(type, id)` reuses the existing visibility rules (`fn_option_group_visible`, idea `tier`/`visible_tag`, data_access), so comments/votes on the groomsmen board stay invisible to bridesmaids.
- Policies: select = can see target; insert = can see target and `profile_id = auth.uid()` and role isn't `guest` (D5); update/delete own, couple can delete any.
- Aggregates via a view/RPC so cards don't fetch every row.

2.2 **UI** [Cheaper once 2.1 is merged]
- `ReactionBar` (👍 count, 👎 count, your vote highlighted, optimistic update, hover/tap shows who voted) and `CommentThread` (collapsed count → expands, add, edit/delete own, relative time, author name from profile).
- Mount on: option cards (venues, outfits and every category/project option), idea tiles (open to a detail sheet), and tasks. Keep it compact on the 2-column option grid.
- Optional "sort by votes" on option groups.
- Motion/spacing follow the existing card language; mobile-first.

2.3 **Notifications** [Cheaper, optional] — a daily digest email to the couple of new comments/votes (Resend), instead of per-comment email.

### Phase 3 — Wider contribution to moodboards (D6: no approval)

- **Who adds to what:** main moodboards (`/project/ideas` and category boards): family, best man, MoH (plus the couple). Stag/hen moodboards: bridesmaids/groomsmen add to their own project's board only, managed by MoH/BM (0.7). Plain guests cannot add.
- Currently the idea board is read-only and ideas are created on `/project`, gated to wedding party/couple; family has read only. Needed: an "Add to board" entry on the board itself, family INSERT on `idea_boards`/`idea_board_images` (tier `wedding_party`, no `visible_tag`), tag-scoped INSERT for gendered boards (already partly in 0028, verify). Authors can edit/delete their **own** items; couple can delete anything; project admins can delete within their project.
- No moderation queue, so guard against abuse differently: per-user upload rate limit and daily quota, 8MB cap (exists), allow-list types, strip EXIF location, Drive storage watch, and an audit trail of who added what (`created_by` on ideas/images). [Fable for RLS review; Cheaper for UI]

### Phase 4 — QA and staged rollout (runs throughout)

- **Test personas** from 1.2 and a Playwright/browser script per persona: sign in (code via a test mailbox or admin-generated code), landing page, every nav link, each page loads without error, add idea + photo, vote, comment, then **negative checks** (expect redirect/empty): other tags' boards, budget, guests, access, comms. [Cheaper to write, Fable to review the matrix]
- **RLS negative tests** run directly against Postgres with each persona's JWT (not just via the UI) so a UI change can't hide a data leak. [Fable]
- **Rollout order:** (1) Alex Cummings + Grace Adams only, with you watching the error panel for a week; (2) rest of wedding party; (3) family; (4) guests/third parties. Don't advance until the previous stage's exit tests pass.
- Short "how to sign in" note for them (one screen, includes what to do if the code doesn't arrive).

---

## 3. Original decision list (superseded — see section 0 for the current answers/defaults)

- **D1.** What can best man / MoH **write** on Categories? Suggested: add options, photos, dates, contacts and notes; **not** delete categories or edit actual costs. Alternative: read + comment only on Categories, full edit only on their own boards.
- **D2.** Should plain wedding party see Diary events (dates/venues of events they're attending)? Suggested: yes, read-only.
- **D3.** Should best man / MoH see **cost** figures on Budget and in option cost breakdowns, or only venues/dates? (Currently the seeds say yes to everything.)
- **D4.** Error visibility: simple in-app `error_log` panel (free, private) or Sentry (more detail, third party)?
- **D5.** Who can vote/comment: wedding party + family + couple (suggested), or also guests?
- **D6.** Third parties adding to moodboards: who exactly (wedding party only / family / all invited guests) and with approval (suggested) or open?
- **D7.** Gender tags for Henry Paveley, Jamie Bulteel, Alex Godliman, Luella Williamson, Maddy Wilkinson (bridesmaid / groomsman), and which Alex Godliman record is the real one.
- **D8.** Impersonation: OK with real-user session swap (read-only by default, audited), or persona test accounts only?

## 4. Suggested handoff
1. **Fable**, in this order, one migration at a time, reviewed before moving on: **0.6 (cost separation + `cost_access`) → 0.2 (elevated-party RLS) → 0.7 (stag/hen project admin) →** 1.2 (view-as) → 2.1 (votes/comments schema/RLS) → Phase 3 RLS review → RLS negative tests. Do not open category data to best man/MoH (0.2) until 0.6 is live, or prices leak.
2. **Cheaper model**: 0.1, 0.3, 0.4 code, 0.5 code, 1.1, 1.3, 2.2, 2.3, Phase 4 browser scripts — following the patterns Fable leaves behind (security-definer helpers, audit-log writer, `homeFor`).
3. **You** (manual): Supabase SMTP + rate limit, Google Drive reconnect + consent screen, run each migration, answer D1–D8.
