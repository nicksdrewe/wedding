-- Example content: a switch the couple can flip to fill their site with a
-- realistic, made-up wedding plan (venues with map pins, costs, comments,
-- winners and the ones that lost out, a budget, tasks, diary dates, a stag
-- board and a running order), so they can see how each page works. Flipping
-- it off removes every example row and nothing else.
--
-- Example rows carry is_example = true. Category pages use slugs starting
-- "ex-", which is how their page_registry rows are found again.
-- The server calls fn_set_examples with the service role (after checking the
-- caller is the couple), so example comments keep their made-up authors.

alter table weddings add column if not exists show_examples boolean not null default false;

alter table category_pages add column if not exists is_example boolean not null default false;
alter table tasks add column if not exists is_example boolean not null default false;
alter table diary_entries add column if not exists is_example boolean not null default false;
alter table big_day_items add column if not exists is_example boolean not null default false;
alter table comments add column if not exists is_example boolean not null default false;
alter table project_budget_items add column if not exists is_example boolean not null default false;

create or replace function fn_set_examples(p_wedding uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  w uuid := p_wedding;
  v_day date;
  c_venue uuid; c_food uuid; c_caterer uuid; c_cake uuid; c_flowers uuid; c_music uuid; c_band uuid; c_ceremony uuid; c_outfits uuid; c_stag uuid;
  g uuid;
  o_hill uuid; o_barn uuid; o_river uuid; o_cat1 uuid; o_cat2 uuid; o_cake1 uuid; o_cake2 uuid; o_fl1 uuid; o_fl2 uuid; o_band1 uuid; o_band2 uuid; o_porto uuid; o_lisbon uuid;
begin
  if w is null then
    raise exception 'which wedding?';
  end if;
  perform set_config('app.wedding_id', w::text, true);

  -- always start clean
  delete from page_registry where wedding_id = w and page_key like 'categories:ex-%';
  delete from category_pages where wedding_id = w and is_example;
  delete from tasks where wedding_id = w and is_example;
  delete from diary_entries where wedding_id = w and is_example;
  delete from big_day_items where wedding_id = w and is_example;
  delete from comments where wedding_id = w and is_example;
  delete from project_budget_items where wedding_id = w and is_example;

  update weddings set show_examples = p_on where id = w;
  if not p_on then
    return;
  end if;

  v_day := coalesce((select wedding_date from weddings where id = w), (select start_date from big_day_settings where wedding_id = w), current_date + 300);

  -- ── the planning tree ──────────────────────────────────────────────────
  insert into category_pages (wedding_id, slug, title, sort_order, option_kind, is_example, feedback_enabled)
    values (w, 'ex-venue', 'Venue', 1, 'venue', true, true) returning id into c_venue;
  insert into category_pages (wedding_id, slug, title, sort_order, is_example, feedback_enabled)
    values (w, 'ex-food', 'Food & drink', 2, true, true) returning id into c_food;
  insert into category_pages (wedding_id, slug, title, sort_order, parent_id, is_example, feedback_enabled)
    values (w, 'ex-caterer', 'Caterer', 1, c_food, true, true) returning id into c_caterer;
  insert into category_pages (wedding_id, slug, title, sort_order, parent_id, is_example, feedback_enabled)
    values (w, 'ex-cake', 'Wedding cake', 2, c_food, true, true) returning id into c_cake;
  insert into category_pages (wedding_id, slug, title, sort_order, is_example, feedback_enabled)
    values (w, 'ex-flowers', 'Flowers', 3, true, true) returning id into c_flowers;
  insert into category_pages (wedding_id, slug, title, sort_order, is_example, feedback_enabled)
    values (w, 'ex-music', 'Music', 4, true, true) returning id into c_music;
  insert into category_pages (wedding_id, slug, title, sort_order, parent_id, is_example, feedback_enabled)
    values (w, 'ex-band', 'Evening band', 1, c_music, true, true) returning id into c_band;
  insert into category_pages (wedding_id, slug, title, sort_order, parent_id, is_example, feedback_enabled)
    values (w, 'ex-ceremony-music', 'Ceremony music', 2, c_music, true, true) returning id into c_ceremony;
  insert into category_pages (wedding_id, slug, title, sort_order, is_example, feedback_enabled)
    values (w, 'ex-outfits', 'Outfits', 5, true, true) returning id into c_outfits;
  insert into category_pages (wedding_id, slug, title, sort_order, board_tag, option_kind, is_example, feedback_enabled)
    values (w, 'ex-stag', 'Stag do', 1, 'groomsman', 'stay', true, true) returning id into c_stag;

  insert into page_registry (wedding_id, page_key, parent_page_key, label, default_min_role) values
    (w, 'categories:ex-venue', 'categories', 'Venue', 'family'),
    (w, 'categories:ex-food', 'categories', 'Food & drink', 'family'),
    (w, 'categories:ex-caterer', 'categories:ex-food', 'Caterer', 'family'),
    (w, 'categories:ex-cake', 'categories:ex-food', 'Wedding cake', 'family'),
    (w, 'categories:ex-flowers', 'categories', 'Flowers', 'family'),
    (w, 'categories:ex-music', 'categories', 'Music', 'family'),
    (w, 'categories:ex-band', 'categories:ex-music', 'Evening band', 'family'),
    (w, 'categories:ex-ceremony-music', 'categories:ex-music', 'Ceremony music', 'family'),
    (w, 'categories:ex-outfits', 'categories', 'Outfits', 'family'),
    (w, 'categories:ex-stag', 'project:groomsmen', 'Stag do', 'family')
  on conflict do nothing;

  -- rough budgets set on the categories themselves
  insert into category_costs (wedding_id, category_page_id, predicted_cost_min, predicted_cost_max) values
    (w, c_flowers, 1500, 2400), (w, c_outfits, 2500, 4000), (w, c_ceremony, 300, 600);

  -- ── venue: three options, one winner, map pins, comments ───────────────
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_venue, 'Venue') returning id into g;
  insert into page_options (wedding_id, option_group_id, name, description, latitude, longitude, is_winner, contact_name, web_link)
    values (w, g, 'Hill House', 'Georgian house with walled gardens. Ceremony in the orangery, drinks on the lawn, 120 for dinner.', 51.8327, -1.6948, true, 'Harriet (events)', 'example.com/hill-house')
    returning id into o_hill;
  insert into page_options (wedding_id, option_group_id, name, description, latitude, longitude)
    values (w, g, 'The Old Barn', 'Big oak-beamed barn, lovely but a 40 minute drive from the nearest hotels.', 51.9021, -1.8743)
    returning id into o_barn;
  insert into page_options (wedding_id, option_group_id, name, description, latitude, longitude)
    values (w, g, 'Riverside Hall', 'Cheapest by far. Smaller garden, and the last train back is at 22:40.', 51.7520, -1.2577)
    returning id into o_river;
  insert into page_option_costs (wedding_id, page_option_id, predicted_cost_min, predicted_cost_max, actual_cost) values
    (w, o_hill, 8800, 9500, 9100), (w, o_barn, 8000, 8800, null), (w, o_river, 6900, 7600, null)
    on conflict (page_option_id) do update set predicted_cost_min = excluded.predicted_cost_min, predicted_cost_max = excluded.predicted_cost_max, actual_cost = excluded.actual_cost;
  insert into option_cost_items (wedding_id, page_option_id, name, kind, amount, sort_order) values
    (w, o_hill, 'Venue hire', 'cost', 7500, 1), (w, o_hill, 'Late licence to 1am', 'cost', 1000, 2), (w, o_hill, 'Corkage', 'cost', 600, 3);
  insert into comments (wedding_id, target_type, target_id, profile_id, author_name, body, is_example) values
    (w, 'page_option', o_hill, null, 'Mum', 'The gardens!! That''s the one.', true),
    (w, 'page_option', o_hill, null, 'Your sister', 'Orangery for the ceremony if it rains. Sold.', true),
    (w, 'page_option', o_barn, null, 'Dad', 'Gorgeous, but who''s driving everyone back at midnight?', true),
    (w, 'page_option', o_river, null, 'Best man', 'Cheapest, and the bar''s right on the river.', true);

  -- ── food: a caterer chosen, the cake still being decided ──────────────
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_caterer, 'Caterer') returning id into g;
  insert into page_options (wedding_id, option_group_id, name, description, is_winner)
    values (w, g, 'Fig & Thyme', 'Sharing platters, three courses, vegetarian menu included. Tasting booked.', true) returning id into o_cat1;
  insert into page_options (wedding_id, option_group_id, name, description)
    values (w, g, 'The Hog Roast Co.', 'Great value, but no sit-down option for the speeches.') returning id into o_cat2;
  insert into page_option_costs (wedding_id, page_option_id, predicted_cost_min, predicted_cost_max, actual_cost) values
    (w, o_cat1, 6200, 6800, 6480), (w, o_cat2, 4200, 4800, null)
    on conflict (page_option_id) do update set predicted_cost_min = excluded.predicted_cost_min, predicted_cost_max = excluded.predicted_cost_max, actual_cost = excluded.actual_cost;
  insert into option_cost_items (wedding_id, page_option_id, name, kind, quantity, rate, amount, sort_order) values
    (w, o_cat1, 'Dinner', 'cost', 120, 48, 5760, 1), (w, o_cat1, 'Evening food', 'cost', 120, 6, 720, 2);

  insert into option_groups (wedding_id, category_page_id, title) values (w, c_cake, 'Wedding cake') returning id into g;
  insert into page_options (wedding_id, option_group_id, name, description)
    values (w, g, 'Three-tier lemon & elderflower', 'From the bakery by the station.') returning id into o_cake1;
  insert into page_options (wedding_id, option_group_id, name, description)
    values (w, g, 'A tower of cheese', 'Cheaper, and nobody ever finishes the cake anyway.') returning id into o_cake2;
  insert into page_option_costs (wedding_id, page_option_id, predicted_cost_min, predicted_cost_max) values
    (w, o_cake1, 450, 550), (w, o_cake2, 300, 380)
    on conflict (page_option_id) do update set predicted_cost_min = excluded.predicted_cost_min, predicted_cost_max = excluded.predicted_cost_max;
  insert into comments (wedding_id, target_type, target_id, profile_id, author_name, body, is_example) values
    (w, 'page_option', o_cake2, null, 'Grandad', 'Cheese. Obviously.', true);

  -- ── flowers: options in, nothing chosen yet ──────────────────────────
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_flowers, 'Flowers') returning id into g;
  insert into page_options (wedding_id, option_group_id, name, description)
    values (w, g, 'Wild & Bloom', 'Loose, seasonal, very garden. Will reuse the ceremony arch at dinner.') returning id into o_fl1;
  insert into page_options (wedding_id, option_group_id, name, description)
    values (w, g, 'Petal Street', 'More structured. Includes buttonholes for everyone in the wedding party.') returning id into o_fl2;
  insert into page_option_costs (wedding_id, page_option_id, predicted_cost_min, predicted_cost_max) values
    (w, o_fl1, 1700, 2100), (w, o_fl2, 1900, 2400)
    on conflict (page_option_id) do update set predicted_cost_min = excluded.predicted_cost_min, predicted_cost_max = excluded.predicted_cost_max;

  -- ── music: the band chosen, ceremony music not started ────────────────
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_band, 'Evening band') returning id into g;
  insert into page_options (wedding_id, option_group_id, name, description, is_winner)
    values (w, g, 'The Saturday Shoes', 'Four-piece, Motown to Arctic Monkeys, plays till midnight.', true) returning id into o_band1;
  insert into page_options (wedding_id, option_group_id, name, description)
    values (w, g, 'DJ Rob', 'Half the price, but he did your cousin''s wedding and played the Macarena twice.') returning id into o_band2;
  insert into page_option_costs (wedding_id, page_option_id, predicted_cost_min, predicted_cost_max, actual_cost) values
    (w, o_band1, 2000, 2400, 2200), (w, o_band2, 900, 1100, null)
    on conflict (page_option_id) do update set predicted_cost_min = excluded.predicted_cost_min, predicted_cost_max = excluded.predicted_cost_max, actual_cost = excluded.actual_cost;
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_ceremony, 'Ceremony music');
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_outfits, 'Outfits');

  -- ── the stag board (only the groomsmen and best man see these normally) ──
  insert into option_groups (wedding_id, category_page_id, title) values (w, c_stag, 'Stag do') returning id into g;
  insert into page_options (wedding_id, option_group_id, name, description, latitude, longitude, nights, sleeps, is_winner)
    values (w, g, 'Porto', 'Two nights, boat party on the Douro, port tasting.', 41.1496, -8.6110, 2, 10, true) returning id into o_porto;
  insert into page_options (wedding_id, option_group_id, name, description, latitude, longitude, nights, sleeps)
    values (w, g, 'Lisbon', 'Longer flight, bigger apartment, more hills.', 38.7223, -9.1393, 3, 12) returning id into o_lisbon;
  insert into page_option_costs (wedding_id, page_option_id, predicted_cost_min, predicted_cost_max) values
    (w, o_porto, 2200, 2800), (w, o_lisbon, 2900, 3600)
    on conflict (page_option_id) do update set predicted_cost_min = excluded.predicted_cost_min, predicted_cost_max = excluded.predicted_cost_max;
  insert into project_budget_items (wedding_id, visible_tag, name, predicted_cost, actual_cost, is_example) values
    (w, 'groomsman', 'Flights (8 people)', 770, 768, true),
    (w, 'groomsman', 'Boat party', 360, null, true);

  -- ── tasks and diary ───────────────────────────────────────────────────
  insert into tasks (wedding_id, title, notes, due_date, priority, status, done_at, is_example) values
    (w, 'Pay the venue deposit', '25% of the hire fee. Bank details are in the venue options.', current_date + 21, 1, 'todo', null, true),
    (w, 'Book a tasting with Fig & Thyme', null, current_date - 10, 2, 'done', now() - interval '10 days', true),
    (w, 'Shortlist two florists', 'Both options are on the Flowers board. Ask for buttonhole prices.', current_date + 35, 2, 'todo', null, true),
    (w, 'Send the save the dates', 'Use Guest Comms so we can see who''s opened it.', current_date + 14, 3, 'todo', null, true);
  insert into diary_entries (wedding_id, title, entry_date, source, category_page_id, is_example) values
    (w, 'Venue visit: Hill House', current_date + 9, 'manual', c_venue, true),
    (w, 'Menu tasting at Fig & Thyme', current_date + 30, 'manual', c_caterer, true),
    (w, 'Band contract back', current_date + 45, 'manual', c_band, true);

  -- ── the running order on the day ──────────────────────────────────────
  insert into big_day_items (wedding_id, title, notes, day, start_time, end_time, colour, is_example) values
    (w, 'Coaches leave the hotel', 'Two coaches, front entrance.', v_day, '13:30', '14:00', 'dusk', true),
    (w, 'Ceremony', 'In the orangery.', v_day, '14:00', '14:45', 'moss', true),
    (w, 'Drinks on the lawn', 'Lawn games out, photos by the walled garden.', v_day, '15:15', '17:15', 'gold', true),
    (w, 'Dinner & speeches', null, v_day, '17:30', '20:00', 'rose', true),
    (w, 'First dance', 'Then The Saturday Shoes until midnight.', v_day, '20:00', '20:15', 'plum', true);
end;
$$;
revoke execute on function fn_set_examples(uuid, boolean) from public, anon, authenticated;
grant execute on function fn_set_examples(uuid, boolean) to service_role;
