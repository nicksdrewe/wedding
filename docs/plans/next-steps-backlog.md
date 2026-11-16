# Next steps backlog (noted 16 Nov 2026)

Captured from Nick's message. Nothing here is started. Each item says what it needs, what it touches, a suggested model, and the questions to settle first. The suggested order is at the bottom.

Conventions that still apply to all of it: new numbered migration files only (never edit a pushed one; Nick runs them); `rm -rf .next && npm run build` before every commit; ask before pushing; add RLS tests under `supabase/tests` for any access change; the existing test suites (`supabase/tests/README.md`, `tests/`) must still pass.

---

## 1. Nested categories (any depth, shown as a tree) — DONE (migration 0042; lib/categories)

**Ask:** categories can nest to any depth (L1 Catering → L2.1 Food / L2.2 Drink → L2.1.1 Friday breakfast → L2.1.1.x Boulangerie…). A leaf is where options live and where one is chosen as the winner. A parent can have several chosen routes, whose costs become actuals. Must also work for stag, hen and outfits (stag → locations → housing, etc.). Shown on the Categories page like a family tree / org chart.

**Touches:** `category_pages` (add a parent), `option_groups` (one per leaf, already one per category), the Categories page and detail page, Budget, the page registry and permissions (`page_registry.parent_page_key` already supports parents), linked cost items, Project comparisons, diary entries created by winners, and view/URL structure (`/categories/[slug]` → needs a path or id).

**Design points to settle (decisions needed):**
- Are sibling nodes **additive** ("we need food AND drink") or **alternatives** ("choose one of these three venues-routes")? Suggest a per-node mode: *all of these* vs *choose one*. Roll-ups depend on it.
- What "selected" means on a parent: all chosen leaves beneath it count; unchosen options do not.
- Permissions: should hiding costs / access on a parent cascade to its children? (Suggest yes, inherited, overridable per node.)
- Existing flat categories (food, venue) become top-level nodes; no data loss.

**Suggested model:** Fable (data model, roll-up logic, permission inheritance, RLS). UI afterwards on Sonnet.

## 2. Predicted values computed, not typed — DONE (lib/categories/tree.ts; the typed cost form is gone, old typed figures are used only while a category has no priced options)

**Ask:** categories have no predicted figure of their own; it is calculated from what's nested under them. Example: Venue's predicted cost ranges from the cheapest option to the most expensive option in it.

**Rule to implement (depends on #1):**
- Leaf with no winner: range = lowest option low → highest option high (net of that option's income lines, as `computeOptionTotals` does).
- Leaf with a winner: the winner's real figures (actual where entered).
- Parent: sum of its children (additive) or the single chosen child (choose-one mode).
- Budget page sums the top-level nodes; per-category "Costs" form for typing a headline figure is removed (the `category_costs` table becomes a derived view or is recomputed by function — never hand-edited).
- Keep currency conversion at the aggregate level (as now) and respect `cost_access`.

**Suggested model:** Fable together with #1 (same migration design).

## 3. Planning category content is off-centre on desktop (quick win)

Likely cause: the category detail page wraps its content in `max-w-3xl` without centring it (`src/app/(family)/categories/[slug]/page.tsx`, outer `<div className="max-w-3xl">`). Check the other planning pages for the same pattern and give them a consistent centred container. **Sonnet, small.**

## 4. Mobile menu too big → burger menu (quick win)

The mobile bottom tab bar in `src/components/AppShell.tsx` now carries too many links. Replace with a compact top bar and a burger menu that opens a full-screen / slide-in panel, grouped like the desktop dropdowns (Planning, People, Comms…). Keep tap targets ≥ 44px, close on navigation, and keep the role label, account and sign-out in the panel. **Sonnet.**

## 5. "Organising comms" (a log of things done and said while organising) — DONE (migration 0043; /organising; diary timeline rebuilt)

**Ask:** a new page for family and best man / maid of honour (and the couple) to paste in or log: emails from a venue, caterer, photographer; or a quick "committed an update". Then:
- **A)** shows as a list on a Comms-section page, each entry tagged to a category or specific option (e.g. venue; the Boulangerie option under Friday breakfast);
- **B)** each planning option has a button that jumps to that page filtered to its entries;
- **C)** entries feed the diary timeline automatically in short form ("Email received from X" / "Email sent to X"), linking back to the entry.

