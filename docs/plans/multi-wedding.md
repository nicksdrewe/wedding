# Multi-wedding hub: plan

Branch: `multi-wedding`. Staging: a second Supabase project, wired to the
branch's Vercel preview. Nothing merges to `main` until the live data has been
moved over and checked.

## Decisions (agreed 2026-11-25)

- **One database, tenant column.** Every wedding-owned table gets
  `wedding_id uuid not null references weddings(id)`. Row security enforces
  "only rows of a wedding you belong to". No database per wedding.
- **One login, many weddings.** `auth.users` stays one per email. A new
  `wedding_members (wedding_id, user_id, role, contact_id)` replaces the single
  role on `profiles`: you can be the couple at one wedding and a guest at another.
- **Wedding chosen by address.** `nickellie.weddingsweddings.co.uk` → middleware
  reads the subdomain, looks up `weddings.slug`, and passes the wedding id to the
  app (request header). The apex domain is the commercial site.
- **Wildcard domain.** `*.weddingsweddings.co.uk` on Vercel, so signup needs no
  DNS change per wedding.
- **Pricing model:** one-off payment per wedding (not a subscription). Alpha:
  a signup code instead of payment.
- **Existing data becomes wedding #1** (`slug = 'nickellie'`).

## Progress

- Phase 1 database: `0056_multi_wedding.sql`. Membership is your contact on a
  wedding's guest list (`contacts.user_id`); `profiles` is now a per-wedding
  view over `accounts` + `contacts`, so existing rules work unchanged. Tests:
  all 13 existing suites pass, plus `rls_multi_wedding` (24 checks).
- Phase 1 app: middleware resolves the wedding from the address and sends
  `x-wedding-id` on every database call (server, browser, admin). Admin-client
  reads of wedding data filter by `wedding_id` explicitly.

- Phase 2: couple names everywhere, palettes + day/night, settings page at
  /wedding, private per-wedding access codes (0057).
- Phase 3: commercial site in `src/app/www` (landing one-pager, /start signup,
  /login "which wedding?"), SEO/GEO (metadata, Organization/Product/FAQPage
  schema, sitemap, robots, llms.txt, sharing image). Signup shows the price
  (`src/lib/commercial/pricing.ts`) and a code takes it to £0; no payment
  provider. `0058_signup_codes.sql`: codes table (server only), address check,
  `fn_create_wedding` (wedding + pages copied from the first wedding + the
  couple on its guest list). The new couple signs in at their address with an
  emailed code (no password set at signup). Tests: `signup_new_wedding` (22).
  - Previews: the commercial site is at `/www`. The main domain only switches
    to it when `COMMERCIAL_APEX=1` is set, which must wait until Nick & Ellie's
    site has moved to nickellie.weddingsweddings.co.uk.
  - Wedding sites now tell search engines and AI crawlers to keep out
    (`app/robots.ts`).

- Phase 4: per-wedding email. Sending (`src/lib/email/sender.ts`): guest
  emails and account invites come from the couple's names, at
  `<slug>@WEDDING_EMAIL_DOMAIN` when set (else the site-wide address), with
  replies to `<slug>@WEDDING_INBOX_DOMAIN`. Receiving: Resend inbound calls
  `/api/email/inbound` (Svix signature, `RESEND_WEBHOOK_SECRET`), which files
  the reply under that wedding (`0059_wedding_inbox.sql`, couple-only),
  matches the guest, and sends the couple a "guest_reply" notification. Inbox
  tab on /comms: read, reply from the site, mark unread, delete. Tests:
  `rls_wedding_inbox` (9). Sign-in code emails still come from Supabase's
  own mail settings (one sender for every wedding).

## Phases

1. **Foundations** (no visible change)
   - `weddings` (slug, couple names, date, palette, mode, status) and
     `wedding_members`.
   - `wedding_id` on all 41 tables; backfill to the Nick & Ellie wedding.
   - Helper `current_wedding_id()` read from the request (set per request via
     a Postgres setting from the server, never trusted from the browser alone),
     and `is_member(wedding_id)` / role helpers built on `wedding_members`.
   - Rewrite every policy to include the wedding check (about 200 policies).
     Old role helpers (`fn_resolve_permission` etc.) gain a wedding argument.
   - Middleware: subdomain → wedding; unknown subdomain → commercial site.
   - Tests: the PGlite suite gains a second wedding and checks nothing leaks
     between them.
2. **Couple branding and theming**
   - Replace hard-coded "Nick & Ellie" (26 files), date, site URL.
   - Palettes: a palette = the section colour set + glows + tints. Couples pick a
     preset and can adjust the accent. Light / dark (day vs night garden).
   - Per-wedding metadata, manifest and app name.
3. **Commercial site and signup** (apex domain)
   - Graphic landing page, one-page "how it works", signup.
   - SEO/GEO: static rendering, metadata, Open Graph images, schema.org
     (Organization, Product, FAQ), sitemap, robots, `llms.txt`.
   - Signup: couple names → suggested slug (editable, checked for availability)
     → account → alpha code → wedding created → redirect to their subdomain.
4. **Email per wedding**
   - Sending: `<slug>@weddingsweddings.co.uk` as the from address (one verified
     domain in Resend), couple names as the display name.
   - Receiving: inbound email (Resend inbound / Cloudflare Email Routing) to a
     webhook that files replies into that wedding's comms.
5. **Payments**: Stripe Checkout, one-off; the alpha code stays as a free pass.

## Known moves

- Photo uploads go to one personal Google Drive today. Move to Supabase
  Storage with a per-wedding folder before other couples upload.
- Push notifications, view-as, invite links and the access gate all need the
  wedding id.
- Vercel Hobby forbids commercial use: move to Pro before taking payment.
