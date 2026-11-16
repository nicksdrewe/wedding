"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addOrgComm, updateOrgComm } from "@/lib/org-comms/actions";
import { COMM_KINDS, IMPORTANCES, type CommCategory, type CommOption, type OrgComm } from "@/lib/org-comms/types";

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

// One form for adding and editing an entry. With `entry` it edits that entry.
export function EntryForm({
  categories,
  options,
  entry,
  onDone,
  defaults,
}: {
  categories: CommCategory[];
  options: CommOption[];
  entry?: OrgComm;
  onDone?: () => void;
  defaults?: { optionId?: string | null; categoryId?: string | null };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optionId, setOptionId] = useState(entry?.page_option_id ?? defaults?.optionId ?? "");
  const [categoryId, setCategoryId] = useState(
    entry?.category_page_id ??
      defaults?.categoryId ??
      (defaults?.optionId ? (options.find((o) => o.id === defaults.optionId)?.categoryId ?? "") : "")
  );

  function pickOption(id: string) {
    setOptionId(id);
    const cat = options.find((o) => o.id === id)?.categoryId;
    if (cat) setCategoryId(cat);
  }

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = entry ? await updateOrgComm(entry.id, formData) : await addOrgComm(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (!entry) {
            formRef.current?.reset();
            setOptionId("");
            setCategoryId("");
          }
          onDone?.();
        })
      }
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <label>
        <span className="field-label">What is it?</span>
        <select name="kind" defaultValue={entry?.kind ?? "received"} className="field">
          {COMM_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">Who it was with</span>
        <input
          name="counterparty"
          maxLength={200}
          defaultValue={entry?.counterparty ?? ""}
          placeholder="e.g. The venue, Sam at the florist"
          className="field"
        />
      </label>
      <label>
        <span className="field-label">Subject</span>
        <input name="subject" required maxLength={200} defaultValue={entry?.subject ?? ""} placeholder="What was it about?" className="field" />
      </label>
      <label>
        <span className="field-label">Date</span>
        <input name="occurredOn" type="date" required defaultValue={entry?.occurred_on ?? today()} className="field" />
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">The email, or what happened</span>
        <textarea
          name="body"
          rows={8}
          maxLength={20000}
          defaultValue={entry?.body ?? ""}
          placeholder="Paste the email here, or type the update."
          className="field min-h-48"
        />
      </label>
      <label>
        <span className="field-label">About (category)</span>
        <select name="categoryPageId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field">
          <option value="">Nothing in particular</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">About (option, optional)</span>
        <select name="pageOptionId" value={optionId} onChange={(e) => pickOption(e.target.value)} className="field">
          <option value="">No particular option</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.groupTitle ? ` (${o.groupTitle})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">How important?</span>
        <select name="importance" defaultValue={entry?.importance ?? 0} className="field">
          {IMPORTANCES.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending} className="btn btn-sec flex-1">
          {!entry && <Plus className="h-4 w-4" strokeWidth={2} />}
          {pending ? "Saving…" : entry ? "Save changes" : "Add entry"}
        </button>
        {entry && (
          <button type="button" onClick={onDone} className="btn btn-quiet">
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="font-reading text-[13px] text-alert sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}
