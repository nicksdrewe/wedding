import { redirect } from "next/navigation";
import { getAuthState, getCurrentContactTags } from "@/lib/auth/roles";
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
  // Every role reaches this route group now (Diary needs to be reachable
  // by guest/wedding_party too, per the account-capabilities brief) — the
  // fine-grained "which pages under here can this role actually see"
  // check happens per-page via getEffectivePermission, same pattern as
  // (admin)/(party) below it.

  const tags = await getCurrentContactTags(state.profile);
  return <AppShell profile={state.profile} tags={tags}>{children}</AppShell>;
}
