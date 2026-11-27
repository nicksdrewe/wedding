// Slug -> wedding id, for middleware. Reads the public weddings list with the
// anon key and keeps answers for a few minutes, so most requests don't wait
// on the database at all.

type Entry = { id: string | null; at: number };
const cache = new Map<string, Entry>();
const TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 30 * 1000;

/** What the last lookup saw, for the preview-only diagnostic header. */
export let lastLookup = "";

export async function weddingIdForSlug(slug: string): Promise<string | null> {
  const hit = cache.get(slug);
  const now = Date.now();
  if (hit && now - hit.at < (hit.id ? TTL_MS : MISS_TTL_MS)) return hit.id;

  try {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/weddings?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id`;
    // Newer "sb_publishable_" keys go in the apikey header only; the older
    // JWT anon keys also work as a bearer token.
    const res = await fetch(url, {
      headers: key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    lastLookup = `${slug}:${res.status}:${key.slice(0, 6)}:${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "none").slice(8, 20)}`;
    if (!res.ok) return hit?.id ?? null;
    const rows = (await res.json()) as { id: string }[];
    const id = rows[0]?.id ?? null;
    cache.set(slug, { id, at: now });
    return id;
  } catch (e) {
    lastLookup = `${slug}:error:${e instanceof Error ? e.message.slice(0, 60) : "unknown"}`;
    return hit?.id ?? null;
  }
}
