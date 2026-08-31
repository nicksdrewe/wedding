-- Predicted costs become a min–max range instead of one number (actual/
-- final cost stays a single absolute number, since only the range that's
-- still being estimated benefits from a spread) — plus a currency per cost
-- entry (GBP or EUR), so a vendor quoted in euros doesn't have to be
-- manually converted before it's entered. Aggregated displays (the budget
-- page) live-convert everything to GBP at render time (see src/lib/currency/)
-- rather than storing a converted value, since a stored conversion goes
-- stale the moment rates move.

alter table category_costs add column predicted_cost_min numeric(10,2);
alter table category_costs add column predicted_cost_max numeric(10,2);
alter table category_costs add column currency text not null default 'GBP' check (currency in ('GBP', 'EUR'));
update category_costs set predicted_cost_min = predicted_cost, predicted_cost_max = predicted_cost;
alter table category_costs drop column predicted_cost;

alter table page_options add column predicted_cost_min numeric(10,2);
alter table page_options add column predicted_cost_max numeric(10,2);
alter table page_options add column currency text not null default 'GBP' check (currency in ('GBP', 'EUR'));
update page_options set predicted_cost_min = predicted_cost, predicted_cost_max = predicted_cost;
alter table page_options drop column predicted_cost;
