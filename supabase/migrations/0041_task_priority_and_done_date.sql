-- Tasks get a priority flag and a completion date (the created date already
-- exists as created_at). Priority: 0 optional, 1 not urgent, 2 normal,
-- 3 important, 4 urgent. Existing tasks become "normal".
--
-- Additive only, and existing row-level rules already cover these columns
-- (who may update a task is unchanged), so there is nothing to re-test.
-- Safe to run before or after the app deploy: the old app ignores the new
-- columns; the new app needs them.

alter table tasks
  add column if not exists priority smallint not null default 2,
  add column if not exists done_at timestamptz;

alter table tasks drop constraint if exists tasks_priority_range;
alter table tasks add constraint tasks_priority_range check (priority between 0 and 4);

-- Tasks already marked done keep no date (it was never recorded); only
-- newly completed ones are stamped.
