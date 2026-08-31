import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { PageHeader } from "@/components/PageHeader";
import { EventForm } from "../EventForm";

// Nested under (family)/diary rather than (admin) — the (family) layout
// already allows family/wedding_party in for the read-only diary view;
// this inline check is what actually restricts creating/editing an event
// to the couple, same pattern the guests page uses for its own
// couple-only reality inside a broader route group.
export default async function NewEventPage() {
  const state = await getAuthState();
  if (state.status !== "ok" || state.profile.role !== "couple") redirect("/no-access");

  return (
    <div>
      <PageHeader
        eyebrow="Us"
        title="Add an event"
        description="Tick on whatever this event needs — each one reveals what to fill in for it."
      />
      <div className="mt-8 max-w-2xl">
        <EventForm />
      </div>
    </div>
  );
}
