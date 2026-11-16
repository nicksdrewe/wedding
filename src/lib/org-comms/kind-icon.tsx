import { Mail, Send, StickyNote } from "lucide-react";

export function CommKindIcon({ kind }: { kind: string }) {
  if (kind === "received") return <Mail strokeWidth={2.5} aria-hidden="true" />;
  if (kind === "sent") return <Send strokeWidth={2.5} aria-hidden="true" />;
  return <StickyNote strokeWidth={2.5} aria-hidden="true" />;
}

export function commKindLabel(kind: string) {
  if (kind === "received") return "Email received";
  if (kind === "sent") return "Email sent";
  return "Note";
}
