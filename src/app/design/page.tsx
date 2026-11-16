import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { getAuthState, getCurrentContactTags } from "@/lib/auth/roles";
import type { Profile } from "@/lib/auth/role-types";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SectionSwitcher } from "./SectionSwitcher";

export const metadata: Metadata = { title: "Design system — Nick & Ellie" };

// The living style guide for the signed-in site (docs/design-system.md is the
// written half). Couple-only on the real site. On a developer's own machine
// it opens without signing in, with a stand-in profile, so the look can be
// checked in a browser — it shows no data, only sample pieces.
const PREVIEW_PROFILE: Profile = { id: "preview", role: "couple", full_name: "Preview", contact_id: null };

const SWATCHES = [
  ["Night", "var(--color-night)"],
  ["Forest", "var(--color-forest)"],
  ["Moss", "var(--color-accent)"],
  ["Cream", "var(--color-cream)"],
  ["Paper", "var(--color-paper)"],
  ["Section", "var(--sec)"],
  ["Section glow", "var(--sec-glow)"],
  ["Section tint", "var(--sec-tint)"],
];

export default async function DesignPage() {
  let profile = PREVIEW_PROFILE;
  let tags: string[] = [];
  if (process.env.NODE_ENV === "production") {
    const state = await getAuthState();
    if (state.status === "anonymous") redirect("/login?next=/design");
    if (state.status === "no-profile" || state.profile.role !== "couple") redirect("/no-access");
    profile = state.profile;
    tags = await getCurrentContactTags(state.profile);
  }

  return (
    <AppShell profile={profile} tags={tags}>
      <PageHeader
        eyebrow="Design system"
        title="The Walled Garden"
        infoText="Every signed-in page is built from the pieces on this page."
        actions={
          <button type="button" className="btn btn-on-dark">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Header action
          </button>
        }
      />

      <div className="flex flex-col gap-12">
        <section className="rise">
          <div className="section-head">
            <h2 className="section-head__title">Parts of the site</h2>
            <span className="section-head__rule" />
          </div>
          <p className="mb-4 max-w-[62ch] font-reading text-[16px] leading-relaxed text-ink-soft">
            Each part has its own bloom colour. Switch between them: the light behind the page, the header&rsquo;s
            glow, focus rings and accents all follow.
          </p>
          <SectionSwitcher />
        </section>

        <section className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="section-head">
            <h2 className="section-head__title">Colour</h2>
            <span className="section-head__rule" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map(([name, value]) => (
              <div key={name} className="surface overflow-hidden">
                <div className="h-16" style={{ background: value }} />
                <p className="px-3 py-2 font-serif text-[12px] font-medium text-ink-soft">{name}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="section-head">
            <h2 className="section-head__title">Type</h2>
            <span className="section-head__rule" />
          </div>
          <div className="surface p-6 sm:p-8">
            <p className="eyebrow">Eyebrow · Archivo</p>
            <p className="mt-2 font-title text-[40px] leading-[1.05] tracking-tight">A title in Fraunces</p>
            <p className="mt-1 font-title text-[22px] text-ink-soft italic">and its italic, for a softer aside</p>
            <p className="mt-4 max-w-[62ch] font-reading text-[17px] leading-relaxed text-ink">
              Reading copy is Source Serif: notes from a venue, a paragraph about the day, anything longer than a
              line. Labels, buttons, tables and numbers in tables are Archivo.
            </p>
          </div>
        </section>

        <section className="rise" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="section-head">
            <h2 className="section-head__title">Surfaces &amp; depth</h2>
            <span className="section-head__rule" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="surface p-5">
              <p className="eyebrow">surface</p>
              <p className="mt-2 font-reading text-[15px] text-ink-soft">Paper. The default home for content.</p>
            </div>
            <div className="surface surface-raised p-5">
              <p className="eyebrow">surface-raised</p>
              <p className="mt-2 font-reading text-[15px] text-ink-soft">One step closer: forms, the thing in focus.</p>
            </div>
            <a href="#" className="surface surface-lift block p-5">
              <p className="eyebrow">surface-lift</p>
              <p className="mt-2 font-reading text-[15px] text-ink-soft">Anything you can open. Hover or press me.</p>
            </a>
            <div className="surface surface-glass p-5">
              <p className="eyebrow">surface-glass</p>
              <p className="mt-2 font-reading text-[15px] text-ink-soft">Floats over the light: nav, sticky bars.</p>
            </div>
            <div className="surface surface-tint p-5">
              <p className="eyebrow">surface-tint</p>
              <p className="mt-2 font-reading text-[15px] text-ink-soft">A wash of the section colour: highlights.</p>
            </div>
            <div className="surface surface-sunken p-5">
              <p className="eyebrow">surface-sunken</p>
              <p className="mt-2 font-reading text-[15px] text-ink-soft">Pressed in: empty states, wells, totals rows.</p>
            </div>
            <div className="surface surface-ink p-5 sm:col-span-2 lg:col-span-3">
              <p className="font-serif text-[11px] font-semibold tracking-[0.16em] text-sec-glow uppercase">surface-ink</p>
              <p className="mt-2 font-title text-[24px]">The night garden, for the one thing that matters most on a page.</p>
            </div>
          </div>
        </section>

        <section className="rise" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="section-head">
            <h2 className="section-head__title">Buttons, chips &amp; fields</h2>
            <span className="section-head__rule" />
          </div>
          <div className="surface surface-raised flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Primary
              </button>
              <button type="button" className="btn btn-sec">Section</button>
              <button type="button" className="btn btn-quiet">Quiet</button>
              <button type="button" className="btn btn-ghost">Ghost</button>
              <button type="button" className="btn btn-danger btn-sm">Delete</button>
              <button type="button" className="btn btn-primary" disabled>
                Disabled
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">Plain chip</span>
              <span className="chip chip-sec">Section chip</span>
              <span className="chip chip-ink">Ink chip</span>
            </div>
            <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">Name</span>
                <input className="field" placeholder="e.g. The Orangery" />
              </label>
              <label>
                <span className="field-label">Kind</span>
                <select className="field" defaultValue="venue">
                  <option value="venue">Venue</option>
                  <option value="food">Food</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="rise" style={{ "--i": 5 } as React.CSSProperties}>
          <div className="section-head">
            <h2 className="section-head__title">Numbers &amp; empty states</h2>
            <span className="section-head__rule" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="surface p-5">
              <p className="stat__label">Confirmed</p>
              <p className="stat__value">84</p>
            </div>
            <div className="surface surface-tint p-5">
              <p className="stat__label">Predicted</p>
              <p className="stat__value">£18k–£24k</p>
            </div>
            <EmptyState title="Nothing here yet" hint="Sample empty state." />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
