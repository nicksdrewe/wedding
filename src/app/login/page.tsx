"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginExperience } from "@/components/auth/LoginExperience";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";
  return <LoginExperience next={next} startAt={searchParams.get("step")} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
