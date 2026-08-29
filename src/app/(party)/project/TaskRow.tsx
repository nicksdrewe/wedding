"use client";

import { useTransition } from "react";
import { toggleTask } from "./actions";

export function TaskRow({
  id,
  title,
  done,
  dueDate,
  ownerName,
}: {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  ownerName: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream-deep/50 px-4 py-3 font-serif text-sm">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => startTransition(() => toggleTask(id, e.target.checked))}
      />
      <span className={done ? "flex-1 line-through text-ink-soft" : "flex-1"}>
        {title}
      </span>
      {ownerName && <span className="text-ink-soft">{ownerName}</span>}
      {dueDate && <span className="text-ink-soft">{dueDate}</span>}
    </li>
  );
}
