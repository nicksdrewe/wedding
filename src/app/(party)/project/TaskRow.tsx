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
    <li className="flex items-center gap-3 rounded-[10px] border border-ink/10 bg-white px-4 py-3 font-serif text-[13px]">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => startTransition(() => toggleTask(id, e.target.checked))}
      />
      <span className={done ? "flex-1 text-ink-soft line-through" : "flex-1"}>
        {title}
      </span>
      {ownerName && <span className="text-[11px] text-ink-soft">{ownerName}</span>}
      {dueDate && <span className="text-[11px] text-ink-soft">{dueDate}</span>}
    </li>
  );
}
