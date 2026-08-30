"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

// tags: same comma-separated-input -> trimmed-array approach as
// src/app/(admin)/guests/actions.ts's updateContact/tagsToArray, kept local
// here since it's a two-line helper and this is the only other tags column
// in the project (idea_boards.tags, added in 0010).
function tagsToArray(tags: string | undefined) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const ideaSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  tags: z.string().optional(),
});

export async function addIdea(formData: FormData) {
  const parsed = ideaSchema.parse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    tags: formData.get("tags") || "",
  });

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase.from("idea_boards").insert({
    tier: "wedding_party",
    title: parsed.title,
    body: parsed.body ?? null,
    tags: tagsToArray(parsed.tags),
    created_by: profile?.id ?? null,
  });

  revalidatePath("/project");
}

const updateIdeaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().optional(),
  tags: z.string().optional(),
});

export async function updateIdea(formData: FormData) {
  const parsed = updateIdeaSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    tags: formData.get("tags") || "",
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("idea_boards")
    .update({ title: parsed.title, body: parsed.body ?? null, tags: tagsToArray(parsed.tags) })
    .eq("id", parsed.id);

  revalidatePath("/project");
  return { error: error?.message ?? null };
}

export async function deleteIdea(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("idea_boards").delete().eq("id", parsed);

  revalidatePath("/project");
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Idea images: one-to-many via idea_board_images (0010), same child-table
// shape as page_option_images (0006) and the same add/remove signatures as
// addOptionImage/removeOptionImage in src/lib/options/actions.ts — reuses
// the couple's shared Google Drive upload pipeline (/api/upload), never a
// new upload mechanism.

const addIdeaImageSchema = z.object({
  ideaId: z.string().uuid(),
  imageUrl: z.string().min(1),
});

export async function addIdeaImage(ideaId: string, imageUrl: string) {
  const parsed = addIdeaImageSchema.parse({ ideaId, imageUrl });
  const supabase = await createClient();

  const { data: existing, error: countError } = await supabase
    .from("idea_board_images")
    .select("sort_order")
    .eq("idea_board_id", parsed.ideaId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (countError) return { error: countError.message };

  const nextSortOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("idea_board_images").insert({
    idea_board_id: parsed.ideaId,
    image_url: parsed.imageUrl,
    sort_order: nextSortOrder,
  });
  if (error) return { error: error.message };

  revalidatePath("/project");
  return { error: null };
}

export async function removeIdeaImage(imageId: string) {
  const parsed = z.string().uuid().parse(imageId);
  const supabase = await createClient();

  const { error } = await supabase.from("idea_board_images").delete().eq("id", parsed);
  if (error) return { error: error.message };

  revalidatePath("/project");
  return { error: null };
}

const taskSchema = z.object({
  title: z.string().min(1),
  ownerContactId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function addTask(formData: FormData) {
  const parsed = taskSchema.parse({
    title: formData.get("title"),
    ownerContactId: formData.get("ownerContactId") || "",
    dueDate: formData.get("dueDate") || "",
  });

  const supabase = await createClient();
  await supabase.from("tasks").insert({
    title: parsed.title,
    owner_contact_id: parsed.ownerContactId || null,
    due_date: parsed.dueDate || null,
  });

  revalidatePath("/project");
}

export async function toggleTask(taskId: string, done: boolean) {
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo" })
    .eq("id", taskId);

  revalidatePath("/project");
}

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  ownerContactId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function updateTask(formData: FormData) {
  const parsed = updateTaskSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    ownerContactId: formData.get("ownerContactId") || "",
    dueDate: formData.get("dueDate") || "",
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title: parsed.title,
      owner_contact_id: parsed.ownerContactId || null,
      due_date: parsed.dueDate || null,
    })
    .eq("id", parsed.id);

  revalidatePath("/project");
  return { error: error?.message ?? null };
}

export async function deleteTask(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", parsed);

  revalidatePath("/project");
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Standalone option groups (stag/hen extras started from this page). This is
// deliberately narrow — only the group's own title and its existence. Editing
// the options inside it (page_options) stays in src/lib/options/actions.ts;
// this file only ever touches the group row itself, and only the standalone
// kind (category_page_id is null) is meant to reach these from the UI — RLS
// (0004_option_groups.sql) also enforces that split: a category-linked group
// requires is_couple(), a standalone one is couple-or-wedding_party.

const updateOptionGroupTitleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
});

export async function updateOptionGroupTitle(formData: FormData) {
  const parsed = updateOptionGroupTitleSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("option_groups")
    .update({ title: parsed.title })
    .eq("id", parsed.id);

  revalidatePath("/project");
  return { error: error?.message ?? null };
}

export async function deleteOptionGroup(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  // Cascades to page_options -> page_option_images (0004/0006).
  const { error } = await supabase.from("option_groups").delete().eq("id", parsed);

  revalidatePath("/project");
  return { error: error?.message ?? null };
}
