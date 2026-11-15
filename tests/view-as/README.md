# View-as tests

Both need the local dev server running (`npm run dev`) and `.env.local`.

- `guard.test.mjs` — the read-only guard and the exit route, using hand-made
  cookies. Signs in as nobody; safe to run any time.

  ```bash
  node tests/view-as/guard.test.mjs
  ```

- `live.test.mjs` — the full flow against the REAL Supabase project: signs in
  as Nick on the local site, views as the best man, checks what he sees,
  exits, and proves only the borrowed session was closed. It opens real
  (short-lived) sessions for two real people, cleans them up, and restores
  their "last signed in" times — so only run it deliberately. Needs
  migrations 0035 and 0036.

  ```bash
  node tests/view-as/live.test.mjs
  ```
