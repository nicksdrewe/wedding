import { redirect } from "next/navigation";
import { getAuthState, getCurrentContactTags } from "@/lib/auth/roles";
import { AppShell } from "@/components/AppShell";

export default async function PartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getAuthState();

  if (state.status === "anonymous") redirect("/login?next=/project");
  if (state.status === "no-profile") redirect("/no-access");
  // Family now has read access into /project (see 0028), so the layout
  // admits couple, wedding_party, OR family. wedding_party stays admitted
  // here even though a PLAIN wedding_party member should be blocked from
  // /project, /project/ideas, /project/expenses specifically — best_man/
  // maid_of_honour ARE wedding_party role with an elevated tag, and they
  // still need through this layout to reach their own gendered sub-pages
  // (bridesmaids/groomsmen). The per-page getEffectivePermission checks on
  // /project, /project/ideas, and /project/expenses are what actually keep
  // a plain wedding_party member out of those specific pages.
  if (
    state.profile.role !== "couple" &&
    state.profile.role !== "wedding_party" &&
    state.profile.role !== "family"
  ) {
    redirect("/no-access");
  }

  const tags = await getCurrentContactTags(state.profile);
  return <AppShell profile={state.profile} tags={tags}>{children}</AppShell>;
}