**Naming/nav:** current "Comms" becomes **"Guest Comms"**; the new page is **"Organising comms"**; both sit under a **Comms dropdown** in the nav (guest side stays couple-only).

**Touches:** new table(s) (entry: kind sent/received/note, counterparty, subject, body, date, tagged target = category or option, author), RLS (visible to couple, family, best man, maid of honour; follow the target's visibility so a stag-board entry isn't seen by the wrong people; authors edit/delete their own, couple can delete any), diary integration (`diary_entries` gets a source of "comms" + a link), a deep link/filter on option cards, nav changes, retention.

**Decisions needed:** can plain wedding party read it? (Brief says no.) Do groomsmen/bridesmaids see entries tagged to their own board? Can attachments (PDFs/screenshots) be added, or text only for now? Pasted emails may contain personal data of third parties, so keep it to the people named and let the couple delete anything.

**Suggested model:** Fable for the table + RLS + diary link; Sonnet for screens.

## 6. Project Management: collapsible comparisons with thumbnails — DONE

Each comparison group on `/project` (and the stag/hen pages) collapses to save space, and every option row shows its cover thumbnail beside the title. Reuse `OptionsCompareGroup`; thumbnails come from `page_option_images` (first by sort order). Remember the Drive image proxy (`toDriveImageUrl`). **Sonnet.**

## 7. Idea board as a bold animated portal button — DONE (own idea pages at /project/groomsmen/ideas and /project/bridesmaids/ideas)

