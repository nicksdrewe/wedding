"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GATE_STORAGE_KEY } from "@/components/SiteGate";

// Mirrors SiteGate's own "checking" placeholder (a bare full-screen ink
// div) so this doesn't flash a different-looking screen mid-redirect.
export function InviteRedirect({ valid }: { valid: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (valid) {
      try {
        window.localStorage.setItem(GATE_STORAGE_KEY, "true");
      } catch {
        // private mode etc. — SiteGate will just ask for the code instead
      }
    }
    // Replaced, not pushed: landing here isn't a page a visitor should
    // ever navigate "back" to.
    router.replace("/");
  }, [valid, router]);

  return <div className="h-screen w-full bg-ink" aria-hidden="true" />;
}
