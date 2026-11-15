"use client";

import { useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { setReaction } from "@/lib/feedback/actions";
import type { FeedbackData, FeedbackTargetType } from "@/lib/feedback/types";

function who(names: string[]) {
  return names.length > 0 ? names.join(", ") : "No one yet";
}

// Thumbs up / thumbs down. Your own vote is filled in; tapping it again takes
// it back, tapping the other switches. Updates instantly and rolls back with
// a message if the server says no. With canInteract off (a guest) it shows
// the counts and nothing to press.
export function ReactionBar({
  targetType,
  targetId,
  data,
  canInteract,
  revalidate,
}: {
  targetType: FeedbackTargetType;
  targetId: string;
  data: FeedbackData;
  canInteract: boolean;
  revalidate: string;
}) {
  const [vote, setVote] = useState<1 | -1 | 0>(data.myVote);
  const [counts, setCounts] = useState({ up: data.up, down: data.down });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Names list in the tooltip should include the viewer's just-made vote
  // without waiting for a reload; the rest comes from the server.
  const others = {
    up: data.upNames.slice(data.myVote === 1 ? 1 : 0),
    down: data.downNames.slice(data.myVote === -1 ? 1 : 0),
  };

  function choose(next: 1 | -1) {
    if (!canInteract || pending) return;
    const target: 1 | -1 | 0 = vote === next ? 0 : next;
    const prev = { vote, counts };
    // Optimistic: remove the old vote's count, add the new one.
    setCounts((c) => ({
      up: c.up - (vote === 1 ? 1 : 0) + (target === 1 ? 1 : 0),
      down: c.down - (vote === -1 ? 1 : 0) + (target === -1 ? 1 : 0),
    }));
    setVote(target);
    setError(null);
    startTransition(async () => {
      const result = await setReaction(targetType, targetId, target, revalidate);
      if (result.error) {
        setVote(prev.vote);
        setCounts(prev.counts);
        setError(result.error);
      }
    });
  }

  const base =
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-serif text-xs tabular-nums transition-colors";
  const idle = "border-ink/20 text-ink-soft hover:border-ink/40 hover:text-ink";
  const active = "border-accent bg-accent text-cream";

  const upTitle = `Thumbs up: ${who(vote === 1 ? ["You", ...others.up] : others.up)}`;
  const downTitle = `Thumbs down: ${who(vote === -1 ? ["You", ...others.down] : others.down)}`;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-1.5">
        {canInteract ? (
          <>
            <button
              type="button"
              onClick={() => choose(1)}
              aria-pressed={vote === 1}
              aria-label={`Thumbs up, ${counts.up}`}
              title={upTitle}
              disabled={pending}
              className={`${base} ${vote === 1 ? active : idle} disabled:opacity-70`}
            >
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
              {counts.up}
            </button>
            <button
              type="button"
              onClick={() => choose(-1)}
              aria-pressed={vote === -1}
              aria-label={`Thumbs down, ${counts.down}`}
              title={downTitle}
              disabled={pending}
              className={`${base} ${vote === -1 ? "border-alert bg-alert text-cream" : idle} disabled:opacity-70`}
            >
              <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
              {counts.down}
            </button>
          </>
        ) : (
          <>
            <span title={upTitle} className={`${base} border-transparent text-ink-soft`}>
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
              {counts.up}
            </span>
            <span title={downTitle} className={`${base} border-transparent text-ink-soft`}>
              <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
              {counts.down}
            </span>
          </>
        )}
      </div>
      {error && <p className="font-reading text-[11px] text-alert">{error}</p>}
    </div>
  );
}
