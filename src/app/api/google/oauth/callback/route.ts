import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getOAuthClient } from "@/lib/google/drive";

// Displays the refresh token once, for the couple to copy into
// .env.local/Vercel themselves — matching how every other secret in this
// project is handled (env vars the user manages directly, never stored in
// the database, never posted back through chat).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return htmlResponse(`<p>Google reported an error: ${escapeHtml(error)}</p>`);
  }
  if (!code) {
    return htmlResponse("<p>No authorization code was returned.</p>");
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return htmlResponse(`
        <p>Google didn't return a refresh token — this usually means you've
        already authorized this app before, and Google only guarantees
        issuing a fresh one the first time.</p>
        <p>Go to <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google's permissions page</a>,
        remove access for this app, then try
        <a href="/api/google/oauth/start">connecting again</a>.</p>
      `);
    }

    return htmlResponse(`
      <p>Connected. Copy the value below into <code>.env.local</code> (and Vercel's environment variables) as:</p>
      <pre style="white-space: pre-wrap; word-break: break-all; background: #f4f1ec; padding: 16px; border-radius: 8px;">GOOGLE_OAUTH_REFRESH_TOKEN=${escapeHtml(
        tokens.refresh_token
      )}</pre>
      <p>Then restart the dev server locally, and redeploy on Vercel for it to take effect there.</p>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return htmlResponse(`<p>Token exchange failed: ${escapeHtml(message)}</p>`);
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlResponse(body: string) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family: sans-serif; max-width: 640px; margin: 60px auto; line-height: 1.6; padding: 0 20px;">${body}</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
