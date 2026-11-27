"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteWedding } from "@/lib/wedding/actions";

// The last thing in settings: delete the whole wedding. A warning that says
// exactly what goes, and the wedding's address must be typed to confirm.
export function DeleteWedding({ slug, displayName }: { slug: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  const matches = typed.trim().toLowerCase() === slug;

  function confirm() {
    setError(null);
    start(async () => {
      const r = await deleteWedding(typed);
      if (r.error) setError(r.error);
      else window.location.href = r.goTo ?? "/";
    });
  }

  return (
    <section className="surface mt-10 border-alert/30 p-6">
      <p className="eyebrow !text-alert">Delete this wedding</p>
      <p className="mt-2 max-w-xl font-reading text-[15px] text-ink-soft">
        Removes the whole site at {slug}: every guest, reply, plan, cost, message, photo and setting, and the sign-ins of
        anyone who was only part of this wedding. It can&rsquo;t be undone.
      </p>
      <button type="button" className="btn btn-danger mt-4" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete this wedding
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-night/50 backdrop-blur-[2px]"
            onClick={() => !pending && setOpen(false)}
          />
          <div className="surface surface-raised relative w-full max-w-md !rounded-[24px] p-6">
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-alert/12 text-alert">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id="del-title" className="mt-4 font-title text-[26px] leading-tight">
              Delete {displayName}&rsquo;s wedding for good?
            </h2>
            <p className="mt-2 font-reading text-[15px] text-ink-soft">This is permanent. It deletes, straight away:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 font-reading text-[14.5px] text-ink-soft">
              <li>the guest list, every RSVP and dietary note</li>
              <li>every plan, option, cost, comment, task and diary date</li>
              <li>messages sent and replies received</li>
              <li>uploaded photos</li>
              <li>sign-ins of people who aren&rsquo;t part of another wedding</li>
            </ul>
            <p className="mt-3 font-reading text-[14.5px] text-ink-soft">
              Nobody, including us, can bring it back. The address {slug} becomes free for anyone to use.
            </p>
            <label className="mt-5 block">
              <span className="field-label">
                Type <strong className="text-ink">{slug}</strong> to confirm
              </span>
              <input
                ref={input}
                className="field w-full"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {error && <p className="mt-3 font-serif text-[13px] text-alert">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn !bg-alert !text-white disabled:opacity-50"
                disabled={!matches || pending}
                onClick={confirm}
              >
                {pending ? "Deleting everything…" : "Delete everything, permanently"}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)} disabled={pending}>
                Keep my wedding
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
