# Nick & Ellie — Design Brief
28.11.26 · visual identity & interaction system for the wedding platform

## 1. The brief
A private, role-gated wedding hub covering planning (couple, family, wedding party) and guest experience (RSVP, gifting, live agenda), installable as a PWA. It currently wears a placeholder design system chosen only to prove the build works — cream/ivory, a stock serif+script pairing, a procedurally generated botanical corner accent. The brief is to replace that placeholder with a highly stylised, fluid, next-generation design system: something that feels considered and singular, not templated.

## 2. What exists now (current state, to be superseded)
- **Palette:** cream `#faf6ef` background, charcoal ink `#2b2620` text, muted gold `#b08d57` accent
- **Type:** Cormorant Garamond (serif) + Parisienne (script) — a stock "elegant wedding" pairing
- **Motif:** a single procedurally generated fine-line peony SVG, static, used identically as a corner accent everywhere
- **Motion:** one fade/slide hero reveal on the landing page only — no scroll choreography, no micro-interaction language
- **Registers:** none — the romantic guest-facing pages and the dense operational pages (budget tables, expense splitting, task lists) currently share one flat, utilitarian visual treatment

## 3. The mandate
Six specific problems this redesign needs to solve — not generic mood-board language.

**One identity, two registers.** Guest-facing surfaces (landing, RSVP, gifting) are ceremonial and warm; planning surfaces (budget, tasks, guest CRM) are dense and operational. They need to feel like the same product, not two different apps stitched together — unified by shared type, color, and motion language even as density and tone shift.

**Decisions as choreography.** Options mode — comparing two or more venues/suppliers side-by-side and selecting a winner — is the product's signature interaction, reused across category pages and Project Management. It deserves a deliberate ritual: weight, motion, a sense of commitment when a winner is chosen. Not a generic radio-button list.

**The diary is alive.** Diary entries are never typed directly most of the time — they arrive as a side effect of a decision made elsewhere (a category date, a selected option). The timeline should visually register provenance — "this showed up because of that" — not read as a flat static list.

**Botanical system, not botanical sticker.** Replace the single static placeholder SVG with a proper generative/parametric line-art system — a living motif that can vary by placement and context, not clip art copy-pasted into every corner.

**Fluid under pressure.** This is an installable PWA meant to run on phones over patchy venue wifi during the wedding week itself. Motion and visual richness can never cost perceived load speed — skeleton and optimistic states, not spinners; every interaction has to feel instant even on a bad connection.

**Legible across the guest list.** The guest list spans every age and every level of tech comfort. Stylistic ambition is welcome; illegibility, fiddly tap targets, and motion-only affordances are not. Bold and accessible are not in tension here — they're both required.

## 4. Surface area to design
| Route | Who sees it | Status | Register |
|---|---|---|---|
| `/` Landing | Everyone | Built | Ceremonial |
| `/login`, `/account` | Everyone | Built | Utility |
| `/rsvp/[token]` | Guest (per-invite link) | Built | Ceremonial |
| `/categories`, `/categories/[slug]` | Couple, Family | Built | Mixed — content is ceremonial (mood board, pending), controls are operational |
| Options mode (on category pages + Project Management) | Couple, Family / Couple, Wedding Party | Built | Signature interaction — see mandate |
| `/budget` | Couple | Built | Operational |
| `/diary` | Couple, Family | Built | Mixed — see "diary is alive" |
| `/project`, `/project/expenses` | Couple, Wedding Party | Built | Operational |
| `/guests` (CRM) | Couple | Built | Operational |
| Gifting (idea board + contribution page) | Guests | Not built | Ceremonial |
| Mood boards (image boards on category pages) | Couple, Family | Not built — needs OneDrive | Ceremonial |
| Live Week Agenda + push notifications | Guests | Not built — needs OneSignal | Ceremonial, offline-first |
| Media gallery | Role-scoped | Not built — needs OneDrive/Azure | Ceremonial |

## 5. Deliverables expected from the design pass
- **Token system** — color, type scale, spacing, radii, motion (durations/easing per interaction class)
- **Component library** — buttons, inputs, cards, data tables, nav, the Options-mode comparison UI, modals/sheets
- **Botanical asset system** — parametric line-art, not a fixed SVG file
- **Motion spec** — page transitions, scroll-triggered reveals, micro-interactions, the "decision" ritual for Options mode
- **Responsive behaviour** — mobile-first; this is used one-handed at a venue as often as at a desk
- **Accessibility bar** — contrast, tap targets, motion-reduced fallback (`prefers-reduced-motion`), never state-by-color-alone

## 6. Constraints
- **Stack:** Next.js (App Router) + Tailwind + Framer Motion, Supabase (Postgres/Auth/RLS) — the system needs to be implementable as React components on this stack, not a static mockup
- **Hosting:** Vercel, custom domain `weddingsweddings.co.uk`
- **Performance:** PWA, installable, expected to be used on patchy wifi during the wedding week — perceived speed is a hard constraint, not a nice-to-have
- **No dark mode requirement** — this is a single-occasion, single-mood product; a deliberate one-theme commitment is fine if made explicitly, rather than an afterthought

## 7. Not in scope yet
Gifting, mood boards, live agenda, and the media gallery aren't built. The design system should anticipate their visual slots (they'll inherit the same tokens/components) without the design pass needing to fully resolve them now.
