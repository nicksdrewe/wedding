import { createClient } from "@/lib/supabase/server";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { InView } from "@/components/motion-primitives/in-view";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseForm } from "./ExpenseForm";
import { SettleButton } from "./SettleButton";
import { ProjectTabs } from "../ProjectTabs";

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
      <PageHeader
        eyebrow="Planning"
        title="Expense Splitting"
        description="Log a cost, split it evenly among whoever's in on it, settle up when it's paid back."
      />

      <ProjectTabs active="expenses" />

      <div className="mt-9">
        <ExpenseForm contacts={contacts ?? []} />
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-[15px] font-semibold tracking-wide">Balances</h2>
        <ul className="mt-3 flex max-w-[520px] flex-col gap-2">
          {balances.map((b, i) => (
            <InView
              key={b.name}
              as="li"
              once
              className="flex items-center justify-between rounded-[10px] border border-ink/10 bg-white px-4.5 py-3.5 font-serif text-[13px] transition-colors duration-150 hover:border-accent/40"
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <span>{b.name}</span>
              <span
                className={
                  b.balance > 0 ? "text-accent" : b.balance < 0 ? "text-alert" : "text-ink-soft"
                }
              >
                {b.balance > 0 && "owed £"}
                {b.balance < 0 && "owes £"}
                {b.balance === 0 && "settled up"}
                {b.balance !== 0 && (
                  <AnimatedNumber value={Math.abs(b.balance)} springOptions={{ bounce: 0 }} />
                )}
              </span>
            </InView>
          ))}
        </ul>
        {balances.length === 0 && (
          <EmptyState className="mt-3 max-w-[520px]" title="No one to split with yet" />
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-[15px] font-semibold tracking-wide">Expenses</h2>
        <ul className="mt-3 flex max-w-[640px] flex-col gap-2.5">
          {(expenses ?? []).map((e) => {
            const payer = Array.isArray(e.contacts) ? e.contacts[0] : e.contacts;
            const mySplits = (splits ?? []).filter((s) => s.expense_id === e.id);
            return (
              <li
                key={e.id}
                className="rounded-[10px] border border-ink/10 bg-white p-4 transition-colors duration-150 hover:border-accent/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-semibold">{e.description}</span>
                  <span className="font-serif text-sm">£{Number(e.amount).toFixed(2)}</span>
                </div>
                <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
                  Paid by {payer?.full_name ?? "—"}
                </p>
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-ink/8 pt-2.5">
                  {mySplits.map((s) => {
                    const splitContact = (Array.isArray(s.contacts) ? s.contacts[0] : s.contacts) as
                      | { full_name: string }
                      | undefined;
                    const name = splitContact?.full_name;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between font-serif text-xs text-ink-soft"
                      >
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
        </ul>
        {(!expenses || expenses.length === 0) && (
          <EmptyState className="mt-3 max-w-[640px]" title="No expenses logged yet" />
        )}
      </section>
    </div>
  );
}
