import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/roles";
import { SiteNav } from "@/components/SiteNav";
import { SetPasswordForm } from "./SetPasswordForm";

export default async function AccountPage() {
  const state = await getAuthState();
  if (state.status === "anonymous") redirect("/login?next=/account");

  return (
    <div className="flex-1">
      {state.status === "ok" && <SiteNav role={state.profile.role} />}
      <div className="flex flex-col items-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-center font-script text-4xl">Your account</h1>
          <p className="mt-2 text-center font-serif text-ink-soft">
            Set a password so you can sign in instantly next time, without
            waiting on an email code.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </div>
  );
}
