"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  upsertPagePermission,
  deletePagePermission,
  type PageRegistryRow,
  type PagePermissionRow,
} from "@/lib/permissions/actions";
import type { RoleTier } from "@/lib/auth/role-types";

// Couple is deliberately excluded from every row here — fn_resolve_data_access
// and getEffectivePermission both hard-code the couple to always-allowed, so
// a couple row in this matrix would only ever be misleading.
const ROLES: { value: RoleTier; label: string }[] = [
  { value: "family", label: "Family" },
  { value: "wedding_party", label: "Wedding Party" },
  { value: "guest", label: "Guest" },
];

function RoleCell({
  pageKey,
  role,
  existing,
}: {
  pageKey: string;
  role: RoleTier;
  existing: PagePermissionRow | undefined;
}) {
  const [pageAccess, setPageAccess] = useState(existing?.page_access ?? true);
  const [dataAccess, setDataAccess] = useState(existing?.data_access ?? true);
  const [, startTransition] = useTransition();

  function save(next: { pageAccess: boolean; dataAccess: boolean }) {
    const formData = new FormData();
    formData.set("pageKey", pageKey);
    formData.set("principalType", "role");
    formData.set("principalValue", role);
    if (next.pageAccess) formData.set("pageAccess", "on");
    if (next.dataAccess) formData.set("dataAccess", "on");
    startTransition(() => {
      upsertPagePermission(formData);
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-[8px] border border-ink/10 bg-cream-deep/30 px-3.5 py-2.5">
      <span className="w-28 shrink-0 font-serif text-[13px] text-ink">{ROLES.find((r) => r.value === role)?.label}</span>
      <label className="flex items-center gap-1.5 font-reading text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={pageAccess}
          onChange={(e) => {
            setPageAccess(e.target.checked);
            save({ pageAccess: e.target.checked, dataAccess });
          }}
          className="accent-accent"
        />
        Page access
      </label>
      <label className="flex items-center gap-1.5 font-reading text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={dataAccess}
          onChange={(e) => {
            setDataAccess(e.target.checked);
            save({ pageAccess, dataAccess: e.target.checked });
          }}
          className="accent-accent"
        />
        Itemized data
      </label>
    </div>
  );
}

function TagRow({
  link,
  onRemoved,
}: {
  link: PagePermissionRow;
  onRemoved: (id: string) => void;
}) {
  const [pageAccess, setPageAccess] = useState(link.page_access);
  const [dataAccess, setDataAccess] = useState(link.data_access);
  const [pending, startTransition] = useTransition();

  function save(next: { pageAccess: boolean; dataAccess: boolean }) {
    const formData = new FormData();
    formData.set("pageKey", link.page_key);
    formData.set("principalType", "tag");
    formData.set("principalValue", link.principal_value);
    if (next.pageAccess) formData.set("pageAccess", "on");
    if (next.dataAccess) formData.set("dataAccess", "on");
    startTransition(() => {
      upsertPagePermission(formData);
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-[8px] border border-accent/20 bg-accent/[0.04] px-3.5 py-2.5">
      <span className="w-28 shrink-0 truncate font-serif text-[13px] text-ink">#{link.principal_value}</span>
      <label className="flex items-center gap-1.5 font-reading text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={pageAccess}
          onChange={(e) => {
            setPageAccess(e.target.checked);
            save({ pageAccess: e.target.checked, dataAccess });
          }}
          className="accent-accent"
        />
        Page access
      </label>
      <label className="flex items-center gap-1.5 font-reading text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={dataAccess}
          onChange={(e) => {
            setDataAccess(e.target.checked);
            save({ pageAccess, dataAccess: e.target.checked });
          }}
          className="accent-accent"
        />
        Itemized data
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          await deletePagePermission(link.id);
          onRemoved(link.id);
        })}
        className="ml-auto font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
      >
        Remove
      </button>
    </div>
  );
}

function PageSection({
  page,
  permissions,
  knownTags,
}: {
  page: PageRegistryRow;
  permissions: PagePermissionRow[];
  knownTags: string[];
}) {
  const [tagLinks, setTagLinks] = useState(permissions.filter((p) => p.page_key === page.page_key && p.principal_type === "tag"));
  const [newTag, setNewTag] = useState("");
  const [pending, startTransition] = useTransition();

  function addTag() {
    const tag = newTag.trim();
    if (!tag) return;
    const formData = new FormData();
    formData.set("pageKey", page.page_key);
    formData.set("principalType", "tag");
    formData.set("principalValue", tag);
    formData.set("pageAccess", "on");
    formData.set("dataAccess", "on");
    startTransition(async () => {
      await upsertPagePermission(formData);
      setTagLinks((prev) => [
        ...prev.filter((l) => l.principal_value !== tag),
        { id: `${page.page_key}:${tag}`, page_key: page.page_key, principal_type: "tag", principal_value: tag, page_access: true, data_access: true },
      ]);
      setNewTag("");
    });
  }

  return (
    <div className="rounded-[10px] border border-ink/10 bg-white p-5">
      <p className="font-serif text-sm font-semibold text-ink">{page.label}</p>
      <p className="mt-0.5 font-reading text-xs text-ink-soft/70">{page.page_key}</p>

      <div className="mt-3 flex flex-col gap-2">
        {ROLES.map((r) => (
          <RoleCell
            key={r.value}
            pageKey={page.page_key}
            role={r.value}
            existing={permissions.find((p) => p.page_key === page.page_key && p.principal_type === "role" && p.principal_value === r.value)}
          />
        ))}
        {tagLinks.map((link) => (
          <TagRow key={link.id} link={link} onRemoved={(id) => setTagLinks((prev) => prev.filter((l) => l.id !== id))} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          list={`tags-${page.page_key}`}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add a tag override, e.g. best man"
          className="rounded-full border border-ink/20 bg-cream px-4 py-1.5 font-reading text-xs outline-none focus:border-accent"
        />
        <datalist id={`tags-${page.page_key}`}>
          {knownTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={addTag}
          disabled={pending || !newTag.trim()}
          className="rounded-full border border-ink/20 px-3.5 py-1.5 font-serif text-xs text-ink-soft transition hover:border-ink/40 disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function AccessMatrixForm({
  page,
  childPages,
  permissions,
  knownTags,
}: {
  page: PageRegistryRow;
  childPages: PageRegistryRow[];
  permissions: PagePermissionRow[];
  knownTags: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[10px] border border-ink/10 bg-white/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4"
      >
        <div className="text-left">
          <p className="font-serif text-sm font-semibold text-ink">{page.label}</p>
          <p className="mt-0.5 font-reading text-xs text-ink-soft/70">
            {page.page_key}
            {page.is_dynamic && childPages.length > 0 ? ` · ${childPages.length} page${childPages.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-ink/10 p-5">
          <PageSection page={page} permissions={permissions} knownTags={knownTags} />
          {childPages.map((child) => (
            <PageSection key={child.page_key} page={child} permissions={permissions} knownTags={knownTags} />
          ))}
        </div>
      )}
    </div>
  );
}
