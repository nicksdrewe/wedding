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

// Edit is deliberately narrower than create: it updates the expense's own
// description/amount/payer, not the split-among set. Splits are per-contact
// amounts that can already be individually settled (SettleButton) — silently
// recomputing them on every edit would re-open settled splits or reassign
// who owes what without anyone choosing that. Recording a corrected expense
// still leaves the split list as the record of who owes what against it.
const updateExpenseSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  paidByContactId: z.string().uuid(),
});

export async function updateExpense(formData: FormData) {
  const parsed = updateExpenseSchema.parse({
    id: formData.get("id"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    paidByContactId: formData.get("paidByContactId"),
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      description: parsed.description,
      amount: parsed.amount,
      paid_by_contact_id: parsed.paidByContactId,
    })
    .eq("id", parsed.id);

  revalidatePath("/project/expenses");
  return { error: error?.message ?? null };
}

export async function deleteExpense(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  // expense_splits.expense_id -> ON DELETE CASCADE (0001): this also removes
  // every split tied to the expense, settled or not.
  const { error } = await supabase.from("expenses").delete().eq("id", parsed);

  revalidatePath("/project/expenses");
  return { error: error?.message ?? null };
}
