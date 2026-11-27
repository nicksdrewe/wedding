-- STAGING ONLY until the multi-wedding switch-over.
--
-- Signing up a new wedding from the main site. There is no payment yet: the
-- price is shown, and a code takes it to nothing (the alpha). Codes live here,
-- readable only by the server.

create table signup_codes (
  code text primary key check (code = upper(code)),
  note text,
  discount_percent int not null default 100 check (discount_percent between 0 and 100),
  max_uses int,                       -- null: unlimited
  uses int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table signup_codes enable row level security;
-- no policies: only the service role reads or writes it

alter table weddings add column signup_code text references signup_codes(code) on delete set null;

-- Names that can never be a wedding's address.
create or replace function fn_slug_reserved(p_slug text)
returns boolean
language sql immutable
as $$
  select p_slug = any (array[
    'www', 'app', 'api', 'admin', 'mail', 'email', 'smtp', 'help', 'support', 'status', 'blog',
    'docs', 'login', 'signup', 'start', 'pricing', 'billing', 'pay', 'static', 'assets', 'cdn',
    'staging', 'dev', 'test', 'preview', 'demo', 'hello', 'team', 'weddings', 'weddingsweddings'
  ]);
$$;

-- Is this address free? Anyone may ask (wedding addresses are public anyway).
create or replace function fn_slug_available(p_slug text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
     and not fn_slug_reserved(p_slug)
     and not exists (select 1 from weddings where slug = p_slug);
$$;
grant execute on function fn_slug_available(text) to anon, authenticated;

-- Is this code good for a discount? Returns the percent off, or null.
create or replace function fn_check_signup_code(p_code text)
returns int
language sql security definer set search_path = public stable
as $$
  select discount_percent from signup_codes
  where code = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses);
$$;
revoke execute on function fn_check_signup_code(text) from public, anon, authenticated;

-- Make a wedding: the wedding, its starting pages and permissions (copied from
-- the first wedding), and the couple on its guest list. Server only.
-- Until payment exists, only a 100% code gets through.
create or replace function fn_create_wedding(
  p_slug text,
  p_partner_one text,
  p_partner_two text,
  p_date_label text,
  p_email text,
  p_full_name text,
  p_user uuid,
  p_code text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_off int;
  v_wedding uuid;
  v_template uuid := (select id from weddings order by created_at limit 1);
  v_one text := nullif(trim(p_partner_one), '');
  v_two text := nullif(trim(p_partner_two), '');
begin
  if v_one is null or v_two is null then
    raise exception 'names needed' using errcode = '22023';
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'email needed' using errcode = '22023';
  end if;

  -- lock the code row so two signups can't both take the last use
  select discount_percent into v_off from signup_codes
  where code = v_code and active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses)
  for update;
  if v_off is null or v_off < 100 then
    raise exception 'code not valid' using errcode = '22023';
  end if;

  if not fn_slug_available(p_slug) then
    raise exception 'address taken' using errcode = '23505';
  end if;

  insert into weddings (slug, partner_one, partner_two, display_name, date_label, theme, plan, created_by, signup_code)
  values (p_slug, v_one, v_two, v_one || ' & ' || v_two, nullif(trim(p_date_label), ''),
          '{"palette":"garden","mode":"light"}', 'alpha', p_user, v_code)
  returning id into v_wedding;

  if v_template is not null then
    perform fn_seed_wedding(v_wedding, v_template);
  end if;

  perform set_config('app.wedding_id', v_wedding::text, true);
  insert into contacts (wedding_id, full_name, email, role, user_id)
  values (v_wedding, coalesce(nullif(trim(p_full_name), ''), v_one), lower(trim(p_email)), 'couple', p_user);

  update signup_codes set uses = uses + 1 where code = v_code;
  return v_wedding;
end;
$$;
revoke execute on function fn_create_wedding(text, text, text, text, text, text, uuid, text) from public, anon, authenticated;

-- The alpha code.
insert into signup_codes (code, note, discount_percent, max_uses)
values ('ALPHA2026', 'Alpha testers', 100, 50)
on conflict do nothing;
