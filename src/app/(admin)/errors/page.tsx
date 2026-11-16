import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { timeAgo } from "@/lib/accounts/types";
import { ClearErrorsButton } from "./ClearErrorsButton";

// Nick and Ellie only. A private view of what has gone wrong on the site
// (0039_error_log.sql): which page, what the error said, and its reference
// code so it can be matched to the hosting logs if needed. Holds no personal
// data. Lines older than 30 days are tidied away whenever this page opens.
export const dynamic = "force-dynamic";

const KEEP_DAYS = 30;

export default async function ErrorsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") redirect("/no-access");

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("error_log").delete().lt("created_at", cutoff);

  const { data, error } = await supabase
    .from("error_log")
    .select("id, created_at, route, route_type, method, message, digest")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  // How many times the same error (same reference code, else same message on
  // the same page) has shown up — a repeat is more telling than a one-off.
  const keyOf = (r: (typeof rows)[number]) => r.digest ?? `${r.route}|${r.message}`;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1);

  return (
    <div>
      <Link
        href="/access"
        className="font-serif text-xs tracking-wide text-ink-soft transition-colors hover:text-sec"
      >
        ← Roles &amp; Access
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow="Household"
          title="Recent errors"
          infoText="Anything that went wrong on the site in the last 30 days — which page, what it said, and a reference code. No names or personal details are recorded."
        />
        {rows.length > 0 && (
          <div className="-mt-2 flex justify-end">
            <ClearErrorsButton />
          </div>
        )}
      </div>

      {error ? (
        <EmptyState
          className="mt-8"
          title="Errors can't be shown yet"
          hint="Run migration 0039_error_log.sql in the Supabase SQL editor, then reload."
        />
      ) : rows.length === 0 ? (
        <EmptyState className="mt-8" title="Nothing has gone wrong" hint="No errors in the last 30 days." />
      ) : (
        <div className="surface mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-serif text-[13px]">
            <thead className="bg-sec-tint/70">
              <tr>
                {["When", "Page", "What it said", "Times", "Reference"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-5 py-3 whitespace-nowrap text-ink-soft">{timeAgo(r.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className="font-semibold">{r.route}</span>
                    {r.method && r.method !== "GET" && (
                      <span className="ml-1.5 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-soft">{r.method}</span>
                    )}
                  </td>
                  <td className="max-w-md px-5 py-3 font-reading whitespace-normal text-ink-soft">{r.message}</td>
                  <td className="px-5 py-3 tabular-nums">{counts.get(keyOf(r))}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-ink-soft/70">{r.digest ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
