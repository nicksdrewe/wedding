import { redirect } from "next/navigation";
import { getAuthState, getCurrentContactTags } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SetPasswordForm } from "./SetPasswordForm";
import { MyDetailsForm } from "./MyDetailsForm";

export default async function AccountPage() {
  const state = await getAuthState();
  if (state.status === "anonymous") redirect("/login?next=/account");

  const profile = state.status === "ok" ? state.profile : null;

  let contact: {
    id: string;
    full_name: string;
    guest_note: string | null;
    plus_one_limit: number;
  } | null = null;
  let plusOnes: { id: string; full_name: string }[] = [];
  let events: { id: string; name: string; starts_at: string | null; location: string | null }[] = [];
  let rsvps: {
    event_id: string;
    attending: boolean | null;
    dietary_requirements: string | null;
    notes: string | null;
  }[] = [];

  if (profile?.contact_id) {
    const supabase = await createClient();

    const [{ data: contactRow }, { data: plusOneRows }, { data: eventRows }, { data: rsvpRows }] =
      await Promise.all([
        supabase
          .from("contacts")
          .select("id, full_name, guest_note, plus_one_limit")
          .eq("id", profile.contact_id)
          .maybeSingle(),
        supabase
          .from("contacts")
          .select("id, full_name")
          .eq("parent_contact_id", profile.contact_id)
          .order("created_at", { ascending: true }),
        // Same rsvp_enabled filter as the token-gated RSVP flow (see
        // api/rsvp/[token]/route.ts) — a guest shouldn't see an RSVP card
        // for an event the couple hasn't opened responses on yet.
        supabase
          .from("events")
          .select("id, name, starts_at, location")
          .eq("rsvp_enabled", true)
          .order("starts_at", { ascending: true }),
        supabase
          .from("rsvps")
          .select("event_id, attending, dietary_requirements, notes")
          .eq("contact_id", profile.contact_id),
      ]);

    contact = contactRow ?? null;
    plusOnes = plusOneRows ?? [];
    events = eventRows ?? [];
    rsvps = rsvpRows ?? [];
  }

  // /account sits outside every (admin)/(family)/(party) route group (it's
  // reachable by every role, including guest, so it can't live under any
  // of their layouts) — it renders AppShell directly here instead, same as
  // those layouts do, so nav stays consistent everywhere rather than this
  // one page using the older, now-unused SiteNav component.
  const content = (
    <div className="flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="text-center font-display text-4xl">Your account</h1>

        {contact && (
          <div className="mt-12">
            <MyDetailsForm contact={contact} plusOnes={plusOnes} events={events} rsvps={rsvps} />
          </div>
        )}

        <div className="mx-auto mt-12 w-full max-w-sm">
          <h2 className="text-center font-display text-2xl">Password</h2>
          <p className="mt-2 text-center font-serif text-ink-soft">
            Set a password so you can sign in instantly next time, without
            waiting on an email code.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </div>
  );

  if (state.status !== "ok") return content;

  const tags = await getCurrentContactTags(state.profile);
  return (
    <AppShell profile={state.profile} tags={tags}>
      {content}
    </AppShell>
  );
}
