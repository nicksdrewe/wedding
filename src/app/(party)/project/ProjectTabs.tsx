import Link from "next/link";

export function ProjectTabs({ active }: { active: "project" | "expenses" }) {
  const tab = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-full px-6 text-center font-serif text-[13px] tracking-wide transition-all duration-200 ${
        active === key ? "bg-sec text-white shadow-[0_6px_16px_rgba(24,38,28,0.25)]" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="surface surface-sunken -mt-3 mb-8 inline-flex gap-0.5 !rounded-full p-1">
      {tab("/project", "project", "Planning")}
      {tab("/project/expenses", "expenses", "Expenses")}
    </div>
  );
}
