"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { addComment, deleteComment, updateComment } from "@/lib/feedback/actions";
import type { FeedbackComment, FeedbackTargetType } from "@/lib/feedback/types";
import { timeAgo } from "@/lib/accounts/types";

const INPUT =
  "field w-full font-reading";
const LINK = "font-serif text-[11px] tracking-[0.06em] uppercase";

function CommentRow({
  comment,
  canModerate,
  revalidate,
}: {
  comment: FeedbackComment;
  canModerate: boolean;
  revalidate: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateComment(comment.id, draft, revalidate);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm("Delete this comment? This can not be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteComment(comment.id, revalidate);
      if (result.error) setError(result.error);
    });
  }

  return (
    <li className="rounded-[8px] bg-cream/60 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 font-serif text-[11px] text-ink-soft">
        <span className="font-semibold text-ink">{comment.authorName}</span>
        <span>{timeAgo(comment.createdAt)}</span>
        {comment.editedAt && <span className="italic">(edited)</span>}
      </div>

      {editing ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={3}
            className={INPUT}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending || !draft.trim()}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
                setError(null);
              }}
              className={`${LINK} text-ink-soft hover:text-ink`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-0.5 font-reading text-[13px] whitespace-pre-wrap text-ink">{comment.body}</p>
      )}

      {!editing && (comment.mine || canModerate) && (
        <div className="mt-1 flex gap-3">
          {comment.mine && (
            <button type="button" onClick={() => setEditing(true)} className={`${LINK} text-ink-soft hover:text-sec`}>
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className={`${LINK} text-alert/80 hover:text-alert disabled:opacity-60`}
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
      {error && <p className="mt-1 font-reading text-[11px] text-alert">{error}</p>}
    </li>
  );
}

// A collapsed "💬 3" that opens the conversation in place: the comments so
// far, and a box to add yours. Delete shows on your own comments and — where
// the database allows it — on everyone's for the couple / a board's admin.
export function CommentThread({
  targetType,
  targetId,
  comments,
  canInteract,
  canModerate,
  revalidate,
  startOpen = false,
}: {
  targetType: FeedbackTargetType;
  targetId: string;
  comments: FeedbackComment[];
  canInteract: boolean;
  canModerate: boolean;
  revalidate: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addComment(targetType, targetId, draft, revalidate);
      if (result.error) setError(result.error);
      else setDraft("");
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn btn-quiet btn-sm inline-flex"
      >
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
        {comments.length === 0 ? (canInteract ? "Comment" : "0") : comments.length}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {comments.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {comments.map((c) => (
                <CommentRow key={c.id} comment={c} canModerate={canModerate} revalidate={revalidate} />
              ))}
            </ul>
          )}
          {comments.length === 0 && !canInteract && (
            <p className="font-reading text-[12px] text-ink-soft italic">No comments yet.</p>
          )}
          {canInteract && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) add();
              }}
              className="flex flex-col gap-1.5"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                className={INPUT}
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pending || !draft.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {pending ? "Posting…" : "Post"}
                </button>
                {error && <p className="font-reading text-[11px] text-alert">{error}</p>}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
