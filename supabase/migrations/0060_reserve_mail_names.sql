-- Addresses used by the email setup (DNS records that sit outside the
-- wildcard) can never be a wedding's address.
create or replace function fn_slug_reserved(p_slug text)
returns boolean
language sql immutable
as $$
  select p_slug = any (array[
    'www', 'app', 'api', 'admin', 'mail', 'email', 'smtp', 'help', 'support', 'status', 'blog',
    'docs', 'login', 'signin', 'signup', 'start', 'pricing', 'billing', 'pay', 'static', 'assets', 'cdn',
    'staging', 'dev', 'test', 'preview', 'demo', 'hello', 'team', 'weddings', 'weddingsweddings',
    'send', 'reply', 'rsend', 'bounce', 'inbound', 'mx', 'ns1', 'ns2'
  ]);
$$;
