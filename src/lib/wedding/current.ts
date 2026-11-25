import { cache } from "react";
import { headers } from "next/headers";
import { WEDDING_HEADER, WEDDING_SLUG_HEADER } from "./host";

// The wedding this request is about, as decided by middleware from the address.

export async function getWeddingId(): Promise<string | null> {
  try {
    return (await headers()).get(WEDDING_HEADER);
  } catch {
    // outside a request (build time, background work without a request)
    return null;
  }
}

export async function getWeddingSlug(): Promise<string | null> {
  try {
    return (await headers()).get(WEDDING_SLUG_HEADER);
  } catch {
    return null;
  }
}

export type Wedding = {
  id: string;
  slug: string;
  partner_one: string;
  partner_two: string;
  display_name: string;
  wedding_date: string | null;
  date_label: string | null;
  theme: Record<string, unknown>;
  status: string;
  plan: string;
};

/** The current wedding's details (names, date, theme), once per request. */
export const getCurrentWedding = cache(async (): Promise<Wedding | null> => {
  const id = await getWeddingId();
  if (!id) return null;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("weddings")
    .select("id, slug, partner_one, partner_two, display_name, wedding_date, date_label, theme, status, plan")
    .eq("id", id)
    .maybeSingle();
  return (data as Wedding | null) ?? null;
});
