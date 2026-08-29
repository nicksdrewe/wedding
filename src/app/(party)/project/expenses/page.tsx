import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "./ExpenseForm";
import { SettleButton } from "./SettleButton";

export default async function ExpensesPage() {
  const supabase = await createClient();

  const [{ data: contacts }, { data: expenses }, { data: splits }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name")
      .in("role", ["couple", "wedding_party"])
      .order("full_name"),
    supabase
      .from("expenses")
      .select("id, description, amount, created_at, paid_by_contact_id, contacts(full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("expense_splits")
      .select("id, amount, settled, contact_id, expense_id, contacts(full_name)"),
  ]);

  const paidByContact = new Map<string, number>();
  for (const e of expenses ?? []) {
    if (!e.paid_by_contact_id) continue;
    paidByContact.set(
      e.paid_by_contact_id,
      (paidByContact.get(e.paid_by_contact_id) ?? 0) + Number(e.amount)
    );
  }

  const owedByContact = new Map<string, number>();
  for (const s of splits ?? []) {
    if (s.settled) continue;
    owedByContact.set(s.contact_id, (owedByContact.get(s.contact_id) ?? 0) + Number(s.amount));
  }

  const balances = (contacts ?? []).map((c) => {
    const paid = paidByContact.get(c.id) ?? 0;
    const owed = owedByContact.get(c.id) ?? 0;
    return { name: c.full_name, balance: paid - owed };
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link href="/project" className="font-serif text-sm text-ink-soft underline">
          ← Project Management
        </Link>
      </div>
      <h1 className="mt-2 font-script text-4xl">Expense Splitting</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Log a cost, split it evenly among whoever&rsquo;s in on it, settle up
        when it&rsquo;s paid back.
      </p>

      <ExpenseForm contacts={contacts ?? []} />

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold">Balances</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {balances.map((b) => (
            <li
              key={b.name}
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-cream-deep/50 px-4 py-3 font-serif text-sm"
            >
              <span>{b.name}</span>
              <span
                className={
                  b.balance > 0
                    ? "text-green-700"
                    : b.balance < 0
                    ? "text-red-700"
                    : "text-ink-soft"
                }
              >
                {b.balance > 0 && "owed £"}
                {b.balance < 0 && "owes £"}
                {b.balance === 0 && "settled up"}
                {b.balance !== 0 && Math.abs(b.balance).toFixed(2)}
              </span>
            </li>
          ))}
          {balances.length === 0 && (
            <p className="font-serif text-sm text-ink-soft">No one to split with yet.</p>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold">Expenses</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {(expenses ?? []).map((e) => {
            const payer = Array.isArray(e.contacts) ? e.contacts[0] : e.contacts;
            const mySplits = (splits ?? []).filter((s) => s.expense_id === e.id);
            return (
              <li
                key={e.id}
                className="rounded-2xl border border-ink/10 bg-cream-deep/50 p-4 font-serif text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{e.description}</span>
                  <span>£{Number(e.amount).toFixed(2)}</span>
                </div>
                <p className="mt-1 text-ink-soft">Paid by {payer?.full_name ?? "—"}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {mySplits.map((s) => {
                    const splitContact = (Array.isArray(s.contacts) ? s.contacts[0] : s.contacts) as
                      | { full_name: string }
                      | undefined;
                    const name = splitContact?.full_name;
                    return (
                      <li key={s.id} className="flex items-center justify-between text-xs text-ink-soft">
                        <span>
                          {name} — £{Number(s.amount).toFixed(2)}{" "}
                          {s.settled ? "(settled)" : ""}
                        </span>
                        {!s.settled && <SettleButton splitId={s.id} />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {(!expenses || expenses.length === 0) && (
            <p className="font-serif text-sm text-ink-soft">No expenses logged yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
