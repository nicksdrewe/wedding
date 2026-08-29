"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export async function setPassword(
  _prevState: { error: string | null; success: boolean },
  formData: FormData
): Promise<{ error: string | null; success: boolean }> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message, success: false };

  return { error: null, success: true };
}
