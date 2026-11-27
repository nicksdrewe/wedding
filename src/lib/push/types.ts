// The kinds of notification, and who each is for. Client-safe.

export type PushType = "task_assigned" | "winner_chosen" | "big_day_published" | "guest_reply";

export const PUSH_TYPES: { type: PushType; label: string; hint: string; roles: string[] }[] = [
  { type: "task_assigned", label: "Tasks given to you", hint: "When someone gives you a to-do.", roles: ["couple", "family", "wedding_party"] },
  { type: "winner_chosen", label: "Decisions made", hint: "When an option is chosen in a plan you can see.", roles: ["couple", "family", "wedding_party"] },
  { type: "guest_reply", label: "Emails from guests", hint: "When a guest replies to one of your emails.", roles: ["couple"] },
  { type: "big_day_published", label: "The Big Day schedule", hint: "When the schedule is published or updated.", roles: ["couple", "family", "wedding_party", "guest"] },
];

export function typesForRole(role: string | null | undefined) {
  return PUSH_TYPES.filter((t) => !!role && t.roles.includes(role));
}
