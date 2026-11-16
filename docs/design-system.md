# Design system — "The Walled Garden"

The written half of the design foundation (backlog #10, part 1). The living half is the style guide at **`/design`** (couple-only on the real site; opens without sign-in under `npm run dev`). All tokens and classes live in `src/app/globals.css`.

Order of priority, always: **fast → obvious → beautiful.** Nothing here may slow a page, hide a control, or make text harder to read.

## The idea

The site is a walled garden. The public pages (landing, gifts) are the garden at night: deep green, stems, slow light. The signed-in pages are inside, in daylight: warm paper surfaces floating over soft drifting light. Every signed-in page **opens with the canopy** — a band of that same night garden — so each page starts in the story and steps into the work.

Each part of the site has its own **bloom colour**. Moving between parts changes the light behind the page, the canopy's glow, focus rings and accents. That is the "linked storytelling": same garden, different bed.

| Part (`data-section`) | Pages | Bloom |
|---|---|---|
| `planning` (default) | Categories, Project, ideas, account | Moss green |
| `people` | Guests, Roles & Access, Errors | Rose |
| `money` | Budget, Expenses | Gold |
| `diary` | Diary, events, (Big Day) | Dusk blue |
| `comms` | Guest Comms, Organising comms | Lagoon teal |
| `party` | Groomsmen, Bridesmaids boards | Plum |

The mapping is `src/lib/design/sections.ts`; `AppShell` sets `data-section` from the URL. Add new pages there.

## Tokens

- **Colour:** `night`, `forest` (dark world); `cream`, `cream-deep`, `paper` (light world); `ink`, `ink-soft` (text); `accent` (moss, fixed: "chosen/selected/success" keeps this green in every section); `alert`. Section: `sec` (text-safe on cream and paper), `sec-glow` (light and decoration only, never text on light), `sec-tint` (pale wash). As Tailwind: `text-sec`, `bg-sec-tint`, `text-sec-glow`, `bg-night`, `bg-paper`…
- **Depth:** `--shadow-1` resting · `--shadow-2` raised · `--shadow-3` lifted/hover · `--shadow-4` overlays. Forest-tinted, never grey.
- **Radius:** `--radius-sm` 10 · `-md` 14 (fields) · `-lg` 20 (cards) · `-xl` 28 (canopy, hero panels) · pills for buttons/chips.
- **Motion:** `--ease-out` for arrivals, `--ease-press` for presses; `--dur-fast` 140ms (colour, press), `--dur-base` 280ms (lift, open), `--dur-slow` 700ms (arrivals). Ambient loops are 9–40s and tiny in amplitude.
- **Type:** `font-title` (Fraunces) — page titles, section headings, big numbers, menu links; nothing smaller than ~20px. `font-serif`/UI (Archivo) — labels, buttons, tables, nav. `font-reading` (Source Serif) — sentences and notes. `font-hero` (Manrope) — landing only.

## Pieces

| Class / component | Use it for |
|---|---|
| `<PageHeader eyebrow title infoText actions>` | The canopy. Every page, once, at the top. Actions inside it use `btn btn-on-dark`. |
| `<Backdrop>` | Already in `AppShell`. Don't add another. |
| `.surface` | Default card. Add `.surface-raised` (forms, focus), `.surface-lift` (clickable), `.surface-glass` (floating bars), `.surface-tint` (highlight), `.surface-sunken` (wells, empty), `.surface-ink` (the one hero thing). |
| `.btn` + `.btn-primary` / `.btn-sec` / `.btn-quiet` / `.btn-ghost` / `.btn-danger` / `.btn-on-dark`, `.btn-sm` | All buttons and button-like links. One `btn-primary` or `btn-sec` per view. |
| `.field`, `.field-label` | Inputs, selects, textareas. |
| `.chip`, `.chip-sec`, `.chip-ink` | Tags, roles, statuses (always with words, never colour alone). |
| `.section-head` (`__title`, `__rule`) | Headings inside a page. |
| `.stat__label`, `.stat__value` | Totals and counts. |
| `.eyebrow` | Small caps label above a title. |
| `.rise` (+ `style="--i: n"`) | Arrival animation, staggered in lists. Max ~8 staggered items; no arrival animation on table rows. |
| `<EmptyState>` | Empty lists. |

## Rules for moving a page over (the rollout)

1. Replace hand-rolled cards (`rounded-[10px] border border-ink/10 bg-white`) with `surface` (+ a variant). Clickable ones get `surface-lift`.
2. Replace hand-rolled buttons (`rounded-full bg-ink …`) with `btn` classes. Keep labels as they are.
3. Inputs → `field`. Card/section titles → `font-title` at 20px+; keep small labels in Archivo.
4. Section-coloured accents use `sec`; keep `accent` (green) only for "selected / winner / success".
5. Give each page **layers**: canopy → one raised or tinted "main thing" → resting surfaces → sunken wells. Not everything at one level.
6. Motion budget per page: the canopy, one arrival stagger, hover lifts. Long working screens (guest table, budget tables) get no looping animation inside the content.
7. Tap targets ≥ 44px. Text contrast ≥ 4.5:1 (`sec-glow` and `cream/…` opacities under 60% are for decoration and dark backgrounds only).
8. CSS transforms and opacity only; no blur filters on large moving elements; no new JS animation libraries. `prefers-reduced-motion` is handled globally — don't override it.
9. Check each moved page at phone width and desktop, and as a non-couple role (View-as) before pushing.

## What is done / not done

**Done (foundation):** tokens, all classes above, backdrop, canopy header on every page that uses `PageHeader`, floating glass nav, night-garden phone menu, section colours, new `EmptyState`, style guide. Category cards on `/categories` moved over as the worked example.

**Not done (rollout, in slices):** the insides of Categories detail, Project, Guests, Budget, Diary, Comms, Access, Account, Errors still use the old flat cards, buttons and inputs. The signature "choosing a winner" moment and the timeline (see backlog timeline notes) are designed with their features.
