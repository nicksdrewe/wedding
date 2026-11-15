import { MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { CommentThread } from "./CommentThread";
import { ReactionBar } from "./ReactionBar";
import { EMPTY_FEEDBACK, type FeedbackData, type FeedbackTargetType } from "@/lib/feedback/types";

// Votes + comments for one item, ready to drop under a card. Reactions can be
// switched off (tasks only take comments). With canInteract false (a guest)
// everything is read-only.
export function Feedback({
  targetType,
  targetId,
  data = EMPTY_FEEDBACK,
  canInteract,
  canModerate,
  revalidate,
  showReactions = true,
  className = "",
}: {
  targetType: FeedbackTargetType;
  targetId: string;
  data?: FeedbackData;
  canInteract: boolean;
  canModerate: boolean;
  revalidate: string;
  showReactions?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start gap-2 ${className}`}>
      {showReactions && (
        <ReactionBar
          targetType={targetType}
          targetId={targetId}
          data={data}
          canInteract={canInteract}
          revalidate={revalidate}
        />
      )}
      <CommentThread
        targetType={targetType}
        targetId={targetId}
        comments={data.comments}
        canInteract={canInteract}
        canModerate={canModerate}
        revalidate={revalidate}
      />
    </div>
  );
}

// A small read-only line for a collapsed card: "👍 2 · 👎 1 · 💬 3". Shows
// nothing when there is nothing to show.
export function FeedbackSummary({ data }: { data?: FeedbackData }) {
  if (!data || (data.up === 0 && data.down === 0 && data.comments.length === 0)) return null;
  const item = "inline-flex items-center gap-1";
  return (
    <p className="mt-1 flex items-center gap-3 font-serif text-[11px] text-ink-soft/80 tabular-nums">
      {data.up > 0 && (
        <span className={item}>
          <ThumbsUp className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Thumbs up</span>
          {data.up}
        </span>
      )}
      {data.down > 0 && (
        <span className={item}>
          <ThumbsDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Thumbs down</span>
          {data.down}
        </span>
      )}
      {data.comments.length > 0 && (
        <span className={item}>
          <MessageCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Comments</span>
          {data.comments.length}
        </span>
      )}
    </p>
  );
}
