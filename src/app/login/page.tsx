"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Botanical } from "@/components/Botanical";
import { SignInFields } from "@/components/SignInFields";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <Botanical
        seed={7}
        stems={1}
        width={110}
        height={170}
        spread={8}
        strokeOpacity={0.7}
        fillOpacity={0.35}
        className="pointer-events-none absolute -top-2 -right-2"
      />

      <div className="relative z-10 w-full max-w-sm text-center">
        <p className="font-serif text-xs tracking-[0.25em] text-ink-soft uppercase">
          Nick &amp; Ellie
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Sign in</h1>

        <div className="mt-7">
          <SignInFields next={next} />
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
