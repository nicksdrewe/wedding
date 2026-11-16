"use server";

// The best man / maid of honour hiding a plan, task or idea from the couple
// (0052_hide_from_couple.sql). The database decides who may; this reports a
// refusal in plain words.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const TABLE = { category: "category_pages", task: "tasks", idea: "idea_boards" } as const;

export async function setHiddenFromCouple(kind: string, id: string, hidden: boolean, revalidate: string) {
  const parsed = z
    .object({ kind: z.enum(["category", "task", "idea"]), id: z.string().uuid(), path: z.string().startsWith("/").max(200) })
    .safeParse({ kind, id, path: revalidate });
  if (!parsed.success) return { error: "That didn't look right." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE[parsed.data.kind])
    .update({ hidden_from_couple: hidden })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { error: error.message.includes("hidden_from_couple") && !error.message.includes("Only") ? "Hiding isn't switched on yet." : error.message };
  if (!data || data.length === 0) return { error: "You can't change that here." };
  revalidatePath(parsed.data.path);
  revalidatePath("/project", "layout");
  return { error: null };
}
