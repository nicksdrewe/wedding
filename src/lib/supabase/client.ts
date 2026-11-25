import { createBrowserClient } from "@supabase/ssr";

// Browser client: used for signing in only. Wedding data is always read on the
// server, which tells the database which wedding it is (see server.ts). Adding
// a custom header here would make every browser call to Supabase a cross-site
// request it may refuse, sign-in included.
//
// flowType 'implicit' (not the @supabase/ssr default of 'pkce') because this
// app only uses email magic links, never OAuth. PKCE ties the emailed
// token_hash to the browser/cookie that requested it, so it fails the moment
// someone opens the link on their phone instead of the browser they
// signed in from — which is the normal case for email, not the exception.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}
