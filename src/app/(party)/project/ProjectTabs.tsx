import Link from "next/link";

export function ProjectTabs({ active }: { active: "project" | "expenses" }) {
  const tab = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={`flex-1 rounded-full px-6 py-2.5 text-center font-serif text-xs tracking-wide transition ${
        active === key ? "bg-ink text-cream" : "text-ink-soft"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mt-7 inline-flex gap-0.5 rounded-full bg-cream-deep p-1">
      {tab("/project", "project", "Project")}
      {tab("/project/expenses", "expenses", "Expenses")}
    </div>
  );
}
