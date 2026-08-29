import Link from "next/link";
import { getAuthState } from "@/lib/auth/roles";

// Terminus for "signed in, but not allowed here". Crucially this is NOT a
// redirect back to /login — sending an already-authenticated user to the
// sign-in page is what produced the endless sign-in loop.
export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const state = await getAuthState();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-script text-4xl">You&rsquo;re signed in</h1>
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
            , but we haven&rsquo;t added you to the guest list yet. Give Nick or
            Ellie a nudge and they&rsquo;ll sort it.
          </>
        ) : (
          <>That part of the site isn&rsquo;t open to your account.</>
        )}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="rounded-full bg-ink px-8 py-3 font-serif text-cream transition hover:bg-ink-soft"
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
