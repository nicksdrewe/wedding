// Slug -> wedding id, for middleware. Reads the public weddings list with the
// anon key and keeps answers for a few minutes, so most requests don't wait
// on the database at all.

type Entry = { id: string | null; at: number };
const cache = new Map<string, Entry>();
const TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 30 * 1000;

export async function weddingIdForSlug(slug: string): Promise<string | null> {
  const hit = cache.get(slug);
  const now = Date.now();
  if (hit && now - hit.at < (hit.id ? TTL_MS : MISS_TTL_MS)) return hit.id;

  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/weddings?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return hit?.id ?? null;
    const rows = (await res.json()) as { id: string }[];
    const id = rows[0]?.id ?? null;
    cache.set(slug, { id, at: now });
    return id;
  } catch {
    return hit?.id ?? null;
  }
}
