import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Verifies email links (magic link, invite) by token_hash rather than the
// PKCE `code` flow — token_hash doesn't require the click to happen in the
// same browser/device that requested the email, which PKCE does. Email
// links routinely get opened elsewhere (a different tab, a mail app's
// in-app browser), so PKCE fails there. Point the Supabase email templates
// at this route instead of the default confirmation link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
