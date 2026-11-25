import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getWeddingId } from "@/lib/wedding/current";
import { WEDDING_HEADER } from "@/lib/wedding/host";

// Every call carries the current wedding (from the address, via middleware),
// so the database only ever answers with that wedding's rows (0056).
export async function createClient() {
  const cookieStore = await cookies();
  const weddingId = await getWeddingId();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: weddingId ? { [WEDDING_HEADER]: weddingId } : {} },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component; middleware handles session refresh
          }
        },
      },
    }
  );
}
