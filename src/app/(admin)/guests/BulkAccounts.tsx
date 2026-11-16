"use client";

import { useState } from "react";
import { createAccount } from "@/lib/accounts/actions";

// "Create accounts for everyone shown below who doesn't have one." Works on
// whatever the guest-list filters currently show, so the couple can roll out
// in stages (filter to Wedding Party, create, then Family, …) instead of
// all at once. Runs one person at a time from the browser — like the Comms
// sender — so a long list can't hit a server time limit and progress is
// visible.
export function BulkAccounts({
  eligible,
}: {
  eligible: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [sendInvites, setSendInvites] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);
  const [done, setDone] = useState<{ created: number } | null>(null);

  if (eligible.length === 0 && !done) return null;

  async function run() {
    setRunning(true);
    setFailures([]);
    setDone(null);
    setProgress(0);
    let created = 0;
    const failed: { name: string; error: string }[] = [];
    for (const person of eligible) {
      const result = await createAccount(person.id, sendInvites);
      if (result.error) failed.push({ name: person.name, error: result.error });
      else created += 1;
      setProgress((p) => p + 1);
    }
    setFailures(failed);
    setDone({ created });
    setRunning(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-quiet btn-sm"
      >
        Create accounts ({eligible.length})
      </button>
    );
  }

  return (
    <div className="surface surface-tint w-full px-5 py-4">
      <p className="font-serif text-sm font-semibold text-ink">
        {done
          ? `Done — ${done.created} account${done.created === 1 ? "" : "s"} created`
          : `Create accounts for the ${eligible.length} ${eligible.length === 1 ? "person" : "people"} shown below without one?`}
      </p>
      {!done && (
        <>
          <p className="mt-1 font-reading text-[13px] text-ink-soft">
            Each gets an account with the role they already have on the guest list. Use the filters above first if you
            only want to start with some people.
          </p>
          <label className="mt-3 flex items-center gap-2 font-reading text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={sendInvites}
              onChange={(e) => setSendInvites(e.target.checked)}
              disabled={running}
              className="accent-accent"
            />
            Email each of them an invite explaining how to sign in
          </label>
        </>
      )}
      {running && (
        <p className="mt-3 font-reading text-[13px] text-ink-soft tabular-nums">
          Working… {progress} of {eligible.length}
        </p>
      )}
      {failures.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 font-reading text-[12px] text-alert">
          {failures.map((f) => (
            <li key={f.name}>
              <span className="font-semibold">{f.name}:</span> {f.error}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        {!done && (
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="btn btn-primary btn-sm"
          >
            {running ? "Creating…" : `Create ${eligible.length} account${eligible.length === 1 ? "" : "s"}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDone(null);
            setFailures([]);
          }}
          disabled={running}
          className="btn btn-quiet btn-sm"
        >
          {done ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
