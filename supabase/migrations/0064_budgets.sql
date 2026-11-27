-- Budgets the couple types in themselves: one for the whole wedding, and one
-- per category if they like. "On track" and "over" are judged against these,
-- not against the predicted range (which comes from the same option prices
-- as the spend, so could never really disagree with it).
alter table weddings add column if not exists budget_total numeric check (budget_total is null or budget_total >= 0);
alter table category_costs add column if not exists budget numeric check (budget is null or budget >= 0);
