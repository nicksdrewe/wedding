"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

// Who may read, add, edit or delete is decided by the database (0043); these
// actions validate input, never send created_by or board_tag, and report a
// refusal in plain language.

const entrySchema = z.object({
  kind: z.enum(["received", "sent", "note"]),
  counterparty: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(1, "Give the entry a subject.").max(200, "Keep the subject under 200 characters."),
  body: z.string().max(20000, "That is too long — keep it under 20,000 characters.").optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  importance: z.coerce.number().int().min(0).max(2),
  categoryPageId: z.string().uuid().optional(),
  pageOptionId: z.string().uuid().optional(),
});

function text(formData: FormData, key: string) {
  const v = formData.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : v;
}

function parseEntry(formData: FormData) {
  return entrySchema.safeParse({
    kind: formData.get("kind"),
    counterparty: text(formData, "counterparty"),
    subject: formData.get("subject"),
    body: text(formData, "body"),
    occurredOn: formData.get("occurredOn"),
    importance: formData.get("importance") ?? 0,
    categoryPageId: text(formData, "categoryPageId"),
    pageOptionId: text(formData, "pageOptionId"),
  });
}

function refresh() {
  revalidatePath("/organising");
  revalidatePath("/diary");
}

export async function addOrgComm(formData: FormData): Promise<{ error: string | null }> {
  const parsed = parseEntry(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("org_comms").insert({
    kind: d.kind,
    counterparty: d.counterparty ?? null,
    subject: d.subject,
    body: d.body ?? null,
    occurred_on: d.occurredOn,
    importance: d.importance,
    category_page_id: d.pageOptionId ? null : (d.categoryPageId ?? null),
    page_option_id: d.pageOptionId ?? null,
  });
  if (error) return { error: "That couldn't be saved. You may not have access to what it is about." };
  refresh();
  return { error: null };
}

export async function updateOrgComm(id: string, formData: FormData): Promise<{ error: string | null }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "That entry could not be found." };
  const parsed = parseEntry(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_comms")
    .update({
      kind: d.kind,
      counterparty: d.counterparty ?? null,
      subject: d.subject,
      body: d.body ?? null,
      occurred_on: d.occurredOn,
      importance: d.importance,
      category_page_id: d.pageOptionId ? null : (d.categoryPageId ?? null),
      page_option_id: d.pageOptionId ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "You can only change entries you added." };
  refresh();
  return { error: null };
}

export async function setOrgCommImportance(id: string, importance: number): Promise<{ error: string | null }> {
  const ok = z.string().uuid().safeParse(id).success && [0, 1, 2].includes(importance);
  if (!ok) return { error: "That entry could not be found." };
  const profile = await getCurrentProfile();
  if (profile?.role !== "couple") return { error: "Only the couple can change how important an entry is." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("org_comms").update({ importance }).eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "That couldn't be changed." };
  refresh();
  return { error: null };
}

export async function deleteOrgComm(id: string): Promise<{ error: string | null }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "That entry could not be found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("org_comms").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "You can only delete entries you added." };
  refresh();
  return { error: null };
}
