"use client";

import { useState, useTransition } from "react";
import { createEvent, updateEvent } from "@/lib/events/actions";

export type EventFormData = {
  id: string;
  name: string;
  slug: string;
  starts_at: string | null;
  location: string | null;
  is_landing_cta: boolean;
  landing_cta_copy: string | null;
  rsvp_enabled: boolean;
  rsvp_open: boolean;
  show_rsvp_form: boolean;
  show_guest_list_column: boolean;
  show_header: boolean;
  header_eyebrow: string | null;
  header_title: string | null;
  header_body: string | null;
  show_photo_board: boolean;
  show_details: boolean;
  details_eyebrow: string | null;
  details_title: string | null;
  venue_name: string | null;
  venue_body: string | null;
  show_map: boolean;
  show_on_diary: boolean;
};

const INPUT_CLASS =
  "w-full rounded-full border border-ink/20 bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/50 focus:border-accent";
const TEXTAREA_CLASS =
  "w-full rounded-[10px] border border-ink/20 bg-cream px-4 py-3 font-reading text-sm text-ink outline-none placeholder:text-ink-soft/50 focus:border-accent";
const LABEL_CLASS = "font-serif text-[11px] font-medium tracking-[0.04em] text-ink-soft uppercase";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}

// A toggle with its own revealed sub-form — the "tick a box, then fill in
// what it controls" shape every section of this form follows. Kept as a
// plain conditional render (not the vendored Disclosure) since this is a
// long, scroll-past form rather than something that benefits from a grow
// animation on every checkbox flip.
function ToggleSection({
  name,
  defaultChecked,
  label,
  description,
  children,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="rounded-[10px] border border-ink/10 bg-white/60 p-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          <span className="block font-serif text-sm font-semibold text-ink">{label}</span>
          {description && <span className="mt-0.5 block font-reading text-xs text-ink-soft">{description}</span>}
        </span>
      </label>
      {checked && children && <div className="mt-4 flex flex-col gap-3 pl-7">{children}</div>}
    </div>
  );
}

function splitDateTime(startsAt: string | null) {
  if (!startsAt) return { date: "", time: "" };
  const d = new Date(startsAt);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

export function EventForm({ event }: { event?: EventFormData }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { date: startsAtDate, time: startsAtTime } = splitDateTime(event?.starts_at ?? null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = event ? await updateEvent(formData) : await createEvent(formData);
      // A successful create/update calls redirect() inside the action,
      // which never returns normally — reaching this line at all means
      // it didn't.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      {event && <input type="hidden" name="id" value={event.id} />}

      <div className="rounded-[10px] border border-ink/10 bg-white/60 p-5">
        <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          Event basics
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input name="name" required defaultValue={event?.name} placeholder="Hen Do" className={INPUT_CLASS} />
          </Field>
          <Field label="URL slug">
            <input
              name="slug"
              defaultValue={event?.slug}
              placeholder="auto-generated from name if left blank"
              pattern="[a-z0-9-]+"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Date">
            <input type="date" name="startsAtDate" defaultValue={startsAtDate} className={INPUT_CLASS} />
          </Field>
          <Field label="Time">
            <input type="time" name="startsAtTime" defaultValue={startsAtTime} className={INPUT_CLASS} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Location / address">
              <input
                name="location"
                defaultValue={event?.location ?? ""}
                placeholder="The Black Lion, Hammersmith, London"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="showOnDiary" defaultChecked={event?.show_on_diary ?? true} className="accent-accent" />
          Show on the diary timeline
        </label>
      </div>

      <ToggleSection
        name="isLandingCta"
        defaultChecked={event?.is_landing_cta ?? false}
        label="Home page CTA"
        description="Make this event the featured button on the home page hero."
      >
        <Field label="Button copy">
          <input
            name="landingCtaCopy"
            defaultValue={event?.landing_cta_copy ?? ""}
            placeholder="RSVP to the hen do"
            className={INPUT_CLASS}
          />
        </Field>
      </ToggleSection>

      <ToggleSection
        name="rsvpEnabled"
        defaultChecked={event?.rsvp_enabled ?? false}
        label="RSVPs"
        description="Turn RSVPs on for this event."
      >
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="rsvpOpen" defaultChecked={event?.rsvp_open ?? true} className="accent-accent" />
          Open to anyone (unchecked = only emails already on the guest list can RSVP)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="showRsvpForm"
            defaultChecked={event?.show_rsvp_form ?? false}
            className="accent-accent"
          />
          Show the RSVP form box on this event&rsquo;s page
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="showGuestListColumn"
            defaultChecked={event?.show_guest_list_column ?? false}
            className="accent-accent"
          />
          Give this event its own column on the guest list
        </label>
      </ToggleSection>

      <ToggleSection
        name="showHeader"
        defaultChecked={event?.show_header ?? true}
        label="Header"
        description="The top of the page — eyebrow, title, and intro line."
      >
        <Field label="Eyebrow">
          <input
            name="headerEyebrow"
            defaultValue={event?.header_eyebrow ?? ""}
            placeholder="Nick & Ellie"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Title">
          <input
            name="headerTitle"
            defaultValue={event?.header_title ?? ""}
            placeholder="Let's celebrate early"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Intro">
          <textarea
            name="headerBody"
            defaultValue={event?.header_body ?? ""}
            rows={3}
            placeholder="A line or two setting the tone."
            className={TEXTAREA_CLASS}
          />
        </Field>
      </ToggleSection>

      <ToggleSection
        name="showPhotoBoard"
        defaultChecked={event?.show_photo_board ?? false}
        label="Photo board"
        description="A gallery the couple (and guests, once photos exist) can browse."
      />

      <ToggleSection
        name="showDetails"
        defaultChecked={event?.show_details ?? false}
        label="Date, place & details"
        description="A card with the date/time, venue name, and a short note."
      >
        <Field label="Section eyebrow">
          <input
            name="detailsEyebrow"
            defaultValue={event?.details_eyebrow ?? ""}
            placeholder="When & where"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Section title">
          <input
            name="detailsTitle"
            defaultValue={event?.details_title ?? ""}
            placeholder="Join us at The Black Lion"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Venue name">
          <input
            name="venueName"
            defaultValue={event?.venue_name ?? ""}
            placeholder="The Black Lion"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Note">
          <textarea
            name="venueBody"
            defaultValue={event?.venue_body ?? ""}
            rows={2}
            placeholder="Anything guests should know — dress code, food, timing."
            className={TEXTAREA_CLASS}
          />
        </Field>
      </ToggleSection>

      <ToggleSection
        name="showMap"
        defaultChecked={event?.show_map ?? false}
        label="Map"
        description="An embedded map for the address entered above."
      />

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-6 py-3 font-serif text-sm text-cream transition-colors duration-150 hover:bg-ink-soft disabled:opacity-60"
        >
          {pending ? "Saving…" : event ? "Save changes" : "Create event"}
        </button>
        {error && <p className="mt-3 font-reading text-sm text-alert">{error}</p>}
      </div>
    </form>
  );
}
