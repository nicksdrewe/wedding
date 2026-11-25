import { createBrowserClient } from "@supabase/ssr";
import { WEDDING_COOKIE, WEDDING_HEADER } from "@/lib/wedding/host";

// The current wedding's id, which middleware leaves in a cookie for the browser.
function weddingIdFromCookie() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${WEDDING_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// flowType 'implicit' (not the @supabase/ssr default of 'pkce') because this
// app only uses email magic links, never OAuth. PKCE ties the emailed
// token_hash to the browser/cookie that requested it, so it fails the moment
// someone opens the link on their phone instead of the browser they
// signed in from — which is the normal case for email, not the exception.
export function createClient() {
  const weddingId = weddingIdFromCookie();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: "implicit" },
      global: { headers: weddingId ? { [WEDDING_HEADER]: weddingId } : {} },
    }
  );
}
