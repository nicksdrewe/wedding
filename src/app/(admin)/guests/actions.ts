"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.enum(["couple", "family", "wedding_party", "guest"]),
  plusOneEligible: z.boolean(),
});

export async function addContact(formData: FormData) {
  const parsed = contactSchema.parse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneEligible: formData.get("plusOneEligible") === "on",
  });

  const supabase = await createClient();
  await supabase.from("contacts").insert({
    full_name: parsed.fullName,
    email: parsed.email || null,
    phone: parsed.phone || null,
    role: parsed.role,
    plus_one_eligible: parsed.plusOneEligible,
  });

  revalidatePath("/guests");
}
