// Runs once per server instance. onRequestError is Next's hook for any error
// thrown while serving a request (server components, route handlers, server
// actions); it records it in error_log for the couple's Errors page. Only the
// Node runtime — the database client isn't wired for the edge runtime, and
// the couple-facing pages all run on Node.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logServerError } = await import("@/lib/errors/log");
  await logServerError(err, request, context);
}
