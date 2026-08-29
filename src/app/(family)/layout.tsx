import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { AppShell } from "@/components/AppShell";

export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getAuthState();

  // See the note in (admin)/layout.tsx: never redirect an authenticated user
  // back to /login, or they loop.
  if (state.status === "anonymous") redirect("/login?next=/categories");
  if (state.status === "no-profile") redirect("/no-access");
  if (state.profile.role !== "couple" && state.profile.role !== "family") {
    redirect("/no-access");
  }

  return <AppShell profile={state.profile}>{children}</AppShell>;
}
