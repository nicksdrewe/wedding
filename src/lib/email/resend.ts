// Server-only — the API key must never reach the browser.
//
// No SDK dependency: Resend's REST API is a single POST, and pulling in
// their whole client for one call isn't worth the extra install. Requires
// RESEND_API_KEY and RESEND_FROM_EMAIL to be set (see the couple-facing
// error CommsComposer surfaces if they aren't — this is meant to fail
// loudly in the UI, not silently no-op).
//
// Deliberately called ONE RECIPIENT AT A TIME from the client (see
// actions.ts's sendToRecipient), not as a single bulk send looping over
// the whole audience inside one server action — a guest list of 80+
// people, sent sequentially with enough spacing to respect Resend's rate
// limit, would run well past Vercel's serverless function time limit on
// a single request. Sending one at a time from the client sidesteps that
// entirely and gets a natural progress indicator for free.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return {
      error:
        "Email sending isn't set up yet — RESEND_API_KEY and RESEND_FROM_EMAIL need to be configured.",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { error: body?.message ?? `Resend returned ${res.status}` };
  }

  return { error: null };
}
