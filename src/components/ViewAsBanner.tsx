"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

// Reminder shown on every page while the couple is viewing the site as
// someone else. Purely a reminder: it reads a display-only cookie, and the
// actual protections (read-only, 30-minute limit, restoring the couple's own
// session) are enforced server-side in middleware and api/view-as/*.
//
// Rendered from the root layout so it appears on public pages too — the
// borrowed session is browser-wide, not limited to the hub.
export function ViewAsBanner() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const match = document.cookie.split("; ").find((c) => c.startsWith("va-ui="));
      if (!match) return setName(null);
      try {
        // Encoded once by us and once more by the cookie layer.
        setName(decodeURIComponent(decodeURIComponent(match.slice("va-ui=".length))));
      } catch {
        setName("someone else");
      }
    };
    read();
    // Client-side navigations don't re-mount the root layout, so re-check
    // periodically — notably so the banner disappears once the time is up.
    const timer = setInterval(read, 15_000);
    return () => clearInterval(timer);
  }, []);

  if (!name) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-cream/15 bg-ink px-4 py-2.5 text-center font-serif text-xs text-cream shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
    >
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-accent-soft" strokeWidth={2} aria-hidden="true" />
        <span>
          Viewing as <strong className="font-semibold">{name}</strong>
          <span className="text-cream/65"> · read-only · ends automatically after 30 minutes</span>
        </span>
      </span>
      {/* Plain link, not client navigation: the exit route swaps cookies and
          needs a full page load afterwards. */}
      <a
        href="/api/view-as/stop"
        className="rounded-full bg-cream px-4 py-1.5 font-medium text-ink transition-colors hover:bg-white"
      >
        Exit view
      </a>
    </div>
  );
}
