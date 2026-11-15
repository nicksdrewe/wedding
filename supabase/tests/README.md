# Access-rule (RLS) tests

These replay every migration in `../migrations` into a throwaway in-memory
Postgres (PGlite) with a minimal stand-in for Supabase's `auth` schema, then
check what each kind of user — couple, family, best man, maid of honour,
groomsman, plain wedding party, guest, signed-out — can read and change.
Nothing touches the real database.

Run them after writing or changing any migration that affects access:

```bash
npm install --no-save @electric-sql/pglite
node supabase/tests/rls_cost_access.test.mjs
node supabase/tests/rls_planner_access.test.mjs
node supabase/tests/rls_project_admin.test.mjs
node supabase/tests/rls_admin_accounts.test.mjs
node supabase/tests/rls_feedback.test.mjs
node supabase/tests/rls_moodboard.test.mjs
node supabase/tests/rls_error_log.test.mjs
```

- `rls_cost_access.test.mjs` — prices (0031/0032): who sees and edits costs.
- `rls_planner_access.test.mjs` — categories, options, photos, contacts, dates
  (0033).
- `rls_project_admin.test.mjs` — stag/hen boards (0034): what the project
  admin, ordinary members and outsiders can do, and the project budget.

- `rls_admin_accounts.test.mjs` — account management (0035): the audit log and
  sign-out-everywhere function, and who is allowed to call them.

- `rls_feedback.test.mjs` — votes and comments (0037): who can see, vote,
  comment, edit and delete on options, ideas and tasks.

- `rls_moodboard.test.mjs` — who can read and add to the main moodboard and the
  stag/hen boards, and authorship (0038).

- `rls_error_log.test.mjs` — the error log: couple-only read/clear, no forging (0039).

The last five accept a migration number to stop early (e.g. `... 0033`), to
confirm the checks really fail without the migration under test.

Each prints `ALL CHECKS PASSED` or the failing checks, and exits non-zero on
failure. PGlite is deliberately not a project dependency (it is only needed
here), hence `--no-save`.
