import * as webpushModule from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTags } from "@/lib/tags";
import { fetchCategoryRows } from "@/lib/categories/rows";
import type { PushType } from "./types";

// Sending. Never throws: a failed notification must not break the action that
// caused it. Does nothing until the three VAPID settings exist.

// The package is CommonJS: depending on the bundler its API is on `default` or on the module itself.
const webpush = ((webpushModule as unknown as { default?: typeof webpushModule }).default ?? webpushModule) as typeof webpushModule;

type Payload = { title: string; body: string; url: string };

let configured: boolean | null = null;
export let pushConfigError: string | null = null;
function configure() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  let subject = process.env.VAPID_SUBJECT?.trim() || "mailto:hello@weddingsweddings.co.uk";
  if (!pub || !priv) return (configured = false);
  if (!/^(mailto:|https:\/\/)/.test(subject)) subject = `mailto:${subject}`;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    return (configured = true);
  } catch (e) {
    pushConfigError = e instanceof Error ? e.message : "invalid VAPID settings";
    return (configured = false);
  }
}

// For the "Send a test" button: send to one profile and say what happened.
export async function sendTestTo(profileId: string): Promise<string | null> {
  if (!configure()) return pushConfigError ? `The notification keys on the site are not valid (${pushConfigError}).` : "Notifications are not switched on for the site yet.";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", profileId);
    if (error) return "Notifications need one more database step (migration 0055).";
    if (!data || data.length === 0) return "No device is registered for you yet. Turn notifications off and on again.";
    const problems: string[] = [];
    for (const s of data) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: "Nick & Ellie", body: "Notifications are working.", url: "/hub", type: "task_assigned" }),
          { TTL: 600 }
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        problems.push(status ? `status ${status}` : e instanceof Error ? e.message : "failed");
      }
    }
    return problems.length === data.length ? `The phone's notification service refused it (${problems[0]}). Turn notifications off and on again.` : null;
  } catch (e) {
    return e instanceof Error ? e.message : "Couldn't send the test.";
  }
}

export function pushConfigured() {
  return configure();
}

// Send to these people (by profile), respecting each device's preferences.
export async function notifyProfiles(profileIds: string[], type: PushType, payload: Payload, exceptProfileId?: string | null) {
  try {
    if (!configure()) return;
    const ids = [...new Set(profileIds)].filter((id) => id && id !== exceptProfileId);
    if (ids.length === 0) return;
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, prefs").in("profile_id", ids);
    await Promise.all(
      (data ?? [])
        .filter((s) => (s.prefs as Record<string, boolean> | null)?.[type] !== false)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ ...payload, type }),
              { TTL: 60 * 60 * 24 }
            );
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        })
    );
  } catch {
    // swallow: notifications are a bonus
  }
}

// profile ids for contacts (the person a task is given to is a contact).
export async function profilesForContact(contactId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("profiles").select("id").eq("contact_id", contactId);
  return (data ?? []).map((p) => p.id);
}

// "An option was chosen": tell the people who can see that plan. For a stag or
// hen plan that is the board's own people, its best man / maid of honour and
// the couple, but never the couple when the plan (or something above it) is
// hidden from them. For the main wedding: the couple and family.
export async function notifyWinnerChosen(optionId: string, actorProfileId: string | null) {
  try {
    if (!configure()) return;
    const admin = createAdminClient();
    const { data: opt } = await admin
      .from("page_options")
      .select("name, option_groups(category_page_id)")
      .eq("id", optionId)
      .maybeSingle();
    const group = Array.isArray(opt?.option_groups) ? opt?.option_groups[0] : opt?.option_groups;
    const categoryId = (group as { category_page_id?: string | null } | null)?.category_page_id;
    if (!opt || !categoryId) return;

    const rows = await fetchCategoryRows(admin);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const cat = byId.get(categoryId);
    if (!cat) return;
    let hiddenFromCouple = false;
    for (let c = cat as typeof cat | undefined, i = 0; c && i < 12; c = c.parent_id ? byId.get(c.parent_id) : undefined, i++) {
      if (c.hidden_from_couple) hiddenFromCouple = true;
    }
    const { data: title } = await admin.from("category_pages").select("title").eq("id", categoryId).maybeSingle();
    const board = cat.board_tag;

    const { data: profiles } = await admin.from("profiles").select("id, role, contact_id");
    const { data: contacts } = await admin.from("contacts").select("id, tags");
    const tagsByContact = new Map((contacts ?? []).map((c) => [c.id, normalizeTags(c.tags)]));
    const audience = (profiles ?? []).filter((p) => {
      const tags = p.contact_id ? (tagsByContact.get(p.contact_id) ?? []) : [];
      if (p.role === "couple") return !hiddenFromCouple;
      if (board) return p.role === "wedding_party" && (tags.includes(board) || tags.includes(board === "groomsman" ? "best_man" : "maid_of_honour"));
      return p.role === "family";
    });
    await notifyProfiles(
      audience.map((p) => p.id),
      "winner_chosen",
      { title: "A decision was made", body: `${opt.name} was chosen${title?.title ? ` for ${title.title}` : ""}.`, url: board ? (board === "groomsman" ? "/project/groomsmen" : "/project/bridesmaids") : "/project" },
      actorProfileId
    );
  } catch {
    // swallow
  }
}

// The schedule was published: everyone with an account.
export async function notifyBigDayPublished(actorProfileId: string | null) {
  try {
    if (!configure()) return;
    const { data } = await createAdminClient().from("profiles").select("id");
    await notifyProfiles(
      (data ?? []).map((p) => p.id),
      "big_day_published",
      { title: "The Big Day schedule", body: "The schedule has been published. Have a look.", url: "/big-day" },
      actorProfileId
    );
  } catch {
    // swallow
  }
}
