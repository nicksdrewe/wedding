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
