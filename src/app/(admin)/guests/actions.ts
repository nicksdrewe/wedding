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

const updateContactSchema = contactSchema.extend({
  id: z.string().uuid(),
  tags: z.string().optional(),
});

function tagsToArray(tags: string | undefined) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function addContact(formData: FormData) {
  const parsed = contactSchema.parse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneEligible: formData.get("plusOneEligible") === "on",
  });

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    full_name: parsed.fullName,
    email: parsed.email || null,
    phone: parsed.phone || null,
    role: parsed.role,
    plus_one_eligible: parsed.plusOneEligible,
  });

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}

export async function updateContact(formData: FormData) {
  const parsed = updateContactSchema.parse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    role: formData.get("role"),
    plusOneEligible: formData.get("plusOneEligible") === "on",
    tags: formData.get("tags") || "",
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.fullName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      role: parsed.role,
      plus_one_eligible: parsed.plusOneEligible,
      tags: tagsToArray(parsed.tags),
    })
    .eq("id", parsed.id);

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}

export async function deleteContact(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", parsed);

  revalidatePath("/guests");
  return { error: error?.message ?? null };
}
