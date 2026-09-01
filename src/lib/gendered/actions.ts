"use server";

// Write actions for the gendered wedding-party pages (/project/bridesmaids,
// /project/groomsmen) — the create-only counterparts to the shared
// src/app/(party)/project/actions.ts, needed because those shared actions
// always insert visible_tag=null (see 0028_gendered_pages_and_family_access.
// sql). Editing/deleting an existing row, toggling a task, or adding an
// option into an existing group still goes through the shared actions
// (project/actions.ts, lib/options/actions.ts) unmodified — RLS scopes
// those to the row's own visible_tag via fn_has_visible_tag regardless of
// which page called them, so they don't need a gendered variant.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

const visibleTagSchema = z.enum(["bridesmaid", "groomsman"]);
export type VisibleTag = z.infer<typeof visibleTagSchema>;

function pathForTag(tag: VisibleTag) {
  return tag === "bridesmaid" ? "/project/bridesmaids" : "/project/groomsmen";
}

// Same comma-separated-input -> trimmed-array helper as project/actions.ts's
// tagsToArray; kept local since it's two lines and idea_boards.tags is the
// only other consumer.
function tagsToArray(tags: string | undefined) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const ideaSchema = z.object({
  visibleTag: visibleTagSchema,
  title: z.string().min(1),
  body: z.string().optional(),
  tags: z.string().optional(),
});

export async function createGenderedIdea(formData: FormData) {
  const parsed = ideaSchema.parse({
    visibleTag: formData.get("visibleTag"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    tags: formData.get("tags") || "",
  });

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase.from("idea_boards").insert({
    // tier is NOT NULL but no longer what governs access for gendered rows
    // — visible_tag does (see 0028) — this is just a placeholder value to
    // satisfy the column constraint.
    tier: "wedding_party",
    visible_tag: parsed.visibleTag,
    title: parsed.title,
    body: parsed.body ?? null,
    tags: tagsToArray(parsed.tags),
    created_by: profile?.id ?? null,
  });

  revalidatePath(pathForTag(parsed.visibleTag));
}

const taskSchema = z.object({
  visibleTag: visibleTagSchema,
  title: z.string().min(1),
  ownerContactId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function createGenderedTask(formData: FormData) {
  const parsed = taskSchema.parse({
    visibleTag: formData.get("visibleTag"),
    title: formData.get("title"),
    ownerContactId: formData.get("ownerContactId") || "",
    dueDate: formData.get("dueDate") || "",
  });

  const supabase = await createClient();
  await supabase.from("tasks").insert({
    visible_tag: parsed.visibleTag,
    title: parsed.title,
    owner_contact_id: parsed.ownerContactId || null,
    due_date: parsed.dueDate || null,
  });

  revalidatePath(pathForTag(parsed.visibleTag));
}

const optionGroupSchema = z.object({
  visibleTag: visibleTagSchema,
  title: z.string().min(1),
});

export async function createGenderedOptionGroup(formData: FormData) {
  const parsed = optionGroupSchema.parse({
    visibleTag: formData.get("visibleTag"),
    title: formData.get("title"),
  });

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase.from("option_groups").insert({
    category_page_id: null,
    visible_tag: parsed.visibleTag,
    title: parsed.title,
    created_by: profile?.id ?? null,
  });

  revalidatePath(pathForTag(parsed.visibleTag));
}
