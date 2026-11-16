-- Whether a category invites votes and comments. Some plans ("Stag") are just
-- containers where voting makes no sense; others ("Porto") are ideas worth
-- voting on. Nothing can tell which, so it is a switch on each category
-- (default on, as it has been). Additive; safe before or after the deploy.
alter table category_pages add column if not exists feedback_enabled boolean not null default true;
