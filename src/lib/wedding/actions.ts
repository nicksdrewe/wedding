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
