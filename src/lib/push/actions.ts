"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { pushConfigured, sendTestTo } from "./send";

// Your own devices only: row security (0055) enforces it; these just validate.

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(300),
  auth: z.string().min(1).max(100),
});

export async function pushIsConfigured() {
  try {
    return pushConfigured();
  } catch {
    return false;
  }
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { error: "That device could not be registered." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ profile_id: profile.id, ...parsed.data, user_agent: userAgent.slice(0, 300) }, { onConflict: "endpoint" });
  if (error) return { error: error.message.includes("push_subscriptions") ? "Notifications need one more database step (migration 0055)." : error.message };
  return { error: null };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { error: null };
}

export async function savePushPrefs(endpoint: string, prefs: Record<string, boolean>) {
  const clean: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(prefs)) if (typeof v === "boolean" && k.length < 40) clean[k] = v;
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").update({ prefs: clean }).eq("endpoint", endpoint);
  return { error: error?.message ?? null };
}

export async function loadPushPrefs(endpoint: string): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("prefs").eq("endpoint", endpoint).maybeSingle();
  return (data?.prefs as Record<string, boolean> | null) ?? {};
}

export async function sendTestPush() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return { error: "Sign in first." };
    return { error: await sendTestTo(profile.id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send the test." };
  }
}
