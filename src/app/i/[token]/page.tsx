import { isValidInviteToken } from "@/lib/invite/validate";
import { InviteRedirect } from "./InviteRedirect";

// The short "shortlink style" URL the couple hands to every engagement
// party invitee (see InviteLinkButton on /guests) instead of the site's
// access code — the same link works for all 80+ of them, indefinitely,
// until the couple regenerates it. Always redirects to "/"; an invalid or
// revoked token just skips unlocking the gate, so that visitor lands on
// the normal code-entry screen instead of an error page.
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await isValidInviteToken(token);

  return <InviteRedirect valid={valid} />;
}
