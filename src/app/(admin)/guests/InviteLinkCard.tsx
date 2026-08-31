"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { generateInviteLink } from "@/lib/invite/actions";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/motion-primitives/dialog";

// The compact trigger the guests page renders inline — the actual link UI
// only ever mounts inside the popup once opened, same shape as before this
// became a modal.
export function InviteLinkButton({ initialToken }: { initialToken: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 font-serif text-xs font-medium text-ink-soft transition hover:border-ink/30 hover:text-ink"
      >
        <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
        Invite
      </DialogTrigger>
      <DialogContent className="w-[420px] max-w-[90vw] bg-cream p-6">
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle className="font-serif text-base font-semibold text-ink">Invite link</DialogTitle>
            <InfoTooltip text="One link for everyone on the list — anyone who follows it skips the site's access code entirely. Share the same link with all of your invitees; there's no need to generate a new one per person." />
          </div>
        </DialogHeader>
        <InviteLinkCard initialToken={initialToken} />
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkCard({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  // Left blank until mount, then filled from window.location.origin — an
  // absolute URL depends on the browser's own host, which the server
  // rendering this page doesn't know, so filling it in during SSR would
  // either be wrong or (worse) a hydration mismatch.
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = token && origin ? `${origin}/i/${token}` : null;

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generateInviteLink();
      if (result.error) {
        setError(result.error);
        return;
      }
      setToken(result.token);
    });
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {token ? (
          <>
            <code className="min-w-0 flex-1 truncate rounded-full border border-ink/10 bg-white px-4 py-2 font-mono text-xs text-ink">
              {url || "…"}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!url}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 font-serif text-xs font-medium text-cream transition hover:bg-ink/85 disabled:opacity-60"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        ) : (
          <p className="flex-1 font-reading text-sm text-ink-soft italic">No active link yet.</p>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 font-serif text-xs font-medium text-ink-soft transition hover:border-ink/30 hover:text-ink disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} strokeWidth={2} />
          {token ? "Regenerate" : "Generate link"}
        </button>
        {token && (
          <InfoTooltip text="Regenerating replaces this link — anyone still using the old one will be asked for the access code again." />
        )}
      </div>

      {error && <p className="mt-2 font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}
