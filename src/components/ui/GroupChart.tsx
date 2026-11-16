import { toDriveImageUrl } from "@/lib/google/image-url";
import type { GroupChartData, GroupKind, GroupMember } from "@/lib/party/group";

// The little family tree under a group page's title, drawn on the dark
// header: the groom (or bride) at the top, a glowing root running down to the
// best man (or maid of honour), and from there out to everyone in the group.
// Each person is a floating round badge with their initials and a first
// name; add someone to the group and they appear here. Pure CSS motion, which
// the global reduced-motion rule stills.

const LABELS: Record<GroupKind, { head: string; lead: string; member: string; empty: string }> = {
  groomsman: { head: "Groom", lead: "Best man", member: "Groomsman", empty: "No groomsmen yet" },
  bridesmaid: { head: "Bride", lead: "Maid of honour", member: "Bridesmaid", empty: "No bridesmaids yet" },
};

function Badge({ person, title, index, big }: { person: GroupMember; title: string; index: number; big?: boolean }) {
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  // A stable hue per person so everyone looks distinct but consistent.
  let h = 0;
  for (const ch of person.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <li className="gc-person" style={{ "--i": index, "--hue": h } as React.CSSProperties}>
      <span className={`gc-badge ${big ? "gc-badge--big" : ""}`} aria-hidden="true">
        {person.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toDriveImageUrl(person.photo)} alt="" loading="lazy" decoding="async" className="gc-photo" />
        ) : (
          initials
        )}
      </span>
      <span className="gc-name">{person.first}</span>
      <span className="gc-title">{title}</span>
    </li>
  );
}

export function GroupChart({ kind, data }: { kind: GroupKind; data: GroupChartData }) {
  const t = LABELS[kind];
  const { head, lead, members } = data;
  if (!head && lead.length === 0 && members.length === 0) return null;
  let n = 0;
  return (
    <div className="gc" role="group" aria-label={`${t.member}s: who is in the group`}>
      {head && (
        <ul className="gc-tier">
          <Badge person={head} title={t.head} index={n++} big />
        </ul>
      )}
      {head && (lead.length > 0 || members.length > 0) && <span className="gc-root" aria-hidden="true" />}
      {lead.length > 0 && (
        <ul className="gc-tier">
          {lead.map((p) => (
            <Badge key={p.id} person={p} title={t.lead} index={n++} big />
          ))}
        </ul>
      )}
      {lead.length > 0 && members.length > 0 && <span className="gc-root" aria-hidden="true" />}
      {members.length > 0 ? (
        <ul className="gc-tier gc-tier--row">
          {members.map((p) => (
            <Badge key={p.id} person={p} title={t.member} index={n++} />
          ))}
        </ul>
      ) : (
        <p className="gc-empty">
          {t.empty}. Tag someone as {kind === "groomsman" ? "a groomsman" : "a bridesmaid"} in the guest list and they will appear here.
        </p>
      )}
    </div>
  );
}
