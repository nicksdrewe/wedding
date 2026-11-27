"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { gateStorageKey } from "@/components/SiteGate";
import { useWedding } from "@/components/WeddingProvider";

// Mirrors SiteGate's own "checking" placeholder (a bare full-screen ink
// div) so this doesn't flash a different-looking screen mid-redirect.
export function InviteRedirect({ valid }: { valid: boolean }) {
  const router = useRouter();
  const { slug } = useWedding();

  useEffect(() => {
    if (valid) {
      try {
        window.localStorage.setItem(gateStorageKey(slug), "true");
      } catch {
        // private mode etc. — SiteGate will just ask for the code instead
      }
    }
    // Replaced, not pushed: landing here isn't a page a visitor should
    // ever navigate "back" to.
    router.replace("/");
  }, [valid, router, slug]);

  return <div className="h-screen w-full bg-cream" aria-hidden="true" />;
}
