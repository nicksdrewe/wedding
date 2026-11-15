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
```

- `rls_cost_access.test.mjs` — prices (0031/0032): who sees and edits costs.
- `rls_planner_access.test.mjs` — categories, options, photos, contacts, dates
  (0033).
- `rls_project_admin.test.mjs` — stag/hen boards (0034): what the project
  admin, ordinary members and outsiders can do, and the project budget.

The last two accept a migration number to stop early (e.g. `... 0033`), to
confirm the checks really fail without the migration under test.

Each prints `ALL CHECKS PASSED` or the failing checks, and exits non-zero on
failure. PGlite is deliberately not a project dependency (it is only needed
here), hence `--no-save`.
