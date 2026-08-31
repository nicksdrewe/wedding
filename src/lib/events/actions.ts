"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Couple-only writes, enforced by RLS ("couple manages events" /
// "couple updates events" on the events table, see 0001_init.sql) — the
// regular session-aware client, not the admin one, so a non-couple
// caller's insert/update is rejected at the database level regardless of
// what the UI shows them.

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Optional strings from a form: an empty input should clear the column
// (null), not store "" — every text field below goes through this.
function orNull(value: string | undefined | null) {
  const str = (value ?? "").trim();
  return str.length > 0 ? str : null;
}

const eventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only."),
  startsAtDate: z.string().optional(),
  startsAtTime: z.string().optional(),
  location: z.string().optional(),
  isLandingCta: z.boolean(),
  landingCtaEyebrow: z.string().optional(),
  landingCtaHeading: z.string().optional(),
  landingCtaBody: z.string().optional(),
  landingCtaCopy: z.string().optional(),
  rsvpEnabled: z.boolean(),
  rsvpOpen: z.boolean(),
  showRsvpForm: z.boolean(),
  showGuestListColumn: z.boolean(),
  showHeader: z.boolean(),
  headerEyebrow: z.string().optional(),
  headerTitle: z.string().optional(),
  headerBody: z.string().optional(),
  showPhotoBoard: z.boolean(),
  showDetails: z.boolean(),
  detailsEyebrow: z.string().optional(),
  detailsTitle: z.string().optional(),
  venueName: z.string().optional(),
  venueBody: z.string().optional(),
  showMap: z.boolean(),
  showOnDiary: z.boolean(),
});

function parseEventForm(formData: FormData) {
  return eventSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(String(formData.get("name") ?? "")),
    startsAtDate: formData.get("startsAtDate") || undefined,
    startsAtTime: formData.get("startsAtTime") || undefined,
    location: formData.get("location") || undefined,
    isLandingCta: formData.get("isLandingCta") === "on",
    landingCtaEyebrow: formData.get("landingCtaEyebrow") || undefined,
    landingCtaHeading: formData.get("landingCtaHeading") || undefined,
    landingCtaBody: formData.get("landingCtaBody") || undefined,
    landingCtaCopy: formData.get("landingCtaCopy") || undefined,
    rsvpEnabled: formData.get("rsvpEnabled") === "on",
    rsvpOpen: formData.get("rsvpOpen") === "on",
    showRsvpForm: formData.get("showRsvpForm") === "on",
    showGuestListColumn: formData.get("showGuestListColumn") === "on",
    showHeader: formData.get("showHeader") === "on",
    headerEyebrow: formData.get("headerEyebrow") || undefined,
    headerTitle: formData.get("headerTitle") || undefined,
    headerBody: formData.get("headerBody") || undefined,
    showPhotoBoard: formData.get("showPhotoBoard") === "on",
    showDetails: formData.get("showDetails") === "on",
    detailsEyebrow: formData.get("detailsEyebrow") || undefined,
    detailsTitle: formData.get("detailsTitle") || undefined,
    venueName: formData.get("venueName") || undefined,
    venueBody: formData.get("venueBody") || undefined,
    showMap: formData.get("showMap") === "on",
    showOnDiary: formData.get("showOnDiary") === "on",
  });
}

function buildRow(parsed: ReturnType<typeof parseEventForm>) {
  // A date with no time defaults to midday rather than midnight — a bare
  // date is more often "some time that day" than literally 00:00, and
  // midday avoids an accidental date-minus-one display in a timezone
  // west of UTC.
  const startsAt = parsed.startsAtDate
    ? new Date(`${parsed.startsAtDate}T${parsed.startsAtTime || "12:00"}:00`).toISOString()
    : null;

  return {
    name: parsed.name,
    slug: parsed.slug,
    starts_at: startsAt,
    location: orNull(parsed.location),
    is_landing_cta: parsed.isLandingCta,
    landing_cta_eyebrow: orNull(parsed.landingCtaEyebrow),
    landing_cta_heading: orNull(parsed.landingCtaHeading),
    landing_cta_body: orNull(parsed.landingCtaBody),
    landing_cta_copy: orNull(parsed.landingCtaCopy),
    rsvp_enabled: parsed.rsvpEnabled,
    rsvp_open: parsed.rsvpOpen,
    show_rsvp_form: parsed.showRsvpForm,
    show_guest_list_column: parsed.showGuestListColumn,
    show_header: parsed.showHeader,
    header_eyebrow: orNull(parsed.headerEyebrow),
    header_title: orNull(parsed.headerTitle),
    header_body: orNull(parsed.headerBody),
    show_photo_board: parsed.showPhotoBoard,
    show_details: parsed.showDetails,
    details_eyebrow: orNull(parsed.detailsEyebrow),
    details_title: orNull(parsed.detailsTitle),
    venue_name: orNull(parsed.venueName),
    venue_body: orNull(parsed.venueBody),
    show_map: parsed.showMap,
    show_on_diary: parsed.showOnDiary,
  };
}

function friendlyError(error: { message: string; code?: string }) {
  // Postgres unique_violation — almost certainly the slug, the only
  // unique column this form writes to.
  if (error.code === "23505") return "That URL slug is already used by another event — pick a different one.";
  return error.message;
}

export async function createEvent(formData: FormData) {
  const parsed = parseEventForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .insert(buildRow(parsed))
    .select("id")
    .single();

  if (error || !data) return { error: friendlyError(error ?? { message: "Couldn't create the event." }) };

  revalidatePath("/diary");
  redirect("/diary");
}

export async function updateEvent(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const parsed = parseEventForm(formData);
  const supabase = await createClient();

  const { error } = await supabase.from("events").update(buildRow(parsed)).eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/diary");
  revalidatePath(`/events/${parsed.slug}`);
  redirect("/diary");
}

export async function deleteEvent(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", parsed);

  revalidatePath("/diary");
  return { error: error?.message ?? null };
}
