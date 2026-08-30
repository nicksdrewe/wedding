"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

const ideaSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
});

export async function addIdea(formData: FormData) {
  const parsed = ideaSchema.parse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
  });

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase.from("idea_boards").insert({
    tier: "wedding_party",
    title: parsed.title,
    body: parsed.body ?? null,
    created_by: profile?.id ?? null,
  });

  revalidatePath("/project");
}

const updateIdeaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().optional(),
});

export async function updateIdea(formData: FormData) {
  const parsed = updateIdeaSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("idea_boards")
    .update({ title: parsed.title, body: parsed.body ?? null })
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
