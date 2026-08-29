"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  paidByContactId: z.string().uuid(),
  splitAmong: z.array(z.string().uuid()).min(1),
});

export async function logExpense(formData: FormData) {
  const parsed = expenseSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paidByContactId: formData.get("paidByContactId"),
    splitAmong: formData.getAll("splitAmong"),
  });

  const supabase = await createClient();

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      description: parsed.description,
      amount: parsed.amount,
      paid_by_contact_id: parsed.paidByContactId,
    })
    .select("id")
    .single();

  if (error || !expense) return;

  const share = Math.round((parsed.amount / parsed.splitAmong.length) * 100) / 100;
  await supabase.from("expense_splits").insert(
    parsed.splitAmong.map((contactId) => ({
      expense_id: expense.id,
      contact_id: contactId,
      amount: share,
    }))
  );

  revalidatePath("/project/expenses");
}

export async function markSplitSettled(splitId: string) {
  const supabase = await createClient();
  await supabase.from("expense_splits").update({ settled: true }).eq("id", splitId);
  revalidatePath("/project/expenses");
}
