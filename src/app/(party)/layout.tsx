import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { AppShell } from "@/components/AppShell";

export default async function PartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getAuthState();

  if (state.status === "anonymous") redirect("/login?next=/project");
  if (state.status === "no-profile") redirect("/no-access");
  if (state.profile.role !== "couple" && state.profile.role !== "wedding_party") {
    redirect("/no-access");
  }

  return <AppShell profile={state.profile}>{children}</AppShell>;
}
