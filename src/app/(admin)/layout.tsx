import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { SiteNav } from "@/components/SiteNav";

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

  return (
    <div className="flex-1">
      <SiteNav role={state.profile.role} />
      <div className="px-6 py-10 md:px-12">{children}</div>
    </div>
  );
}
