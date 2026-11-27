import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// The commercial pages' words, editable from the owner's console
// (/platform/copy). Each piece has a default here; anything saved in site_copy
// (0065) replaces it. Missing table or database trouble: the defaults show.

export type CopyField = { key: string; group: string; label: string; value: string; long?: boolean };

export const COPY_FIELDS: CopyField[] = [
  { group: "Opening", key: "hero.eyebrow", label: "Small line above the headline", value: "Invite-only, and free while we build it" },
  { group: "Opening", key: "hero.title", label: "Headline", value: "Most wedding websites stop at the RSVP." },
  { group: "Opening", key: "hero.titleItalic", label: "Headline, second line (italic)", value: "Ours is where the planning happens." },
  {
    group: "Opening",
    key: "hero.lede",
    label: "Paragraph under the headline",
    long: true,
    value:
      "A private site for your wedding, at your own address, that runs the whole thing: every guest and every reply, the venues you're torn between, what it all costs and who's paying, the stag do you're not allowed to see, and where everyone needs to be at quarter past three.",
  },
  { group: "Opening", key: "hero.cta", label: "Main button", value: "Start your wedding site" },
  { group: "Opening", key: "hero.cta2", label: "Second button", value: "See how it fits together" },
  { group: "Opening", key: "hero.fine", label: "Small print under the buttons", value: "You'll need an invite code during the alpha." },

  { group: "Why it exists", key: "why.title", label: "Heading", value: "The website is the easy bit." },
  {
    group: "Why it exists",
    key: "why.body",
    label: "Paragraph",
    long: true,
    value:
      "The hard bit is the eighteen months before it, scattered across a spreadsheet, three group chats, a mood board and someone's notes app. Wedding websites give you a pretty page. Planning apps give you a checklist. Neither gives you the place where you, your families and your friends actually decide things together.",
  },

  { group: "What's inside", key: "inside.title", label: "Heading", value: "One system, not a pile of features." },
  {
    group: "What's inside",
    key: "inside.body",
    label: "Paragraph",
    long: true,
    value:
      "Choose a venue and the budget knows. Give someone a job and their phone knows. Change the plan and everyone knows. Each part below is moving in time with the others, because that's how it works.",
  },
  ...(
    [
      ["board", "Planning boards", "Every decision, side by side.", "Venues, caterers, the band, the cake. Line the options up with photos, prices, a pin on the map and your notes. Let the people you trust vote and comment, then pick the winner. The others step aside, and the price goes straight into your budget."],
      ["tree", "The whole picture", "See the entire wedding on one page.", "Every decision sits in one tree, from the ceremony to the hen do. Open any branch to see what's decided, what's still up for grabs and what it's costing. When someone asks how it's all going, you can actually show them."],
      ["budget", "Budget", "Know what it costs before your bank does.", "Set your budget, then watch the real figures fill in as you choose. You'll see what's committed, what could still change, and whether you're on track, with shared costs for the stag or the hen split fairly."],
      ["guests", "Guests & RSVPs", "Every guest, every event, every dietary need.", "Households, plus ones, the engagement party, the ceremony and the evening do. Guests reply from one link without a password, and you see who's coming to what, live. Nobody reconciles three spreadsheets the night before the caterer needs numbers."],
      ["party", "The wedding party", "Secrets, kept.", "The best man gets a planning board for the stag that the two of you can't see. The bridesmaids get theirs. Everyone gets exactly the pages you've given them, right down to whether they can see the prices."],
      ["messages", "Messages", "Send it from your own address. Read the replies here.", "Save the dates, coach times, the polite nudge to the people who haven't replied. Emails go out from your wedding's own address, to everyone or just the people who need it, and the answers land back in your inbox on the site."],
      ["day", "The day itself", "On the day, nobody needs to ask.", "Publish the running order and it's on every phone, with a nudge when something changes. The people helping know where to be, the guests know when to eat, and you get to just be there."],
    ] as const
  ).flatMap(([k, group, title, body]) => [
    { group: `Inside: ${group}`, key: `chapter.${k}.title`, label: "Heading", value: title },
    { group: `Inside: ${group}`, key: `chapter.${k}.body`, label: "Paragraph", value: body, long: true },
  ]),

  { group: "And the rest", key: "breadth.title", label: "Heading", value: "The small things you'd otherwise build yourself." },
  { group: "Who sees what", key: "roles.title", label: "Heading", value: "Everyone gets the right amount of wedding." },
  { group: "Getting going", key: "steps.title", label: "Heading", value: "Set up in an evening. Useful until the last dance." },
  { group: "The alpha", key: "alpha.title", label: "Heading", value: "We're building this with a small group of couples." },
  {
    group: "The alpha",
    key: "alpha.body",
    label: "Paragraph",
    long: true,
    value: "It started as the site for one real wedding and grew from there. Right now it's invite-only and free. If you've been sent a code, you're in.",
  },
  { group: "Last word", key: "final.title", label: "Closing heading", value: "You've got a wedding to plan. Give it somewhere to live." },
];

const DEFAULTS = new Map(COPY_FIELDS.map((f) => [f.key, f.value]));

/** Saved edits, once per request. */
export const loadCopy = cache(async (): Promise<Map<string, string>> => {
  try {
    const { data, error } = await createAdminClient().from("site_copy").select("key, value");
    if (error) return new Map();
    return new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  } catch {
    return new Map();
  }
});

/** A reader for the page: copy("hero.title"). */
export async function getCopy() {
  const saved = await loadCopy();
  return (key: string) => saved.get(key) ?? DEFAULTS.get(key) ?? "";
}
