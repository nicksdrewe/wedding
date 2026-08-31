"use client";

// The app had NO error boundary anywhere — any thrown server component
// error (a Supabase outage, a bad query) fell straight through to Next's
// own raw, unstyled error screen with no way back. This is the root
// boundary: it catches anything not caught by a more specific error.tsx
// deeper in a route group.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      <p className="font-serif text-xs tracking-[0.3em] text-ink-soft uppercase">Nick &amp; Ellie</p>
      <h1 className="mt-3 font-display text-3xl text-ink">Something went wrong</h1>
      <p className="mt-3 max-w-xs font-reading text-sm text-ink-soft italic">
        That&rsquo;s on us, not you — please try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-full bg-ink px-6 py-3 font-serif text-sm text-cream transition hover:bg-ink-soft"
      >
        Try again
      </button>
    </main>
  );
}
