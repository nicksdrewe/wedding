"use server";

import { createClient } from "@/lib/supabase/server";
import { getWeddingId } from "@/lib/wedding/current";

// The access code is checked by the database (0057); the codes themselves
// never reach the browser.
export async function checkGateCode(code: string): Promise<boolean> {
  const weddingId = await getWeddingId();
  if (!weddingId || !code || code.length > 64) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_check_gate_code", { p_wedding: weddingId, p_code: code });
  return data === true;
}

export async function weddingHasGate(): Promise<boolean> {
  const weddingId = await getWeddingId();
  if (!weddingId) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_wedding_has_gate", { p_wedding: weddingId });
  // Before 0057 is run the function doesn't exist: keep the gate on, as it was.
  return error ? true : data === true;
}
