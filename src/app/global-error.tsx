"use client";

// error.tsx doesn't catch errors thrown by the root layout itself — only
// global-error.tsx does, and because it replaces the root layout entirely
// while active, it has to render its own <html>/<body>. Kept intentionally
// plain (no fonts/Tailwind theme tokens) since this is the very last resort
// if layout.tsx itself is what broke.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1>Something went wrong</h1>
        <p>That&rsquo;s on us, not you — please try again in a moment.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "16px",
            borderRadius: "9999px",
            padding: "10px 20px",
            background: "#232520",
            color: "#f4f1ec",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
