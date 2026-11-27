# Go-live: switching the live site to multi-wedding

Moves Nick & Ellie's site to `nickellie.weddingsweddings.co.uk`, turns the main
domain into the commercial site, and runs migrations 0056–0059 on the live
database. Old links to the main domain forward to the nickellie address
(middleware, `COMMERCIAL_PATHS`).

## Before (any day, no downtime)

1. Staging click-through, signed in, as the couple and as a guest: guest list,
   RSVP, planning boards, budget, diary, comms send + inbox reply, settings
   (palette, night mode, access code), one test signup at `/www/start`.
2. Vercel Pro (Hobby forbids commercial use).
3. Wildcard domain `*.weddingsweddings.co.uk` on the project. Vercel only
   allows wildcards with its own nameservers: copy every existing DNS record
   into Vercel DNS first, then change nameservers at the registrar.
4. Live database backup.
5. Supabase (live) → Authentication → URL Configuration → Redirect URLs: add
   `https://*.weddingsweddings.co.uk/**`.
6. Resend: production webhook `https://weddingsweddings.co.uk/api/email/inbound`,
   event `email.received`.
7. Vercel Production variables: `WEDDING_EMAIL_DOMAIN`, `WEDDING_INBOX_DOMAIN`,
   `RESEND_WEBHOOK_SECRET` (the production webhook's own secret).
   Not `COMMERCIAL_APEX` yet.

## Switch (quiet evening, ~30 min, a few minutes of errors)

1. Live SQL editor: run 0056, 0057, 0058, 0059, one at a time, in order.
   From here the old code on the live site stops working.
2. Merge `multi-wedding` into `main` and push; production deploys (~3 min).
3. Check `https://nickellie.weddingsweddings.co.uk`: sign in, hub, guest list,
   a plan, RSVP page. The main domain still shows the wedding at this point.
4. Vercel Production: add `COMMERCIAL_APEX` = `1`, redeploy.
5. Check: main domain shows the commercial site; an old link such as
   `https://weddingsweddings.co.uk/hub` forwards to the nickellie address.

## After

- Everyone signs in once more (sessions belong to an address) and phones
  re-enable notifications. Worth a short note to guests.
- Undo: Vercel → Deployments → previous production deploy → Promote; restore
  the database backup. The migrations have no automatic undo.
