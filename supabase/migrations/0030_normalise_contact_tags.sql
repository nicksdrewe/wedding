-- Contact tags drive access: page_permissions tag rows, fn_has_visible_tag(),
-- and the nav all compare tags by EXACT string against snake_case keys
-- (best_man, maid_of_honour, groomsman, bridesmaid). Tags were saved exactly
-- as typed ("Best Man", "Maid Of Honour", "Groomsman"), so none of that
-- matched a real person. This normalises what's already stored; the app now
-- normalises on every write too (src/lib/tags.ts).
--
-- Same algorithm as normalizeTag() in TypeScript: lowercase, whitespace and
-- hyphens -> underscore, drop anything else non-alphanumeric, collapse
-- repeated underscores, trim leading/trailing underscores.

create or replace function fn_normalize_tag(p_tag text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '_' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(p_tag)), '[\s-]+', '_', 'g'),
          '[^a-z0-9_]', '', 'g'),
        '_+', '_', 'g')
    ),
    ''
  );
$$;

-- 1. contacts.tags
update contacts c
set tags = coalesce(
  (select array_agg(distinct n)
   from (select fn_normalize_tag(t) as n from unnest(c.tags) as t) x
   where n is not null),
  '{}'
)
where c.tags is not null and cardinality(c.tags) > 0;

-- 2. page_permissions tag rows saved through the Roles & Access screen with
-- the old capitalised spelling. A legacy row whose normalised twin already
-- exists is dropped (the twin is the seeded/authoritative one — notably the
-- stray 'comms' rows for Best Man / Maid Of Honour, which must not stand);
-- the rest are renamed in place.
delete from page_permissions p
where p.principal_type = 'tag'
  and p.principal_value <> fn_normalize_tag(p.principal_value)
  and exists (
    select 1 from page_permissions q
    where q.page_key = p.page_key
      and q.principal_type = 'tag'
      and q.principal_value = fn_normalize_tag(p.principal_value)
  );

update page_permissions
set principal_value = fn_normalize_tag(principal_value)
where principal_type = 'tag'
  and principal_value <> fn_normalize_tag(principal_value);

-- 3. Best man / maid of honour are not meant to reach Comms, the access
-- admin, the Budget, or the full guest list. 0027 seeded page_access = true
-- on every registry page for them, which the nav then advertised even though
-- the route layouts turn them away. Switch those rows off so permissions,
-- nav and layouts agree. (Reversible per row from Roles & Access.)
update page_permissions
set page_access = false, data_access = false, edit_access = false, updated_at = now()
where principal_type = 'tag'
  and principal_value in ('best_man', 'maid_of_honour')
  and page_key in ('comms', 'access', 'budget', 'guests');
