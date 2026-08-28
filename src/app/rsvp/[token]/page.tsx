"use client";

import { use, useEffect, useState } from "react";

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

  async function submitRsvp(eventId: string, formEl: HTMLFormElement) {
    setSavingEventId(eventId);
    const formData = new FormData(formEl);
    const attending = formData.get("attending") === "yes";
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
        <h1 className="font-script text-4xl">We couldn&rsquo;t find that invitation</h1>
        <p className="mt-4 font-serif text-ink-soft">
          Double-check the link, or reach out to Nick or Ellie.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <h1 className="font-script text-4xl">Hello, {contact.full_name}</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Let us know if you can make it.
      </p>

      <div className="mt-10 flex w-full max-w-lg flex-col gap-8">
        {events.length === 0 && (
          <p className="text-center font-serif text-ink-soft">
            No events are open for RSVP yet — check back soon.
          </p>
        )}
        {events.map((event) => {
          const existing = responses[event.id];
          return (
            <form
              key={event.id}
              onSubmit={(e) => {
                e.preventDefault();
                submitRsvp(event.id, e.currentTarget);
              }}
              className="rounded-2xl border border-ink/10 bg-cream-deep/60 p-6"
            >
              <h2 className="font-serif text-xl font-semibold">{event.name}</h2>
              {event.location && (
                <p className="mt-1 text-sm text-ink-soft">{event.location}</p>
              )}

              <fieldset className="mt-4 flex gap-4">
                <label className="flex items-center gap-2 font-serif">
                  <input
                    type="radio"
                    name="attending"
                    value="yes"
                    defaultChecked={existing?.attending === true}
                    required
                  />
                  Joyfully attending
                </label>
                <label className="flex items-center gap-2 font-serif">
                  <input
                    type="radio"
                    name="attending"
                    value="no"
                    defaultChecked={existing?.attending === false}
                    required
                  />
                  Can&rsquo;t make it
                </label>
              </fieldset>

              {contact.plus_one_eligible && (
                <div className="mt-4 flex flex-col gap-2">
                  <label className="flex items-center gap-2 font-serif">
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
                    className="rounded-full border border-ink/20 bg-cream px-4 py-2 font-serif text-sm outline-none focus:border-ink"
                  />
                </div>
              )}

              <textarea
                name="dietaryRequirements"
                placeholder="Dietary requirements"
                defaultValue={existing?.dietary_requirements ?? ""}
                className="mt-4 w-full rounded-2xl border border-ink/20 bg-cream px-4 py-2 font-serif text-sm outline-none focus:border-ink"
                rows={2}
              />
              <textarea
                name="notes"
                placeholder="Anything else we should know?"
                defaultValue={existing?.notes ?? ""}
                className="mt-2 w-full rounded-2xl border border-ink/20 bg-cream px-4 py-2 font-serif text-sm outline-none focus:border-ink"
                rows={2}
              />

              <button
                type="submit"
                disabled={savingEventId === event.id}
                className="mt-4 rounded-full bg-ink px-6 py-2 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {savingEventId === event.id
                  ? "Saving…"
                  : existing
                  ? "Update RSVP"
                  : "Send RSVP"}
              </button>
            </form>
          );
        })}
      </div>
    </main>
  );
}
