// Task priority: a small fixed scale, lowest to highest. Stored as a number
// (0041_task_priority_and_done_date.sql) so it sorts and filters simply.
// Pure and client-safe.

export const PRIORITIES = [
  { value: 0, label: "Optional", tone: "chip" },
  { value: 1, label: "Not urgent", tone: "chip" },
  { value: 2, label: "Normal", tone: "chip" },
  { value: 3, label: "Important", tone: "chip-sec" },
  { value: 4, label: "Urgent", tone: "chip-urgent" },
] as const;

export const DEFAULT_PRIORITY = 2;

export function priorityLabel(value: number) {
  return PRIORITIES.find((p) => p.value === value)?.label ?? "Normal";
}

export function priorityTone(value: number) {
  return PRIORITIES.find((p) => p.value === value)?.tone ?? "chip";
}

export function parsePriority(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? n : DEFAULT_PRIORITY;
}

export type BoardTask = {
  id: string;
  title: string;
  done: boolean;
  priority: number;
  dueDate: string | null;
  createdAt: string;
  doneAt: string | null;
  ownerContactId: string | null;
  ownerName: string | null;
};

type TaskRowData = {
  id: string;
  title: string;
  status: string;
  priority: number | null;
  due_date: string | null;
  created_at: string;
  done_at: string | null;
  owner_contact_id: string | null;
  contacts: { full_name: string } | { full_name: string }[] | null;
};

// The page's task query (select list below) -> what the board component takes.
export const TASK_SELECT =
  "id, title, notes, status, priority, due_date, created_at, done_at, owner_contact_id, contacts(full_name)";

export function toBoardTask(t: TaskRowData): BoardTask {
  const owner = Array.isArray(t.contacts) ? t.contacts[0] : t.contacts;
  return {
    id: t.id,
    title: t.title,
    done: t.status === "done",
    priority: t.priority ?? DEFAULT_PRIORITY,
    dueDate: t.due_date,
    createdAt: t.created_at,
    doneAt: t.done_at,
    ownerContactId: t.owner_contact_id,
    ownerName: owner?.full_name ?? null,
  };
}
