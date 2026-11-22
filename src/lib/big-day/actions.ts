"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { notifyBigDayPublished } from "@/lib/push/send";
import { BIG_DAY_COLOURS } from "./types";
import { daysBetween, isDay, MAX_SPAN_DAYS } from "./dates";

type Result = { error: string | null };

const dayField = z.string().refine(isDay, "Choose a valid day.");
const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use a valid time.")
  .nullable();

const itemSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Give it a title.").max(160, "Keep the title under 160 characters."),
    notes: z.string().trim().max(4000, "Keep the notes under 4,000 characters.").nullable(),
    day: dayField,
    startTime: timeField,
    endTime: timeField,
    colour: z.enum(BIG_DAY_COLOURS),
    visibleToGuests: z.boolean(),
    pageOptionId: z.string().uuid().nullable().optional(),
    ideaId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => !(v.startTime && v.endTime) || v.endTime.slice(0, 5) > v.startTime.slice(0, 5), {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

export type SaveItemInput = z.input<typeof itemSchema>;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the fields and try again.";
}

const DENIED = "You can't change the schedule.";

// Creates an item (no id) or updates one (id). Who may is decided by the
// database; a refusal comes back as a plain sentence.
export async function saveBigDayItem(input: SaveItemInput): Promise<Result & { id?: string }> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const fields = {
    title: v.title,
    notes: v.notes ? v.notes : null,
    day: v.day,
    start_time: v.startTime,
    end_time: v.endTime,
    colour: v.colour,
    visible_to_guests: v.visibleToGuests,
  };

  if (v.id) {
    const { data, error } = await supabase.from("big_day_items").update(fields).eq("id", v.id).select("id");
    if (error || !data || data.length === 0) return { error: DENIED };
    revalidatePath("/big-day");
    return { error: null, id: v.id };
  }

  const { data, error } = await supabase
    .from("big_day_items")
    .insert({ ...fields, page_option_id: v.pageOptionId ?? null, idea_id: v.ideaId ?? null })
    .select("id")
    .single();
  if (error || !data) return { error: DENIED };
  revalidatePath("/big-day");
  return { error: null, id: data.id };
}

export async function moveBigDayItem(id: string, day: string): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid(), day: dayField }).safeParse({ id, day });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("big_day_items").update({ day }).eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: DENIED };
  revalidatePath("/big-day");
  return { error: null };
}

export async function deleteBigDayItem(id: string): Promise<Result> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "That item couldn't be found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("big_day_items").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: DENIED };
  revalidatePath("/big-day");
  return { error: null };
}

export async function saveBigDayDates(startDate: string, endDate: string): Promise<Result> {
  const parsed = z.object({ startDate: dayField, endDate: dayField }).safeParse({ startDate, endDate });
  if (!parsed.success) return { error: "Choose a first and last day." };
  const span = daysBetween(startDate, endDate);
  if (span < 0) return { error: "The last day can't be before the first day." };
  if (span > MAX_SPAN_DAYS - 1) return { error: `Choose at most ${MAX_SPAN_DAYS} days.` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("big_day_settings")
    .update({ start_date: startDate, end_date: endDate })
    .eq("id", true)
    .select("id");
  if (error || !data || data.length === 0) return { error: DENIED };
  revalidatePath("/big-day");
  return { error: null };
}

export async function setBigDayPublished(published: boolean): Promise<Result> {
  const parsed = z.boolean().safeParse(published);
  if (!parsed.success) return { error: "Something went wrong. Try again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("big_day_settings")
    .update({ published })
    .eq("id", true)
    .select("id");
  if (error) {
    if (/only the couple/i.test(error.message)) return { error: "Only the couple can publish the schedule." };
    return { error: "Couldn't change that. Try again." };
  }
  if (!data || data.length === 0) return { error: "Only the couple can publish the schedule." };
  if (published) {
    const actorId = (await getCurrentProfile())?.id ?? null;
    after(() => notifyBigDayPublished(actorId));
  }
  revalidatePath("/big-day");
  return { error: null };
}
