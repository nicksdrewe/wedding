"use client";

import { useSearchParams } from "next/navigation";
import { LoginExperience } from "@/components/auth/LoginExperience";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";
  return <LoginExperience next={next} startAt={searchParams.get("step")} />;
}
