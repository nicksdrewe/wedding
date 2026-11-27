import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignedInUser, isPlatformAdminEmail } from "@/lib/platform/auth";
import { loadMyWeddings } from "@/lib/platform/mine";
import { weddingLinkFactory } from "@/lib/platform/links";
import { Selector } from "./Selector";
import "./me.css";

export const metadata: Metadata = { title: "Your weddings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Every wedding you're part of, in one place: jump into any of them, answer
// invitations, and see what's waiting for you.
export default async function MePage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=/me");
  const [weddings, link] = await Promise.all([loadMyWeddings(user.id), weddingLinkFactory()]);
  const cards = weddings.map((w) => ({
    ...w,
    href: link(w.slug, "/hub"),
    rsvpHref: link(w.slug, `/rsvp/${w.rsvpToken}`),
    inboxHref: link(w.slug, "/comms"),
    tasksHref: link(w.slug, "/project"),
  }));
  return <Selector weddings={cards} owner={isPlatformAdminEmail(user.email)} email={user.email} />;
}
