import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Temporary diagnostics page — safe to delete once sign-in is confirmed working.
// Deliberately exempt from the auth gate so it can report on a *failing* session.
export const dynamic = "force-dynamic";

export default async function WhoAmIPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  let profile = null;
  let profileError: string | null = null;
  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
    profileError = error?.message ?? null;
  }

  const authCookies = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => `${c.name} (${c.value.length} chars)`);

  const rows: [string, string][] = [
    ["Host seen by server", headerStore.get("host") ?? "(none)"],
    ["Middleware saw session", headerStore.get("x-mw-user") ?? "(header missing)"],
    ["Auth cookies received", authCookies.length ? authCookies.join(", ") : "NONE"],
    ["getUser() result", user ? `OK — ${user.email}` : `NULL${userError ? ` — ${userError.message}` : ""}`],
    ["Profile row", profile ? `role=${profile.role}` : "NONE"],
    ["Profile error", profileError ?? "(none)"],
  ];

  return (
    <main className="flex-1 px-6 py-10">
      <h1 className="font-script text-3xl">Sign-in diagnostics</h1>
      <table className="mt-6 w-full max-w-2xl border border-ink/20 font-mono text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-ink/10">
              <td className="border-r border-ink/10 px-3 py-2 font-semibold">{k}</td>
              <td className="px-3 py-2 break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
