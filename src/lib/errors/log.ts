import { createAdminClient } from "@/lib/supabase/admin";

// Server-error recorder behind instrumentation.ts's onRequestError. Must never
// throw or slow a request: every failure here is swallowed. Keeps no personal
// data (see 0039_error_log.sql) — notably it logs the route TEMPLATE
// ("/rsvp/[token]"), never the real URL, because some URLs are capability
// links that grant access to whoever holds them.

type RequestInfo = { path?: string; method?: string };
type ErrorContext = { routePath?: string; routeType?: string };

// A flood guard: one broken page hit by many visitors shouldn't write
// thousands of rows or hammer the database. Per server instance, per minute.
const MAX_PER_MINUTE = 30;
let windowStart = 0;
let windowCount = 0;

function shorten(message: string): string {
  return (
    message
      // Anything that looks like a token/secret/id blob.
      .replace(/[A-Za-z0-9_-]{32,}/g, "…")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300) || "Unknown error"
  );
}

export async function logServerError(err: unknown, request: RequestInfo, context: ErrorContext): Promise<void> {
  try {
    const now = Date.now();
    if (now - windowStart > 60_000) {
      windowStart = now;
      windowCount = 0;
    }
    if (++windowCount > MAX_PER_MINUTE) return;

    const error = err as { message?: string; digest?: string; name?: string } | null;
    const message = String(error?.message ?? err ?? "");
    // Next's control-flow signals aren't errors.
    if (/NEXT_REDIRECT|NEXT_NOT_FOUND|DYNAMIC_SERVER_USAGE/.test(message) || /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(error?.digest ?? "")) return;

    await createAdminClient().from("error_log").insert({
      // The template when Next knows it; otherwise just the first path
      // segment — never a full URL.
      route: context.routePath ?? `/${(request.path ?? "").split("?")[0].split("/")[1] ?? ""}`,
      route_type: context.routeType ?? null,
      method: request.method ?? null,
      message: shorten(message),
      digest: error?.digest ?? null,
    });
  } catch {
    // Reporting an error must never cause one.
  }
}
