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
