import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import { SiteNav } from "@/components/SiteNav";

export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "couple" && profile.role !== "family")) {
    redirect("/login");
  }

  return (
    <div className="flex-1">
      <SiteNav role={profile.role} />
      <div className="px-6 py-10 md:px-12">{children}</div>
    </div>
  );
}
