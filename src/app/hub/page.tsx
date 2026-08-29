import { redirect } from "next/navigation";
import { getAuthState, HOME_FOR_ROLE } from "@/lib/auth/roles";

// The one place that decides where a signed-in person belongs. Sign-in sends
// everyone here rather than to "/", so the destination is driven by the
// user's actual status instead of by whatever page they happened to start on.
export const dynamic = "force-dynamic";

export default async function HubPage() {
  const state = await getAuthState();

  if (state.status === "anonymous") redirect("/login");
  if (state.status === "no-profile") redirect("/no-access");

  redirect(HOME_FOR_ROLE[state.profile.role]);
}
