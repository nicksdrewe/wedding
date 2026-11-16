import type { SupabaseClient } from "@supabase/supabase-js";
import { OPTION_COSTS_EMBED, readOptionCosts } from "@/lib/options/costs";
import { OPTION_COVER_EMBED, coverImageOf } from "@/lib/options/cover";
import { BIG_DAY_COLOURS, type BigDayColour, type BigDayCost, type BigDayItem, type BigDaySettings, type BigDaySource } from "./types";

type ImageRow = { image_url: string; sort_order: number | null };

function firstIdeaImage(raw: unknown): string | null {
  const images = (Array.isArray(raw) ? raw : raw ? [raw] : []) as ImageRow[];
  if (images.length === 0) return null;
  return [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].image_url;
}

function one<T>(raw: unknown): T | null {
  return ((Array.isArray(raw) ? raw[0] : raw) ?? null) as T | null;
}

function costOf(row: { page_option_costs?: unknown }): BigDayCost | null {
  const c = readOptionCosts(row);
  if (c.costs_hidden) return null;
  if (c.predicted_cost_min == null && c.predicted_cost_max == null && c.actual_cost == null) return null;
  return { min: c.predicted_cost_min, max: c.predicted_cost_max, actual: c.actual_cost, currency: c.currency };
}

export async function loadBigDaySettings(supabase: SupabaseClient): Promise<BigDaySettings> {
  const { data } = await supabase
    .from("big_day_settings")
    .select("start_date, end_date, published")
    .eq("id", true)
    .maybeSingle();
  return {
    startDate: (data?.start_date as string | null) ?? null,
    endDate: (data?.end_date as string | null) ?? null,
    published: Boolean(data?.published),
  };
}

export async function loadBigDayItems(supabase: SupabaseClient): Promise<BigDayItem[]> {
  const { data } = await supabase
    .from("big_day_items")
    .select(
      `id, title, notes, day, start_time, end_time, colour, image_url, page_option_id, idea_id, visible_to_guests,
       page_options(id, ${OPTION_COVER_EMBED}, ${OPTION_COSTS_EMBED}),
       idea_boards(id, idea_board_images(image_url, sort_order))`,
    )
    .order("day")
    .order("start_time", { nullsFirst: true });

  return (data ?? []).map((row) => {
    const option = one<{ page_option_images?: ImageRow[]; page_option_costs?: unknown }>(row.page_options);
    const idea = one<{ idea_board_images?: unknown }>(row.idea_boards);
    const colour = (BIG_DAY_COLOURS as readonly string[]).includes(row.colour) ? (row.colour as BigDayColour) : "moss";
    return {
      id: row.id as string,
      title: row.title as string,
      notes: (row.notes as string | null) ?? null,
      day: row.day as string,
      startTime: row.start_time ? (row.start_time as string).slice(0, 5) : null,
      endTime: row.end_time ? (row.end_time as string).slice(0, 5) : null,
      colour,
      image: (row.image_url as string | null) ?? (option ? coverImageOf(option) : null) ?? (idea ? firstIdeaImage(idea.idea_board_images) : null),
      pageOptionId: (row.page_option_id as string | null) ?? null,
      ideaId: (row.idea_id as string | null) ?? null,
      visibleToGuests: Boolean(row.visible_to_guests),
      cost: option ? costOf(option) : null,
    };
  });
}

export async function loadBigDaySources(supabase: SupabaseClient): Promise<{ chosen: BigDaySource[]; ideas: BigDaySource[] }> {
  const [optionsRes, ideasRes] = await Promise.all([
    supabase
      .from("page_options")
      .select(`id, name, option_groups!inner(title, visible_tag), ${OPTION_COVER_EMBED}, ${OPTION_COSTS_EMBED}`)
      .eq("is_winner", true)
      .is("option_groups.visible_tag", null),
    supabase
      .from("idea_boards")
      .select("id, title, idea_board_images(image_url, sort_order)")
      .is("visible_tag", null)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const chosen: BigDaySource[] = (optionsRes.data ?? []).map((row) => {
    const group = one<{ title: string }>(row.option_groups);
    return {
      kind: "option" as const,
      id: row.id as string,
      title: row.name as string,
      subtitle: group?.title ?? null,
      image: coverImageOf(row as Parameters<typeof coverImageOf>[0]),
      cost: costOf(row),
    };
  });

  const ideas: BigDaySource[] = (ideasRes.data ?? []).map((row) => ({
    kind: "idea" as const,
    id: row.id as string,
    title: row.title as string,
    subtitle: null,
    image: firstIdeaImage(row.idea_board_images),
    cost: null,
  }));

  return { chosen, ideas };
}
