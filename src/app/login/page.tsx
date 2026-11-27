import { Suspense } from "react";
import { SiteGate } from "@/components/SiteGate";
import { weddingHasGate } from "@/lib/gate/actions";
import { LoginForm } from "./LoginForm";

// Behind the couple's access code, same as the front page: only people who've
// been given the code (or arrived by their own invite link) reach sign-in.
export default async function LoginPage() {
  return (
    <SiteGate enabled={await weddingHasGate()}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </SiteGate>
  );
}
