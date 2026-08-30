"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { generateInviteLink } from "@/lib/invite/actions";

export function InviteLinkCard({ initialToken }: { initialToken: string | null }) {
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
    <div className="mt-8 rounded-[10px] border border-ink/10 bg-cream-deep/30 p-5">
      <p className="flex items-center gap-1.5 font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
        <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
        Invite link
      </p>
      <p className="mt-1 max-w-lg font-reading text-sm text-ink-soft">
        One link for everyone on the list — anyone who follows it skips the
        site&rsquo;s access code entirely. Share the same link with all of
        your invitees; there&rsquo;s no need to generate a new one per
        person.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
      </div>

      {error && <p className="mt-2 font-reading text-xs text-alert">{error}</p>}
      {token && (
        <p className="mt-3 font-reading text-xs text-ink-soft/70 italic">
          Regenerating replaces this link — anyone still using the old one
          will be asked for the access code again.
        </p>
      )}
    </div>
  );
}
