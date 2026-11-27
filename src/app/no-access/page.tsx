import Link from "next/link";
import { getAuthState, getCurrentContactTags, homeFor } from "@/lib/auth/roles";
import { getCurrentWedding } from "@/lib/wedding/current";
import { eitherOf, namesFrom } from "@/lib/wedding/names";

// Terminus for "signed in, but not allowed here". Crucially this is NOT a
// redirect back to /login — sending an already-authenticated user to the
// sign-in page is what produced the endless sign-in loop.
export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const names = namesFrom(await getCurrentWedding());
  const state = await getAuthState();
  const tags = state.status === "ok" ? await getCurrentContactTags(state.profile) : [];

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-4xl">You&rsquo;re signed in</h1>
      <p className="mt-4 max-w-md font-serif text-ink-soft">
        {state.status === "no-profile" ? (
          <>
            You&rsquo;re signed in
            {state.email ? (
              <>
                {" "}
                as <span className="text-ink">{state.email}</span>
              </>
            ) : null}
            , but we haven&rsquo;t added you to the guest list yet. Give {eitherOf(names)} a
            nudge and they&rsquo;ll sort it.
          </>
        ) : (
          <>That part of the site isn&rsquo;t open to your account.</>
        )}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {state.status === "ok" && (
          <Link
            href={homeFor(state.profile.role, tags)}
            className="rounded-full bg-ink px-8 py-3 font-serif text-cream transition hover:bg-ink-soft"
          >
            Go to my page
          </Link>
        )}
        <Link
          href="/"
          className={
            state.status === "ok"
              ? "rounded-full border border-ink/30 px-8 py-3 font-serif text-ink transition hover:border-ink"
              : "rounded-full bg-ink px-8 py-3 font-serif text-cream transition hover:bg-ink-soft"
          }
        >
          Back to the home page
        </Link>
        <Link
          href="/logout"
          className="rounded-full border border-ink/30 px-8 py-3 font-serif text-ink transition hover:border-ink"
        >
          Sign out
        </Link>
      </div>
    </main>
  );
}
