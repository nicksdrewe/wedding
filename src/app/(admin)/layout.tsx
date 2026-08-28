import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "couple") {
    redirect("/login");
  }

  return <div className="flex-1 px-6 py-10 md:px-12">{children}</div>;
}
