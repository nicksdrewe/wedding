import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { SiteNav } from "@/components/SiteNav";

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

  return (
    <div className="flex-1">
      <SiteNav role={state.profile.role} />
      <div className="px-6 py-10 md:px-12">{children}</div>
    </div>
  );
}
