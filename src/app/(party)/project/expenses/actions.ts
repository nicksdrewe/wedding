"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Split amounts are computed client-side (ExpenseForm) for all three modes
// — even, by percentage, and by exact amount — and always submitted as the
// same {contactId, amount}[] shape, so this action has exactly one code
// path regardless of which mode the couple used. It re-validates the
// arithmetic server-side rather than trusting the client's math outright,
// since this is money and a rounding bug or stale state in the form
// shouldn't be able to silently log a split that doesn't add up.
const splitEntrySchema = z.object({
  contactId: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  paidByContactId: z.string().uuid(),
  splits: z
    .string()
    .transform((raw, ctx) => {
      try {
        return z.array(splitEntrySchema).min(1).parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Split data was malformed." });
        return z.NEVER;
      }
    }),
});

export async function logExpense(formData: FormData) {
  const parsed = expenseSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paidByContactId: formData.get("paidByContactId"),
    splits: formData.get("splits"),
  });

  // Rounding a two-decimal split across several people rarely lands on the
  // total to the last penny (e.g. £10 / 3 = £3.33 × 3 = £9.99) — a few
  // pence of slack per split avoids rejecting exactly the kind of split
  // this form is meant to make easy.
  const tolerance = Math.max(0.02, parsed.splits.length * 0.01);
  const splitTotal = parsed.splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(splitTotal - parsed.amount) > tolerance) {
    return {
      error: `Split amounts add up to £${splitTotal.toFixed(2)}, not the £${parsed.amount.toFixed(2)} total — adjust them so they match.`,
    };
  }

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

  if (error) return { error: error.message };
  if (!expense) return { error: "Couldn't create the expense — try again." };

  const { error: splitsError } = await supabase.from("expense_splits").insert(
    parsed.splits.map((s) => ({
      expense_id: expense.id,
      contact_id: s.contactId,
      amount: Math.round(s.amount * 100) / 100,
    }))
  );
  if (splitsError) return { error: splitsError.message };

  revalidatePath("/project/expenses");
  return { error: null };
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
