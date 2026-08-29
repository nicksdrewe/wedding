import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
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
  if (state.profile.role !== "couple") redirect("/no-access");

  return <AppShell profile={state.profile}>{children}</AppShell>;
}
