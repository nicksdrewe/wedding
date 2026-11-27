"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getWeddingId } from "@/lib/wedding/current";
import { PALETTES } from "@/lib/wedding/theme";

// The couple's own wedding settings. Row security (0056) lets only the couple
// of this wedding change it; these check first so the message is friendly.

type Result = { error: string | null };

async function requireCouple() {
  const profile = await getCurrentProfile();
  return profile?.role === "couple" ? profile : null;
}

const detailsSchema = z.object({
  partnerOne: z.string().trim().min(1, "Add the first name.").max(40),
  partnerTwo: z.string().trim().min(1, "Add the second name.").max(40),
  dateLabel: z.string().trim().max(40).optional().default(""),
  weddingDate: z.string().trim().optional().default(""),
});

export async function saveWeddingDetails(input: z.input<typeof detailsSchema>): Promise<Result> {
  if (!(await requireCouple())) return { error: "Only the couple can change this." };
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { partnerOne, partnerTwo, dateLabel, weddingDate } = parsed.data;
  if (weddingDate && !/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) return { error: "That date doesn't look right." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weddings")
    .update({
      partner_one: partnerOne,
      partner_two: partnerTwo,
      display_name: `${partnerOne} & ${partnerTwo}`,
      date_label: dateLabel || null,
      wedding_date: weddingDate || null,
    })
    .eq("id", (await getWeddingId())!)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Couldn't save. Only the couple can change this." };
  revalidatePath("/", "layout");
  return { error: null };
}

const themeSchema = z.object({
  palette: z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]),
  mode: z.enum(["light", "dark"]),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export async function saveTheme(input: z.input<typeof themeSchema>): Promise<Result> {
  if (!(await requireCouple())) return { error: "Only the couple can change this." };
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return { error: "That colour choice isn't available." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weddings")
    .update({ theme: { palette: parsed.data.palette, mode: parsed.data.mode, accent: parsed.data.accent ?? null } })
    .eq("id", (await getWeddingId())!)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Couldn't save. Only the couple can change this." };
  revalidatePath("/", "layout");
  return { error: null };
}

export async function saveGateCodes(raw: string): Promise<Result> {
  if (!(await requireCouple())) return { error: "Only the couple can change this." };
  const codes = raw
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length > 5) return { error: "Up to five codes." };
  if (codes.some((c) => c.length < 3 || c.length > 32)) return { error: "Each code needs 3 to 32 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_gate_codes", { p_codes: codes });
  if (error) return { error: error.message.includes("fn_set_gate_codes") ? "This needs one more database step (migration 0057)." : error.message };
  revalidatePath("/");
  return { error: null };
}

// Example plans on or off (0062). The database function runs with the service
// role so example comments keep their made-up authors; the couple check is
// here.
export async function setExamples(on: boolean): Promise<Result> {
  if (!(await requireCouple())) return { error: "Only the couple can change this." };
  const weddingId = await getWeddingId();
  if (!weddingId) return { error: "Couldn't tell which wedding this is." };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient(weddingId).rpc("fn_set_examples", { p_wedding: weddingId, p_on: on });
  if (error) return { error: "Couldn't change the examples just now. Try again in a moment." };
  revalidatePath("/", "layout");
  return { error: null };
}

// ── Deleting the whole wedding ──────────────────────────────────────────────
// Couple only, and only after they type the wedding's address. Removes:
//   * every row the wedding owns, in every table (wedding_id cascades, 0056)
//   * its uploaded photos from storage (best effort, one by one)
//   * the sign-in of anyone who belonged to this wedding and no other
// The address becomes free again. There is no undo.

const DRIVE_ID = /\/api\/drive-image\/([^/?#]+)|lh3\.googleusercontent\.com\/d\/([^/?#]+)|[?&]id=([^&#]+)/;

export async function deleteWedding(confirmAddress: string): Promise<{ error: string | null; goTo?: string }> {
  const profile = await requireCouple();
  if (!profile) return { error: "Only the couple can delete the wedding." };
  const weddingId = await getWeddingId();
  if (!weddingId) return { error: "Couldn't tell which wedding this is." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient(weddingId);
  const { data: wedding } = await admin.from("weddings").select("id, slug").eq("id", weddingId).maybeSingle();
  if (!wedding) return { error: "This wedding has already gone." };
  if (confirmAddress.trim().toLowerCase() !== wedding.slug) {
    return { error: `Type ${wedding.slug} exactly to confirm.` };
  }

  // Who belongs here, and which photos are ours, before anything is removed.
  const { data: members } = await admin.from("contacts").select("user_id").eq("wedding_id", weddingId).not("user_id", "is", null);
  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];

  const photoUrls: string[] = [];
  for (const [table, column] of [
    ["page_option_images", "image_url"],
    ["idea_board_images", "image_url"],
    ["engagement_photos", "image_url"],
    ["big_day_items", "image_url"],
    ["contacts", "photo_url"],
  ] as const) {
    const { data } = await admin.from(table).select(column).eq("wedding_id", weddingId);
    for (const row of (data ?? []) as Record<string, string | null>[]) if (row[column]) photoUrls.push(row[column]!);
  }
  const fileIds = [...new Set(photoUrls.map((u) => u.match(DRIVE_ID)?.slice(1).find(Boolean)).filter(Boolean) as string[])];

  // The wedding's own Drive sign-in is stored with the wedding, so take hold
  // of it before the wedding (and with it the sign-in) is deleted.
  const { driveTarget, deleteFromDrive } = await import("@/lib/google/drive");
  const target = fileIds.length ? await driveTarget(weddingId).catch(() => null) : null;

  const { error } = await admin.from("weddings").delete().eq("id", weddingId);
  if (error) {
    console.error("deleteWedding failed:", error.message);
    return { error: "Couldn't delete the wedding just now. Nothing was removed; try again in a moment." };
  }

  // Photos: best effort, after the records are gone.
  if (target) await Promise.allSettled(fileIds.map((id) => deleteFromDrive(id, target)));

  // Sign-ins that belonged to this wedding only.
  for (const id of userIds) {
    const { count } = await admin.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", id);
    if ((count ?? 0) === 0) await admin.auth.admin.deleteUser(id).catch(() => null);
  }

  await (await createClient()).auth.signOut().catch(() => null);

  const { ROOT_DOMAIN } = await import("@/lib/wedding/host");
  return { error: null, goTo: `https://${ROOT_DOMAIN}/` };
}

// Stop using the connected Google Drive. Photos already there stay in the
// couple's Drive; new uploads wait until a Drive is connected again.
export async function disconnectDrive(): Promise<Result> {
  if (!(await requireCouple())) return { error: "Only the couple can change this." };
  const weddingId = await getWeddingId();
  if (!weddingId) return { error: "Couldn't tell which wedding this is." };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient(weddingId);
  const { data } = await admin.from("wedding_secrets").select("*").eq("wedding_id", weddingId).maybeSingle();
  const sealed = (data as { drive_refresh_token?: string | null } | null)?.drive_refresh_token;
  if (sealed) {
    const { openToken } = await import("@/lib/google/secret");
    const token = openToken(sealed);
    if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
  }
  const { error } = await admin
    .from("wedding_secrets")
    .update({ drive_refresh_token: null, drive_folder_id: null, drive_folder_name: null, drive_account: null, drive_connected_at: null })
    .eq("wedding_id", weddingId);
  if (error) return { error: "Couldn't disconnect just now. Try again in a moment." };
  revalidatePath("/wedding");
  return { error: null };
}

// A budget the couple types in: for the whole wedding (no category) or for one
// category. Empty clears it. (0064)
export async function setBudget(input: { categoryId: string | null; amount: string }): Promise<Result> {
  if (!(await requireCouple())) return { error: "Only the couple can set budgets." };
  const weddingId = await getWeddingId();
  if (!weddingId) return { error: "Couldn't tell which wedding this is." };
  const cleaned = input.amount.replace(/[£,\s]/g, "");
  const amount = cleaned === "" ? null : Number(cleaned);
  if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000)) return { error: "Enter an amount in pounds." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient(weddingId);
  if (!input.categoryId) {
    const { error } = await admin.from("weddings").update({ budget_total: amount }).eq("id", weddingId);
    if (error) return { error: "Couldn't save the budget just now." };
  } else {
    const id = z.string().uuid().safeParse(input.categoryId);
    if (!id.success) return { error: "Unknown category." };
    const { data: cat } = await admin.from("category_pages").select("id").eq("id", id.data).eq("wedding_id", weddingId).maybeSingle();
    if (!cat) return { error: "Unknown category." };
    const { data: existing } = await admin.from("category_costs").select("id").eq("category_page_id", id.data).eq("wedding_id", weddingId).limit(1).maybeSingle();
    const { error } = existing
      ? await admin.from("category_costs").update({ budget: amount }).eq("id", existing.id)
      : await admin.from("category_costs").insert({ wedding_id: weddingId, category_page_id: id.data, budget: amount });
    if (error) return { error: "Couldn't save the budget just now." };
  }
  revalidatePath("/budget");
  return { error: null };
}
