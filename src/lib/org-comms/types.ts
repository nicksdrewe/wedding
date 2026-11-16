// Shared types and small helpers for "Organising comms" (org_comms table,
// supabase/migrations/0043_organising_comms.sql).

export type CommKind = "received" | "sent" | "note";

export const COMM_KINDS: { value: CommKind; label: string }[] = [
  { value: "received", label: "Received an email" },
  { value: "sent", label: "Sent an email" },
  { value: "note", label: "Note" },
];

export const IMPORTANCES: { value: 0 | 1 | 2; label: string }[] = [
  { value: 0, label: "Minor" },
  { value: 1, label: "Standard" },
  { value: 2, label: "Milestone" },
];

export type OrgComm = {
  id: string;
  kind: CommKind;
  counterparty: string | null;
  subject: string;
  body: string | null;
  occurred_on: string;
  importance: number;
  category_page_id: string | null;
  page_option_id: string | null;
  created_by: string;
  created_at: string;
  author_name: string | null;
  category_title: string | null;
  option_name: string | null;
};

export type CommCategory = { id: string; title: string; parent_id: string | null };
export type CommOption = { id: string; name: string; groupTitle: string | null; categoryId: string | null };

export const COMM_ROW_COLUMNS =
  "id, kind, counterparty, subject, body, occurred_on, importance, category_page_id, page_option_id, created_by, created_at";

export function commShortTitle(c: { kind: string; counterparty: string | null; subject: string }): string {
  const who = c.counterparty?.trim();
  if (c.kind === "received") return who ? `Email received from ${who}` : "Email received";
  if (c.kind === "sent") return who ? `Email sent to ${who}` : "Email sent";
  return c.subject;
}

export function importanceToTier(importance: number): "minor" | "standard" | "milestone" {
  if (importance >= 2) return "milestone";
  if (importance === 1) return "standard";
  return "minor";
}
