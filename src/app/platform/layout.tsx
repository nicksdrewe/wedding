import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { PlatformShell } from "./PlatformNav";
import "./platform.css";

export const metadata: Metadata = { title: "Control room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// The site owner's console. Anyone else gets a plain "not found", so the page
// doesn't even admit it exists.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const owner = await requirePlatformAdmin();
  if (!owner) notFound();
  return <PlatformShell email={owner.email}>{children}</PlatformShell>;
}