On Project (and the Groomsmen and Bridesmaids pages) replace the inline idea list with one bold, fun, animated "portal" button linking to that board's ideas page, using a few of the ideas' thumbnails as the button graphic. The groomsmen/bridesmaids pages need their own ideas page (today only the main board has `/project/ideas`; those two list ideas inline). Respect `prefers-reduced-motion`; keep the thumbnails cheap to load. **Sonnet** (design direction from #10 first if possible).

## 8. Tasks as a mini kanban/priority board — DONE (needs migration 0041)

**Ask:** tasks (Project, and the groomsmen/bridesmaids pages) get a creation date, due date, a done date, and a priority flag from optional → not urgent → … → urgent; filter by urgency and by assignee; and the tasks section looks distinct (own background, 3D lift, animated corners).

**Touches:** `tasks` table gets `priority` and `done_at` (creation date already exists as `created_at`); update `toggleTask` to stamp/clear `done_at`; filters in the UI; new visual treatment. Votes/comments (0037) already attach to tasks. **Schema + actions: Sonnet is fine (small). Visual treatment: with #10.**

## 9. THE BIG DAY page (flexible multi-day planner) — DONE for the wedding party (migration 0044; /big-day). Still to do: the guest-facing published view.

**Ask:** a diary-style page with a sidebar of draggable items, and day columns for however many days are chosen (Friday–Monday, or a whole week). Items can be: a selected planning option (cost moves across with it), an idea, or a custom trigger/event. Each is colour-coded, titled, has start/end, and a thumbnail (inherited from the option/idea, or added). Everyone with back-end rights can see it. Examples: the boys' cycle at 8am; evening snacks from the ideas board; the winning photographer's on-duty hours.

**Touches:** new tables (day settings: first/last date; scheduled items: title, start, end, colour, thumbnail, optional link to an option/idea and whether it's a custom entry), a calendar/drag-and-drop UI (drag-and-drop approach to choose; must also work by tap on phones: tap an item, pick day/time), permissions (back-end rights = couple, family, best man/MoH; deciding who may edit vs only view), and a rule for what "costs move across" means (suggest: the scheduled item is a *view* of the option; the option's cost stays in its own tree and the schedule just reflects it).

**Decisions needed:** who can edit the schedule; whether guests ever see a trimmed "day of" view (later); time granularity (15 min?); clash warnings.

**Suggested model:** Fable for the design and data model; Sonnet for the UI once the model is fixed.

## 10. Whole-site visual overhaul ("whisp through wedding Disney")

**Ask:** the back-end pages look flat. Treat it as a top-end designer's pass: depth, layers, separated sections, movement, colour, contrast, flow — full 2027-ready.

**How to do it safely (it is large):**
1. A **design direction pass first** (palette extension, depth/elevation system, motion language, type scale, section styles, background treatments), built once as shared tokens/components so every page inherits it.
2. Roll it out **in slices**, page group by page group, each pushed separately so nothing breaks at once: shell/nav → Categories → Project → Guests → Budget → Diary → the rest.
3. **Constraints that must stay true** (from `docs/design-brief.md`): phone-first and fast on poor wifi, `prefers-reduced-motion` respected, legible for every age, no motion-only affordances, keep contrast. Animations should be CSS/transform-based, not heavy JS. The public landing and gifts pages already set the tone (dark green, botanicals, slow drift) and should be the reference.
4. Because new pages (#5, #8, #9) should be built in the new style rather than restyled twice, do the **design foundation before building them**.

**Decisions needed:** how far from the current cream/green identity to go; whether to keep the botanical line-art motif as the signature; how much motion is too much for the planning screens people use for long sessions.

**Suggested model:** Fable for the direction and foundation, Sonnet for page-by-page rollout.

---

## Suggested order

1. **Quick wins first (small, no schema):** #3 centring, #4 burger menu. *(Sonnet)*
2. **Design foundation (#10, part 1)** so everything after is built in the new look. *(Fable, then Sonnet)*
3. **Nested categories + computed predicted values (#1 + #2).** The biggest model change; #5, #6 and #9 all lean on it. *(Fable)*
4. **Tasks board (#8), Project collapsible comparisons + thumbnails (#6), idea-board portal buttons (#7).** *(Sonnet)*
5. **Organising comms (#5).** *(Fable for DB, Sonnet for UI)*
6. **THE BIG DAY (#9).** Last, because it draws on categories, options, ideas and the visual system. *(Fable then Sonnet)*
7. **Visual rollout to the remaining pages (#10, part 2)**, continuing in slices.

## Decisions (Nick, 15 Nov 2026) — these replace the open questions

1. **Nested categories roll up as ranges.** Sibling categories are *additive* (Food = breakfast + lunch + dinner). Each leaf is a *range* from its cheapest option to its dearest. A parent's range = sum of its children's lows → sum of its highs. A flat category (e.g. Venue with options directly under it) is just the range of its options. Once a winner is chosen at a leaf, that leaf uses the winner's real figure. No "choose one" node mode needed for now. (Permission cascade to children: still suggested as inherit + override.)
2. **Organising comms** is for best man, maid of honour, family and the couple only. Not plain wedding party, not groomsmen/bridesmaids, not guests.
3. **Big Day schedule:** editable by best man, maid of honour, family and the couple; *visible* to all wedding party. Later it becomes publishable: each item has a "visible to guests" tick, and a signed-out/guest visitor sees only ticked items. Design the item table with a `visible_to_guests` flag from day one.
4. **Visual overhaul: all the way.** The current site is the foundation, not the destination. Priority one is still speed and ease of use (UX first, very fast, very obvious); the visuals should make people think "wow, I'm excited to be here" — premium-agency depth, animation, layered storytelling linking pages. Do the design foundation first and build every new page in it.

## Timeline design notes (Nick, 16 Nov 2026) — applies to the diary timeline, Organising comms (#5) and the Big Day (#9) feed

Three reference images were shared. Use them for **structure only**, not for colours or theme: the site's new visual identity (design foundation) will decide the look, and the timeline inherits it.

- **Backbone (image 1, the WordPress timeline):** a vertical spine with cards alternating left and right, a small node on the spine per entry, date under each title, a short excerpt with "[…]" truncation. Entries can be flagged **featured**, which makes the card span the full width across the spine, centred, larger title. Build it this way.
- **Importance drives size and colour:** a real event (engagement party, tasting, venue visit) is a **big, coloured, featured** card; a routine log (email sent to a vendor, "update committed") is **small, grey, short text** on one side. Suggested three tiers: *milestone* (full-width, colour, image), *standard* (half-width, normal), *minor* (compact, grey, one line). Each entry stores an `importance` field; auto entries from comms default to *minor*, couple/family can promote one.
- **Optional flourishes (images 2 and 3), use sparingly:** a numbered or dated tag on the spine node; a line-icon per entry kind (email, call, venue, payment) beside the card; a ribbon-style date tab on milestones; colour keyed to category. These are ideas to try once the visual foundation exists, not requirements.
- Phone: collapse to a single column down the left spine; featured cards stay full-width.
- Keep it fast: render in pages by date (load more), no heavy JS.
