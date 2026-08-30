import {
  CircleCheck,
  CircleDashed,
  CircleX,
  type LucideIcon,
} from "lucide-react";

export const ROLE_BADGE: Record<string, string> = {
  couple: "bg-accent text-cream",
  wedding_party: "bg-accent/12 text-accent border border-accent/25",
  family: "bg-ink/8 text-ink-soft border border-ink/15",
  guest: "bg-cream-deep text-ink-soft border border-ink/10",
};

export const ROLE_LABEL: Record<string, string> = {
  couple: "Couple",
  wedding_party: "Wedding Party",
  family: "Family",
  guest: "Guest",
};

export const RSVP_STYLE: Record<string, { className: string; icon: LucideIcon; label: string }> = {
  attending: { className: "bg-accent/12 text-accent", icon: CircleCheck, label: "Attending" },
  declined: { className: "bg-alert/12 text-alert", icon: CircleX, label: "Declined" },
  pending: { className: "bg-cream-deep text-ink-soft", icon: CircleDashed, label: "Pending" },
};
