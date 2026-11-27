import { getCurrentWedding } from "@/lib/wedding/current";
import { eitherOf, namesFrom } from "@/lib/wedding/names";

export default async function RsvpLandingPage() {
  const either = eitherOf(namesFrom(await getCurrentWedding()));
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl">RSVP</h1>
      <p className="mt-4 max-w-md font-serif text-ink-soft">
        Your invitation email contains a personal RSVP link — follow that to
        respond. Can&rsquo;t find it? Let {either} know and they&rsquo;ll
        resend it.
      </p>
    </main>
  );
}
