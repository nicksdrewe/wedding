"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Disclosure,
  DisclosureTrigger,
  DisclosureContent,
} from "@/components/motion-primitives/disclosure";
import {
  updateOwnDetails,
  addOwnPlusOne,
  removeOwnPlusOne,
  updateOwnRsvp,
} from "@/lib/account/actions";

type PlusOne = { id: string; full_name: string };
type EventRow = { id: string; name: string; starts_at: string | null; location: string | null; past: boolean };
type RsvpRow = {
  event_id: string;
  attending: boolean | null;
  dietary_requirements: string | null;
  notes: string | null;
};

type Contact = {
  id: string;
  full_name: string;
  guest_note: string | null;
  plus_one_limit: number;
};

const detailsInitialState = { error: null as string | null, success: false };

export function MyDetailsForm({
  contact,
  plusOnes,
  events,
  rsvps,
}: {
  contact: Contact;
  plusOnes: PlusOne[];
  events: EventRow[];
  rsvps: RsvpRow[];
}) {
  const [detailsState, detailsAction, detailsPending] = useActionState(
    async (_prev: typeof detailsInitialState, formData: FormData) => {
      const result = await updateOwnDetails(formData);
      return { error: result.error, success: !result.error };
    },
    detailsInitialState
  );

  const responses: Record<string, RsvpRow> = {};
  for (const r of rsvps) responses[r.event_id] = r;
  const upcoming = events.filter((e) => !e.past);
  // Most recent first.
  const past = events.filter((e) => e.past).reverse();

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-display text-2xl">Your details</h2>
        <form action={detailsAction} className="mt-4 flex flex-col gap-3">
          <input
            name="fullName"
            type="text"
            required
            maxLength={200}
            defaultValue={contact.full_name}
            placeholder="Your name"
            className="field w-full"
          />
          <textarea
            name="guestNote"
            maxLength={1000}
            defaultValue={contact.guest_note ?? ""}
            placeholder="Anything you'd like the couple to know"
            rows={3}
            className="field w-full"
          />
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={detailsPending}
              className="btn btn-primary"
            >
              {detailsPending ? "Saving…" : "Save details"}
            </button>
            {detailsState.success && (
              <span className="flex items-center gap-1.5 font-serif text-xs text-accent">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                Saved
              </span>
            )}
          </div>
          {detailsState.error && (
            <p className="font-reading text-xs text-alert">{detailsState.error}</p>
          )}
        </form>
      </section>

      <PlusOnesSection contact={contact} plusOnes={plusOnes} />

      <section>
        <h2 className="font-display text-2xl">Your RSVP</h2>
        <div className="mt-4 flex flex-col gap-6">
          {upcoming.length === 0 && (
            <p className="rounded-2xl bg-sec-tint px-5 py-4 font-reading text-ink">
              Nothing to RSVP to right now. You&rsquo;re all caught up, so go and have a lovely day! 🥂
            </p>
          )}
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} existing={responses[event.id]} />
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">Already happened</h2>
          <div className="mt-4 flex flex-col gap-4">
            {past.map((event) => (
              <PastEventCard key={event.id} event={event} existing={responses[event.id]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PlusOnesSection({ contact, plusOnes }: { contact: Contact; plusOnes: PlusOne[] }) {
  const [isPending, startTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const atLimit = plusOnes.length >= contact.plus_one_limit;

  function handleAdd(formData: FormData) {
    setAddError(null);
    startTransition(async () => {
      const result = await addOwnPlusOne(formData);
      if (result.error) {
        setAddError(result.error);
      } else {
        setNameValue("");
      }
    });
  }

  function handleRemove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      await removeOwnPlusOne(id);
      setRemovingId(null);
    });
  }

  if (contact.plus_one_limit === 0 && plusOnes.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-2xl">Your guests</h2>
      <p className="mt-1.5 font-reading text-sm text-ink-soft">
        {plusOnes.length} of {contact.plus_one_limit} added
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        {plusOnes.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-full border border-ink/10 bg-white px-4.5 py-3"
          >
            <span className="font-reading text-sm">{p.full_name}</span>
            <button
              type="button"
              onClick={() => handleRemove(p.id)}
              disabled={isPending && removingId === p.id}
              className="font-serif text-xs text-ink-soft underline underline-offset-2 hover:text-alert disabled:opacity-60"
            >
              {isPending && removingId === p.id ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}
      </div>

      {!atLimit && (
        <form
          action={handleAdd}
          className="mt-3 flex items-center gap-2.5"
        >
          <input
            name="name"
            type="text"
            required
            maxLength={200}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="Add a guest's name"
            className="field flex-1"
          />
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-quiet"
          >
            Add
          </button>
        </form>
      )}
      {addError && <p className="mt-2 font-reading text-xs text-alert">{addError}</p>}
    </section>
  );
}

function EventCard({ event, existing }: { event: EventRow; existing: RsvpRow | undefined }) {
  const [attending, setAttending] = useState<boolean | null>(existing?.attending ?? null);
  const hasExtras = !!(existing?.dietary_requirements || existing?.notes);
  const [extrasOpen, setExtrasOpen] = useState(hasExtras);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formEl: HTMLFormElement, nextAttending: boolean) {
    setSaved(false);
    setError(null);
    const formData = new FormData(formEl);
    startTransition(async () => {
      const result = await updateOwnRsvp({
        eventId: event.id,
        attending: nextAttending,
        dietaryRequirements: String(formData.get("dietaryRequirements") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (attending === null) return;
        handleSubmit(e.currentTarget, attending);
      }}
      className="surface p-8"
    >
      <h3 className="font-display text-[19px]">{event.name}</h3>
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
              maxLength={1000}
              defaultValue={existing?.dietary_requirements ?? ""}
              className="field w-full"
              rows={2}
            />
            <textarea
              name="notes"
              placeholder="Anything else we should know?"
              maxLength={1000}
              defaultValue={existing?.notes ?? ""}
              className="field w-full"
              rows={2}
            />
          </div>
        </DisclosureContent>
      </Disclosure>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="submit"
          disabled={isPending || attending === null}
          className="btn btn-primary"
        >
          {isPending ? "Saving…" : existing ? "Update RSVP" : "Send RSVP"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 font-serif text-xs text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Saved
          </span>
        )}
      </div>
      {error && <p className="mt-2 font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}

// Once the day has gone there is nothing to change: just say what happened.
function PastEventCard({ event, existing }: { event: EventRow; existing: RsvpRow | undefined }) {
  const when = event.starts_at
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(event.starts_at))
    : null;
  const headline =
    existing?.attending === true
      ? "You attended! 🎉"
      : existing?.attending === false
        ? "You couldn’t make it. You were missed!"
        : "We didn’t get an RSVP from you for this one.";
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h3 className="font-display text-[19px]">{event.name}</h3>
      <p className="mt-1 font-reading text-sm text-ink-soft">{[when, event.location].filter(Boolean).join(" · ")}</p>
      <p className="mt-3 font-title text-[18px]">{headline}</p>
      {existing?.dietary_requirements && (
        <p className="mt-2 font-reading text-sm text-ink-soft">Dietary: {existing.dietary_requirements}</p>
      )}
      {existing?.notes && <p className="mt-1 font-reading text-sm text-ink-soft">Your note: {existing.notes}</p>}
    </div>
  );
}
