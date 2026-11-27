import { NextResponse } from "next/server";
import { getCurrentWedding } from "@/lib/wedding/current";
import { namesFrom } from "@/lib/wedding/names";
import { paletteFor, type WeddingTheme } from "@/lib/wedding/theme";

// The installable-app manifest, named for the wedding this address belongs to.
export async function GET() {
  const wedding = await getCurrentWedding();
  const names = namesFrom(wedding);
  const p = paletteFor((wedding?.theme ?? {}) as WeddingTheme);
  const short = names.partnerTwo ? `${names.partnerOne[0]} & ${names.partnerTwo[0]}` : names.displayName;
  return NextResponse.json(
    {
      id: "/",
      name: `${names.displayName}’s Wedding`,
      short_name: short,
      description: `${names.displayName}’s wedding hub: planning, the Big Day schedule, RSVPs and gifting.`,
      start_url: "/hub",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: p.base.night,
      theme_color: p.base.cream,
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } }
  );
}
