"use server";

// Votes and comments on options, ideas and tasks. Uses the signed-in
// person's own session, never the admin client: the database rules
// (0037_reactions_and_comments.sql) decide who may see, vote, comment, edit
// and delete — these actions only validate input, report refusals in plain
// language, and refresh the page. RLS refuses an update/delete silently (zero
// rows), so those are checked by selecting the row back.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { checkRateLimit } from "@/lib/rate-limit";

type Result = { error: string | null };

const targetSchema = z.object({
  targetType: z.enum(["page_option", "idea", "task"]),
  targetId: z.string().uuid(),
});
const pathSchema = z.string().startsWith("/").max(200);
const bodySchema = z.string().trim().min(1, "Write something first.").max(2000, "Comments can be up to 2000 characters.");

async function signedInNonGuest() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "guest") return null;
  return profile;
}

async function withinLimit(profileId: string) {
  const { ok } = await checkRateLimit(`feedback:${profileId}`, { max: 120, windowSeconds: 60 * 60 });
  return ok;
}

const TOO_MANY = "That's a lot in a short time — please try again in a little while.";
const NOT_ALLOWED = "You can't do that here.";

export async function setReaction(
  targetType: string,
  targetId: string,
  value: number,
  revalidate: string
): Promise<Result> {
  const target = targetSchema.safeParse({ targetType, targetId });
  const path = pathSchema.safeParse(revalidate);
  if (!target.success || !path.success || ![1, -1, 0].includes(value)) return { error: "That didn't look right." };

  const profile = await signedInNonGuest();
  if (!profile) return { error: NOT_ALLOWED };
  if (!(await withinLimit(profile.id))) return { error: TOO_MANY };

  const supabase = await createClient();
  if (value === 0) {
    // Taking back your own vote.
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("target_type", target.data.targetType)
      .eq("target_id", target.data.targetId)
      .eq("profile_id", profile.id);
    if (error) return { error: "Couldn't remove your vote." };
  } else {
    const { error } = await supabase.from("reactions").upsert(
      {
        target_type: target.data.targetType,
        target_id: target.data.targetId,
        profile_id: profile.id,
        value,
      },
      { onConflict: "target_type,target_id,profile_id" }
    );
    if (error) return { error: NOT_ALLOWED };
  }

  revalidatePath(path.data);
  return { error: null };
}

export async function addComment(
  targetType: string,
  targetId: string,
  body: string,
  revalidate: string
): Promise<Result> {
  const target = targetSchema.safeParse({ targetType, targetId });
  const text = bodySchema.safeParse(body);
  const path = pathSchema.safeParse(revalidate);
  if (!target.success || !path.success) return { error: "That didn't look right." };
  if (!text.success) return { error: text.error.issues[0]?.message ?? "Write something first." };

  const profile = await signedInNonGuest();
  if (!profile) return { error: NOT_ALLOWED };
  if (!(await withinLimit(profile.id))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    target_type: target.data.targetType,
    target_id: target.data.targetId,
    profile_id: profile.id,
    body: text.data,
  });
  if (error) return { error: NOT_ALLOWED };

  revalidatePath(path.data);
  return { error: null };
}

export async function updateComment(id: string, body: string, revalidate: string): Promise<Result> {
  const commentId = z.string().uuid().safeParse(id);
  const text = bodySchema.safeParse(body);
  const path = pathSchema.safeParse(revalidate);
  if (!commentId.success || !path.success) return { error: "That didn't look right." };
  if (!text.success) return { error: text.error.issues[0]?.message ?? "Write something first." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").update({ body: text.data }).eq("id", commentId.data).select("id");
  if (error) return { error: NOT_ALLOWED };
  if (!data || data.length === 0) return { error: "You can only edit your own comments." };

  revalidatePath(path.data);
  return { error: null };
}

export async function deleteComment(id: string, revalidate: string): Promise<Result> {
  const commentId = z.string().uuid().safeParse(id);
  const path = pathSchema.safeParse(revalidate);
  if (!commentId.success || !path.success) return { error: "That didn't look right." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").delete().eq("id", commentId.data).select("id");
  if (error) return { error: NOT_ALLOWED };
  if (!data || data.length === 0) return { error: "That comment can't be removed by you." };

  revalidatePath(path.data);
  return { error: null };
}
