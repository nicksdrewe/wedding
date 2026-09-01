import { redirect } from "next/navigation";
import { getAuthState, getCurrentContactTags } from "@/lib/auth/roles";
import { AppShell } from "@/components/AppShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getAuthState();

  // Only send people to /login when they genuinely have no session. An
  // authenticated user who lacks the role gets /no-access, because bouncing
  // them to the sign-in page means signing in again, landing here again,
  // and looping forever.
  if (state.status === "anonymous") redirect("/login?next=/guests");
  if (state.status === "no-profile") redirect("/no-access");
  // Family now has read-only reach into /guests and /budget (see 0028), so
  // the layout itself is relaxed to admit couple OR family. That's
  // deliberately as far as this loosens: /comms and /access must stay
  // couple-only, so each of those pages carries its own explicit
  // couple-only redirect as a backstop rather than relying on this shared
  // guard to keep them locked down.
  if (state.profile.role !== "couple" && state.profile.role !== "family") redirect("/no-access");

  const tags = await getCurrentContactTags(state.profile);
  return <AppShell profile={state.profile} tags={tags}>{children}</AppShell>;
}
