import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google/drive";
import { readState, sealToken } from "@/lib/google/secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROOT_DOMAIN } from "@/lib/wedding/host";

// Where Google sends the couple back after they agree. The signed note from
// /api/google/oauth/start says which wedding this is (there's no session here:
// this address can be on a different host from the wedding). Makes a folder in
// the couple's own Drive, stores the sign-in encrypted with the wedding, and
// returns them to their settings.
export const dynamic = "force-dynamic";

function safeBack(back: string): string | null {
  try {
    const u = new URL(back);
    const h = u.hostname;
    const ok = h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`) || h.endsWith(".vercel.app") || h === "localhost";
    return ok && (u.protocol === "https:" || h === "localhost") ? u.toString() : null;
  } catch {
    return null;
  }
}

function page(title: string, body: string, status = 400) {
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Georgia,serif;max-width:560px;margin:72px auto;padding:0 20px;line-height:1.6;color:#232520;background:#f4f1ec"><h1 style="font-weight:500">${title}</h1>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = readState(params.get("state"));
  if (!state) return page("That link has expired", "<p>Go back to your wedding's settings and press Connect Google Drive again.</p>");
  const back = safeBack(state.back);
  if (!back) return page("Something's not right", "<p>Go back to your wedding's settings and try again.</p>");

  if (params.get("error")) return NextResponse.redirect(`${back}?drive=cancelled`);
  const code = params.get("code");
  if (!code) return NextResponse.redirect(`${back}?drive=failed`);

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) return NextResponse.redirect(`${back}?drive=no-token`);
    client.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: client });

    const admin = createAdminClient(state.w);
    const { data: wedding } = await admin.from("weddings").select("display_name").eq("id", state.w).maybeSingle();
    if (!wedding) return page("That wedding no longer exists", "<p>Nothing was connected.</p>", 404);

    const folderName = `Weddings Weddings – ${wedding.display_name}`;
    const { data: folder } = await drive.files.create({
      requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    if (!folder.id) return NextResponse.redirect(`${back}?drive=failed`);

    let account: string | null = null;
    try {
      account = (await drive.about.get({ fields: "user(emailAddress)" })).data.user?.emailAddress ?? null;
    } catch {
      // not essential
    }

    const { error } = await admin.from("wedding_secrets").upsert(
      {
        wedding_id: state.w,
        drive_refresh_token: sealToken(tokens.refresh_token),
        drive_folder_id: folder.id,
        drive_folder_name: folderName,
        drive_account: account,
        drive_connected_at: new Date().toISOString(),
      },
      { onConflict: "wedding_id" }
    );
    if (error) {
      console.error("Saving the Drive connection failed:", error.message);
      return NextResponse.redirect(`${back}?drive=failed`);
    }
    return NextResponse.redirect(`${back}?drive=connected`);
  } catch (err) {
    console.error("Google Drive connection failed:", err);
    return NextResponse.redirect(`${back}?drive=failed`);
  }
}
