"use client";

import { use, useEffect, useState } from "react";
import { Botanical } from "@/components/Botanical";
import {
  Disclosure,
  DisclosureTrigger,
  DisclosureContent,
} from "@/components/motion-primitives/disclosure";

type EventRow = { id: string; name: string; starts_at: string | null; location: string | null };
type RsvpRow = {
  event_id: string;
  attending: boolean | null;
  plus_one_attending: boolean | null;
  plus_one_name: string | null;
  dietary_requirements: string | null;
  notes: string | null;
};
type Contact = { id: string; full_name: string; plus_one_eligible: boolean; rsvp_status: string };

export default function RsvpTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [contact, setContact] = useState<Contact | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [responses, setResponses] = useState<Record<string, RsvpRow>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rsvp/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setContact(data.contact);
        setEvents(data.events);
        const map: Record<string, RsvpRow> = {};
        for (const r of data.rsvps as RsvpRow[]) map[r.event_id] = r;
        setResponses(map);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function submitRsvp(eventId: string, formEl: HTMLFormElement, attending: boolean) {
    setSavingEventId(eventId);
    setSavedEventId(null);
    const formData = new FormData(formEl);
    const payload = {
      eventId,
      attending,
      plusOneAttending: formData.get("plusOneAttending") === "on",
      plusOneName: String(formData.get("plusOneName") ?? ""),
      dietaryRequirements: String(formData.get("dietaryRequirements") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };
    const res = await fetch(`/api/rsvp/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setResponses((prev) => ({
        ...prev,
        [eventId]: {
          event_id: eventId,
          attending,
          plus_one_attending: payload.plusOneAttending,
          plus_one_name: payload.plusOneName,
          dietary_requirements: payload.dietaryRequirements,
          notes: payload.notes,
        },
      }));
      setSavedEventId(eventId);
    }
    setSavingEventId(null);
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="font-serif text-ink-soft">Loading your invitation…</p>
      </main>
    );
  }

  if (notFound || !contact) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-4xl">We couldn&rsquo;t find that invitation</h1>
        <p className="mt-4 font-reading text-ink-soft">
          Double-check the link, or reach out to Nick or Ellie.
        </p>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-6 py-16">
      <Botanical
        seed={9}
        stems={3}
        width={150}
        height={220}
        spread={40}
        strokeOpacity={0.8}
        fillOpacity={0.4}
        className="pointer-events-none absolute -top-5 -left-5"
      />

      <p className="relative z-10 font-serif text-xs tracking-[0.25em] text-ink-soft uppercase">
        28 November 2026
      </p>
      <h1 className="relative z-10 mt-3 font-display text-[44px] tracking-tight">
        Hello, {contact.full_name}
      </h1>
      <p className="relative z-10 mt-2 font-reading text-[17px] text-ink-soft italic">
        Let us know if you can make it.
      </p>

      <div className="relative z-10 mt-12 flex w-full max-w-lg flex-col gap-6">
        {events.length === 0 && (
          <p className="text-center font-reading text-ink-soft">
            No events are open for RSVP yet — check back soon.
          </p>
        )}
        {events.map((event, i) => (
          <div key={event.id}>
            {i > 0 && (
              <div className="my-6 flex items-center gap-3 text-ink/20">
                <div className="h-px flex-1 bg-ink/10" />
                <Botanical seed={15} stems={1} width={40} height={24} spread={6} strokeOpacity={0.6} fillOpacity={0.3} />
                <div className="h-px flex-1 bg-ink/10" />
              </div>
            )}
            <EventCard
              event={event}
              contact={contact}
              existing={responses[event.id]}
              saving={savingEventId === event.id}
              saved={savedEventId === event.id}
              delayMs={i * 80}
              onSubmit={(el, attending) => submitRsvp(event.id, el, attending)}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

function EventCard({
  event,
  contact,
  existing,
  saving,
  saved,
  delayMs,
  onSubmit,
}: {
  event: EventRow;
  contact: Contact;
  existing: RsvpRow | undefined;
  saving: boolean;
  saved: boolean;
  delayMs: number;
  onSubmit: (form: HTMLFormElement, attending: boolean) => void;
}) {
  const [attending, setAttending] = useState<boolean | null>(existing?.attending ?? null);
  const hasExtras = !!(existing?.dietary_requirements || existing?.notes);
  const [extrasOpen, setExtrasOpen] = useState(hasExtras);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (attending === null) return;
        onSubmit(e.currentTarget, attending);
      }}
      className="rounded-2xl border border-ink/10 bg-white p-8"
      style={{ animation: `fadeUp 550ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms both` }}
    >
      <h2 className="font-display text-[19px]">{event.name}</h2>
      {event.location && (
        <p className="mt-1.5 font-reading text-sm text-ink-soft">{event.location}</p>
      )}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={() => setAttending(true)}
          aria-pressed={attending === true}
          className={`flex-1 rounded-full py-3 font-serif text-[13px] transition ${
            attending === true
              ? "bg-accent text-cream"
              : "border border-ink/20 text-ink-soft hover:border-ink/40"
          }`}
        >
          Joyfully attending
        </button>
        <button
          type="button"
          onClick={() => setAttending(false)}
          aria-pressed={attending === false}
          className={`flex-1 rounded-full py-3 font-serif text-[13px] transition ${
            attending === false
              ? "bg-ink text-cream"
              : "border border-ink/20 text-ink-soft hover:border-ink/40"
          }`}
        >
          Can&rsquo;t make it
        </button>
      </div>

      {contact.plus_one_eligible && (
        <div className="mt-5 flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 font-serif text-[13px] text-ink-soft">
            <input
              type="checkbox"
              name="plusOneAttending"
              defaultChecked={existing?.plus_one_attending ?? false}
            />
            Bringing a plus one
          </label>
          <input
            type="text"
            name="plusOneName"
            placeholder="Plus one's name"
            defaultValue={existing?.plus_one_name ?? ""}
            className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent"
          />
        </div>
      )}

      <Disclosure open={extrasOpen} onOpenChange={setExtrasOpen} className="mt-3">
        <DisclosureTrigger>
          <button
            type="button"
            className="font-serif text-xs text-ink-soft underline underline-offset-2"
          >
            {extrasOpen ? "− Hide" : "+ Add"} dietary requirements &amp; notes
          </button>
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="flex flex-col gap-2.5 pt-3">
            <textarea
              name="dietaryRequirements"
              placeholder="Dietary requirements"
              defaultValue={existing?.dietary_requirements ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent"
              rows={2}
            />
            <textarea
              name="notes"
              placeholder="Anything else we should know?"
              defaultValue={existing?.notes ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent"
              rows={2}
            />
          </div>
        </DisclosureContent>
      </Disclosure>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="submit"
          disabled={saving || attending === null}
          className="rounded-full bg-ink px-7 py-3 font-serif text-[13px] text-cream transition hover:bg-ink-soft disabled:opacity-60"
        >
          {saving ? "Saving…" : existing ? "Update RSVP" : "Send RSVP"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 font-serif text-xs text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
