"use server";

import { getCurrentProfile } from "@/lib/auth/roles";
import { resolvePlace, type Place } from "./resolve";

// Looks up a postcode, address, place name or Google Maps link for the
// location box. Signed-in people only (it calls outside services).
export async function findPlace(input: string): Promise<{ place: Place | null; error: string | null }> {
  if (!(await getCurrentProfile())) return { place: null, error: "Sign in first." };
  if (!input.trim()) return { place: null, error: null };
  try {
    const place = await resolvePlace(input);
    return place
      ? { place, error: null }
      : { place: null, error: "Couldn't find that. Try a postcode, a fuller address, or paste a Google Maps link." };
  } catch {
    return { place: null, error: "The map lookup didn't answer. Try again in a moment." };
  }
}
