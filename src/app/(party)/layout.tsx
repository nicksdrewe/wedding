import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { SiteNav } from "@/components/SiteNav";

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

  return (
    <div className="flex-1">
      <SiteNav role={state.profile.role} />
      <div className="px-6 py-10 md:px-12">{children}</div>
    </div>
  );
}
