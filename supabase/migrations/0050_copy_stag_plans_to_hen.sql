-- One-off: copy everything planned on the groomsmen board (stag plans) onto
-- the bridesmaids board, renaming "Stag" to "Hen", so the maid of honour can
-- see how it works. Plans, nesting, map pins, option kinds, options (with
-- details, images and cost lines), winners.
--
-- Not copied: votes and comments (they are people's own), tasks and ideas.
-- Safe to run once; if the bridesmaids board already has plans it does
-- nothing (so it can't duplicate them a second time). Run AFTER 0047-0049.

do $$
declare
  r record;
  v_new uuid;
  v_new_group uuid;
  v_opt uuid;
  v_slug text;
  v_title text;
  v_parent_new uuid;
  v_parent_slug text;
  o record;
  n int;
begin
  if exists (select 1 from category_pages where board_tag = 'bridesmaid') then
    raise notice 'The bridesmaids board already has plans; nothing copied.';
    return;
  end if;

  create temp table _copy_map (old_id uuid primary key, new_id uuid not null, new_slug text not null) on commit drop;

  -- Parents before children.
  for r in
    with recursive tree as (
      select c.*, 0 as depth from category_pages c where c.board_tag = 'groomsman' and c.parent_id is null
      union all
      select c.*, t.depth + 1 from category_pages c join tree t on c.parent_id = t.id
    )
    select * from tree order by depth, sort_order, title
  loop
    v_title := regexp_replace(r.title, 'stag', 'Hen', 'gi');
    v_slug := regexp_replace(r.slug, 'stag', 'hen', 'gi');
    if v_slug = r.slug then
      v_slug := v_slug || '-hen';
    end if;
    n := 1;
    while exists (select 1 from category_pages where slug = v_slug) loop
      n := n + 1;
      v_slug := regexp_replace(r.slug, 'stag', 'hen', 'gi') || '-' || n;
    end loop;

    v_parent_new := null;
    v_parent_slug := null;
    if r.parent_id is not null then
      select new_id, new_slug into v_parent_new, v_parent_slug from _copy_map where old_id = r.parent_id;
    end if;

    insert into category_pages (slug, title, parent_id, sort_order, option_kind, latitude, longitude, board_tag)
    values (v_slug, v_title, v_parent_new, r.sort_order, r.option_kind, r.latitude, r.longitude, 'bridesmaid')
    returning id into v_new;

    insert into _copy_map values (r.id, v_new, v_slug);

    insert into page_registry (page_key, parent_page_key, label, default_min_role)
    values ('categories:' || v_slug, coalesce('categories:' || v_parent_slug, 'project:bridesmaids'), v_title, 'family')
    on conflict (page_key) do nothing;

    -- Its options comparison (every category has one).
    select id into v_new_group from option_groups where category_page_id = v_new;
    if v_new_group is null then
      insert into option_groups (category_page_id, title, created_by)
      select v_new, v_title, g.created_by from option_groups g where g.category_page_id = r.id
      returning id into v_new_group;
      if v_new_group is null then
        insert into option_groups (category_page_id, title) values (v_new, v_title) returning id into v_new_group;
      end if;
    end if;

    -- Options, with their details, images, prices and cost lines.
    for o in
      select po.* from page_options po
      join option_groups g on g.id = po.option_group_id
      where g.category_page_id = r.id
      order by po.created_at
    loop
      insert into page_options
        (option_group_id, name, description, web_link, option_date, contact_name, contact_phone, contact_email,
         latitude, longitude, nights, sleeps, is_winner)
      values
        (v_new_group, o.name, o.description, o.web_link, o.option_date, o.contact_name, o.contact_phone, o.contact_email,
         o.latitude, o.longitude, o.nights, o.sleeps, o.is_winner)
      returning id into v_opt;

      update page_option_costs c
         set predicted_cost_min = oc.predicted_cost_min,
             predicted_cost_max = oc.predicted_cost_max,
             actual_cost = oc.actual_cost,
             currency = oc.currency
        from page_option_costs oc
       where c.page_option_id = v_opt and oc.page_option_id = o.id;

      insert into page_option_images (page_option_id, image_url, sort_order)
      select v_opt, image_url, sort_order from page_option_images where page_option_id = o.id;

      insert into option_cost_items (page_option_id, name, kind, quantity, rate, amount, sort_order)
      select v_opt, name, kind, quantity, rate, amount, sort_order from option_cost_items where page_option_id = o.id;
    end loop;
  end loop;
end $$;
