-- Second half of 0031_cost_access.sql. Run this only AFTER the deploy that
-- reads prices from page_option_costs is live — it removes the old price
-- columns from page_options, which is the step that actually stops a price
-- travelling with a venue's row.
--
-- Until this runs, anyone who can read an option row can still read its old
-- (now stale) price columns directly, so it must be in place before
-- page_options is opened up to best man / maid of honour.

-- The temporary mirror trigger from 0031 goes first (it references the
-- columns being dropped).
drop trigger if exists page_option_costs_sync on page_options;
drop function if exists fn_page_option_costs_sync();

-- Permanent replacement: every new option gets its (empty) cost row, so
-- "no cost row visible" always means "hidden from you". Security definer
-- because the person adding an option may not be allowed to see prices.
create or replace function fn_page_option_costs_ensure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into page_option_costs (page_option_id)
  values (new.id)
  on conflict (page_option_id) do nothing;
  return new;
end;
$$;

create trigger page_option_costs_ensure
  after insert on page_options
  for each row execute function fn_page_option_costs_ensure();

-- Belt and braces: any option that somehow has no cost row yet.
insert into page_option_costs (page_option_id)
select po.id from page_options po
where not exists (select 1 from page_option_costs c where c.page_option_id = po.id);

alter table page_options
  drop column predicted_cost_min,
  drop column predicted_cost_max,
  drop column actual_cost,
  drop column currency;
