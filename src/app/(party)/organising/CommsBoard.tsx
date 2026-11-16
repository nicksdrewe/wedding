"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUp, Pencil, Search, Trash2 } from "lucide-react";
import { Timeline, type TimelineEntry } from "@/components/timeline/Timeline";
import { CommKindIcon, commKindLabel } from "@/lib/org-comms/kind-icon";
import { deleteOrgComm, setOrgCommImportance } from "@/lib/org-comms/actions";
import { importanceToTier, type CommCategory, type CommOption, type OrgComm } from "@/lib/org-comms/types";
import { EntryForm } from "./EntryForm";

function EntryBody({
  entry,
  canChange,
  isCouple,
  highlight,
  categories,
  options,
}: {
  entry: OrgComm;
  canChange: boolean;
  isCouple: boolean;
  highlight: boolean;
  categories: CommCategory[];
  options: CommOption[];
}) {
  const [expanded, setExpanded] = useState(highlight);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const minor = entry.importance === 0;
  const longBody = (entry.body?.length ?? 0) > 200 || (entry.body?.split("\n").length ?? 0) > 3;

  useEffect(() => {
    if (highlight) document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ block: "center" });
  }, [highlight, entry.id]);

  function remove() {
    if (!window.confirm("Delete this entry? This can not be undone.")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteOrgComm(entry.id);
      if (r.error) setError(r.error);
    });
  }

  function promote(importance: number) {
    setError(null);
    startTransition(async () => {
      const r = await setOrgCommImportance(entry.id, importance);
      if (r.error) setError(r.error);
    });
  }

  if (editing) {
    return (
      <div className="mt-3 text-left">
        <EntryForm categories={categories} options={options} entry={entry} onDone={() => setEditing(false)} />
      </div>
    );
  }

  // Minor entries stay one line until opened.
  const showBody = !minor || expanded;

  return (
    <>
      {entry.body && showBody && (
        <p className="tl-body" data-clamped={!expanded}>
          {entry.body}
        </p>
      )}
      <p className="tl-meta">
        {commKindLabel(entry.kind)}
        {entry.author_name ? ` · logged by ${entry.author_name}` : ""}
      </p>
      <div className="tl-actions">
        {(minor ? !!entry.body : longBody) && (
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="btn btn-ghost btn-sm">
            {expanded ? "Show less" : minor ? "Show details" : "Show more"}
          </button>
        )}
        {canChange && (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-quiet btn-sm">
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Edit
          </button>
        )}
        {isCouple && entry.importance < 2 && (
          <button type="button" disabled={pending} onClick={() => promote(entry.importance + 1)} className="btn btn-quiet btn-sm">
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Promote
          </button>
        )}
        {canChange && (
          <button type="button" disabled={pending} onClick={remove} className="btn btn-danger btn-sm">
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Delete
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 font-reading text-[13px] text-alert">
          {error}
        </p>
      )}
    </>
  );
}

export function CommsBoard({
  entries,
  categories,
  options,
  currentUserId,
  isCouple,
  highlightId,
}: {
  entries: OrgComm[];
  categories: CommCategory[];
  options: CommOption[];
  currentUserId: string;
  isCouple: boolean;
  highlightId: string | null;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.subject, e.counterparty, e.body, e.category_title, e.option_name, e.author_name]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q))
    );
  }, [entries, query]);

  const items: TimelineEntry[] = shown.map((e) => ({
    id: e.id,
    date: e.occurred_on,
    title: e.subject,
    excerpt: e.counterparty ? `${e.kind === "sent" ? "To" : e.kind === "received" ? "From" : "With"} ${e.counterparty}` : null,
    tier: importanceToTier(e.importance),
    icon: <CommKindIcon kind={e.kind} />,
    highlight: e.id === highlightId,
    chips:
      e.category_title || e.option_name ? (
        <>
          {e.category_title && e.category_page_id && (
            <Link href={`/organising?category=${e.category_page_id}`} className="chip chip-sec">
              {e.category_title}
            </Link>
          )}
          {e.option_name && e.page_option_id && (
            <Link href={`/organising?option=${e.page_option_id}`} className="chip">
              {e.option_name}
            </Link>
          )}
        </>
      ) : undefined,
    children: (
      <EntryBody
        entry={e}
        canChange={isCouple || e.created_by === currentUserId}
        isCouple={isCouple}
        highlight={e.id === highlightId}
        categories={categories}
        options={options}
      />
    ),
  }));

  return (
    <section className="mt-8">
      <label className="relative block max-w-md">
        <span className="sr-only">Search entries</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by subject, person or words in the email"
          className="field !pl-11"
        />
      </label>

      {items.length === 0 ? (
        <p className="surface surface-sunken mt-6 p-6 font-reading text-[14px] text-ink-soft">
          {entries.length === 0 ? "Nothing logged here yet. Add the first entry above." : "No entries match that search."}
        </p>
      ) : (
        <div className="mt-6">
          <Timeline items={items} />
        </div>
      )}
    </section>
  );
}
