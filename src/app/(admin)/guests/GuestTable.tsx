"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { InView } from "@/components/motion-primitives/in-view";
import { EditableGuestRow, type Contact } from "./EditableGuestRow";

export type GuestTableContact = Contact & {
  parent_contact_id: string | null;
  engagementRsvpStatus: "pending" | "attending" | "declined";
};

const SELECT_CLASS =
  "rounded-full border border-ink/20 bg-cream px-3.5 py-1.5 text-xs text-ink-soft outline-none transition-colors duration-150 focus:border-accent focus:text-ink";

const RSVP_OPTIONS = [
  { value: "attending", label: "Attending" },
  { value: "declined", label: "Declined" },
  { value: "pending", label: "Pending" },
];

export function GuestTable({ contacts, isCouple }: { contacts: GuestTableContact[]; isCouple: boolean }) {
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [role, setRole] = useState("");
  const [tag, setTag] = useState("");
  const [plusOne, setPlusOne] = useState("");
  const [weddingRsvp, setWeddingRsvp] = useState("");
  const [engagementRsvp, setEngagementRsvp] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) (c.tags ?? []).forEach((t) => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const hasActiveFilters = !!(role || tag || plusOne || weddingRsvp || engagementRsvp);

  function clearFilters() {
    setRole("");
    setTag("");
    setPlusOne("");
    setWeddingRsvp("");
    setEngagementRsvp("");
  }

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (role && c.role !== role) return false;
      if (tag && !(c.tags ?? []).includes(tag)) return false;
      if (plusOne === "yes" && !c.plus_one_eligible) return false;
      if (plusOne === "no" && c.plus_one_eligible) return false;
      if (weddingRsvp && c.rsvp_status !== weddingRsvp) return false;
      if (engagementRsvp && c.engagementRsvpStatus !== engagementRsvp) return false;
      return true;
    });
  }, [contacts, role, tag, plusOne, weddingRsvp, engagementRsvp]);

  const topLevel = useMemo(() => {
    const list = filtered.filter((c) => !c.parent_contact_id);
    return [...list].sort((a, b) =>
      sortDir === "asc" ? a.full_name.localeCompare(b.full_name) : b.full_name.localeCompare(a.full_name)
    );
  }, [filtered, sortDir]);

  const topLevelIds = useMemo(() => new Set(topLevel.map((c) => c.id)), [topLevel]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, GuestTableContact[]>();
    for (const c of filtered) {
      if (!c.parent_contact_id || !topLevelIds.has(c.parent_contact_id)) continue;
      const siblings = map.get(c.parent_contact_id) ?? [];
      siblings.push(c);
      map.set(c.parent_contact_id, siblings);
    }
    return map;
  }, [filtered, topLevelIds]);

  // A plus one whose parent got filtered out of topLevel (but who still
  // matches every active filter themself, e.g. filtering by "Attending")
  // has nothing left to nest under — rendered as its own flat row instead
  // of silently disappearing from the filtered view.
  const orphanChildren = useMemo(
    () => filtered.filter((c) => c.parent_contact_id && !topLevelIds.has(c.parent_contact_id)),
    [filtered, topLevelIds]
  );

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className={SELECT_CLASS}>
          <option value="">All roles</option>
          <option value="guest">Guest</option>
          <option value="family">Family</option>
          <option value="wedding_party">Wedding Party</option>
          <option value="couple">Couple</option>
        </select>
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className={SELECT_CLASS}>
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <select value={plusOne} onChange={(e) => setPlusOne(e.target.value)} className={SELECT_CLASS}>
          <option value="">Plus one: any</option>
          <option value="yes">Eligible</option>
          <option value="no">Not eligible</option>
        </select>
        <select value={weddingRsvp} onChange={(e) => setWeddingRsvp(e.target.value)} className={SELECT_CLASS}>
          <option value="">Wedding RSVP: any</option>
          {RSVP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={engagementRsvp} onChange={(e) => setEngagementRsvp(e.target.value)} className={SELECT_CLASS}>
          <option value="">Engagement RSVP: any</option>
          {RSVP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-accent"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto font-reading text-xs text-ink-soft/70">
          {filtered.length} of {contacts.length}
        </span>
      </div>

      {topLevel.length === 0 && orphanChildren.length === 0 ? (
        <p className="rounded-[10px] border border-ink/10 bg-white/50 px-5 py-8 text-center font-reading text-sm text-ink-soft italic">
          No guests match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-ink/10">
          <table className="w-full min-w-[760px] text-left font-serif text-[13px]">
            <thead className="bg-cream-deep">
              <tr>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="flex items-center gap-1.5 transition-colors duration-150 hover:text-ink"
                  >
                    Name
                    {sortDir === "asc" ? (
                      <ArrowDownAZ className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <ArrowUpAZ className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                  </button>
                </th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Contact</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Role</th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">Tags</th>
                <th className="px-5 py-3 text-center text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  Plus one
                </th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  Wedding RSVP
                </th>
                <th className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  Engagement RSVP
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {topLevel.map((c, i) => (
                <React.Fragment key={c.id}>
                  <InView
                    as="tr"
                    once
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                    className="group transition-colors duration-150 hover:bg-cream-deep/40"
                  >
                    <EditableGuestRow contact={c} isCouple={isCouple} engagementRsvpStatus={c.engagementRsvpStatus} />
                  </InView>
                  {(childrenByParent.get(c.id) ?? []).map((child) => (
                    <InView
                      key={child.id}
                      as="tr"
                      once
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                      className="group bg-cream-deep/20 transition-colors duration-150 hover:bg-cream-deep/40"
                    >
                      <EditableGuestRow
                        contact={child}
                        isCouple={isCouple}
                        isChild
                        engagementRsvpStatus={child.engagementRsvpStatus}
                      />
                    </InView>
                  ))}
                </React.Fragment>
              ))}
              {orphanChildren.map((c, i) => (
                <InView
                  key={c.id}
                  as="tr"
                  once
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                  className="group transition-colors duration-150 hover:bg-cream-deep/40"
                >
                  <EditableGuestRow contact={c} isCouple={isCouple} engagementRsvpStatus={c.engagementRsvpStatus} />
                </InView>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
