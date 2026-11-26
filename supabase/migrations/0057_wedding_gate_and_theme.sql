-- Phase 2 (see docs/plans/multi-wedding.md): each wedding's own access code,
-- and the couple's theme choices.
--
-- Access codes used to be baked into the page code (readable by anyone who
-- looked). They now live in a table nobody can read; a function answers only
-- "is this the right code?" and "does this wedding have a gate at all?".

create table wedding_secrets (
  wedding_id uuid primary key references weddings(id) on delete cascade,
  gate_codes text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table wedding_secrets enable row level security;
-- no policies: only the functions below (and the server) can touch it

insert into wedding_secrets (wedding_id, gate_codes)
select id, array['N&E2028', '9762'] from weddings where slug = 'nickellie'
on conflict (wedding_id) do nothing;

create or replace function fn_wedding_has_gate(p_wedding uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select cardinality(gate_codes) > 0 from wedding_secrets where wedding_id = p_wedding), false);
$$;

create or replace function fn_check_gate_code(p_wedding uuid, p_code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select upper(trim(p_code)) = any(select upper(c) from unnest(gate_codes) as c)
    from wedding_secrets where wedding_id = p_wedding
  ), false);
$$;

-- The couple sets their own codes (an empty list turns the gate off).
create or replace function fn_set_gate_codes(p_codes text[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_couple() then
    raise exception 'Only the couple can change the access code';
  end if;
  insert into wedding_secrets (wedding_id, gate_codes, updated_at)
  values (current_wedding_id(), coalesce(p_codes, '{}'), now())
  on conflict (wedding_id) do update set gate_codes = excluded.gate_codes, updated_at = now();
end;
$$;

grant execute on function fn_wedding_has_gate(uuid) to anon, authenticated;
grant execute on function fn_check_gate_code(uuid, text) to anon, authenticated;
grant execute on function fn_set_gate_codes(text[]) to authenticated;

-- Theme defaults for the first wedding: the garden palette, light mode.
update weddings set theme = '{"palette": "garden", "mode": "light"}'::jsonb
where slug = 'nickellie' and theme = '{}'::jsonb;
