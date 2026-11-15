// Client-safe types and helpers for the account column on the guest list.
// No server imports, so "use client" components can use them.

export type AccountState =
  | "none" // has an email, no account yet
  | "invited" // account exists, has never signed in
  | "active" // has signed in at least once
  | "disabled" // switched off by the couple
  | "no-email" // can't have an account without an email
  | "duplicate"; // another contact shares this email — resolve first

export type AccountStatus = {
  state: AccountState;
  lastSignInAt: string | null;
};

// "3 days ago" style, no dependencies. Dates only matter to the day.
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
