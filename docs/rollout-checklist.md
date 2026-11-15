# Rolling the site out to the wedding party and beyond

A staged plan, with a gate between each stage. Don't move on until the stage before is clean. Everything here uses tools that already exist on the site.

## Before anyone is invited (one-off)

- [ ] Migrations 0030–0040 have all been run, in order (the Supabase SQL editor; nothing to run for a stage once its number is done).
- [ ] Supabase → Authentication → Emails → Templates → **Confirm sign up** is replaced with `docs/email-templates/confirm-signup.html` (so a first sign-in email always contains the code).
- [ ] Google Drive uploads work: while signed in as Nick or Ellie, open `/api/google/status` and see `"connected":true`.
- [ ] Vercel has `NEXT_PUBLIC_SITE_URL` = `https://www.weddingsweddings.co.uk`.
- [ ] You've looked at the site as each kind of person using **Guest List → ⋯ → View site as them**: best man, maid of honour, a groomsman, a bridesmaid, a family member, a plain wedding-party member, a guest. (View-as is read-only, so this is for looking, not testing buttons.)
- [ ] The per-person smoke test passes (`node tests/personas/live.test.mjs` with `npm run dev` running — see the header of that file; it briefly opens real sessions, so run it deliberately).
- [ ] `/errors` is empty or only has things you understand.

## Stage 1 — best man and maid of honour only

1. Guest List → filter to the two of them → **Create accounts** (tick "email each of them an invite").
2. Ask them to sign in and do these five things, and tell you if any fails:
   - Sign in with the emailed code (check the spam folder if it doesn't arrive).
   - Open Categories → Venue and look at the options and dates.
   - Add a photo or note to the main Idea Board.
   - Give a thumbs up and a comment on an option.
   - Open their own board (Groomsmen / Bridesmaids) and add a task.
3. Watch `/errors` for a week. Fix anything that appears before moving on.

**Gate:** both have signed in successfully, nothing in `/errors` you can't explain, and neither has seen anything they shouldn't (ask them: "did you see any prices, or the other board?" — the answer should be no).

## Stage 2 — the rest of the wedding party

Same steps, filtered to Wedding Party. Groomsmen and bridesmaids land on their own board's page via the home page; plain wedding-party members land on **My Details**.

**Gate:** everyone has signed in; the stag and hen boards have been used; no cross-board leaks reported.

## Stage 3 — family

Filter to Family → Create accounts. They can read Categories, Budget (read-only), the Guest List (read-only), Project and the Idea Board, and can add to the Idea Board.

**Gate:** no surprises with what family can see. In particular check you are happy with them seeing the Budget — if not, switch it off for Family in Roles & Access.

## Stage 4 — guests

Only when you want guests to have accounts at all (most guests only ever need their RSVP link). Create accounts in batches by filter. Guests see their own details page and the Diary of events.

## If something goes wrong

- **Someone can't sign in:** Guest List → their row. "No account" → create one. "Not signed in yet" → send the invite again. Still stuck → ask what the sign-in page says; "isn't set up yet" means no account, "switched off" means it was disabled.
- **Someone sees something they shouldn't:** Guest List → ⋯ → **View site as them** to see exactly what they see, then adjust Roles & Access (page / data / edit / **See costs** per page, per role or tag). Use **Sign out everywhere** if you want them to start fresh.
- **Photos won't upload:** `/api/google/status` says why.
- **A page shows an error:** `/errors` has the page, the message and a reference code.
- **Reset someone's access completely:** ⋯ → Reset password (signs them out everywhere and emails them how to get back in).

## What to send people (copy and paste)

> **Subject:** You're invited to our wedding site
>
> Hi \[name\],
>
> We've set you up with an account on our wedding site — a place to see plans, drop in ideas and photos, and join in with votes and comments.
>
> To sign in: go to **www.weddingsweddings.co.uk**, tap the sign-in link, enter this email address, tap **Send my code**, and type in the code we email you. (The code can take a minute — check your spam folder if it doesn't arrive.) If you'd rather use a password, you can set one afterwards from *My Details*.
>
> Anything odd, just tell us.
>
> Nick & Ellie

(The site also emails this automatically if you tick "send invite" when creating accounts.)
