import Link from "next/link";
import { ArrowRight, Images } from "lucide-react";
import { toDriveImageUrl } from "@/lib/google/image-url";

// A big, bold doorway to an idea board: the night garden with a slowly
// turning ring of light and the board's own photos floating in it. It is one
// link, so the whole thing is the tap target. The motion is CSS only and is
// stilled by the global prefers-reduced-motion rule; the photos are small
// and lazy-loaded.
export type PortalIdea = { images: { image_url: string; sort_order: number }[] };

export function portalThumbs(ideas: PortalIdea[], max = 4): string[] {
  const urls: string[] = [];
  for (const idea of ideas) {
    const first = [...(idea.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    if (first) urls.push(first.image_url);
    if (urls.length >= max) break;
  }
  return urls;
}

const SLOTS = [
  { left: "6%", top: "10%", size: 84, rot: -8, delay: "0s" },
  { left: "40%", top: "4%", size: 96, rot: 5, delay: "-1.5s" },
  { left: "20%", top: "52%", size: 92, rot: 7, delay: "-3s" },
  { left: "58%", top: "46%", size: 80, rot: -6, delay: "-4.5s" },
];

export function IdeaPortal({
  href,
  title,
  count,
  thumbs,
  blurb,
}: {
  href: string;
  title: string;
  count: number;
  thumbs: string[];
  blurb: string;
}) {
  return (
    <Link href={href} className="portal group">
      <span className="portal__ring" aria-hidden="true" />
      <span className="portal__ring portal__ring--b" aria-hidden="true" />

      <span className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
        <span className="flex items-center gap-2 font-serif text-[11px] font-semibold tracking-[0.2em] text-sec-glow uppercase">
          <Images className="h-4 w-4" strokeWidth={2} />
          {count === 0 ? "Start the board" : `${count} ${count === 1 ? "idea" : "ideas"}`}
        </span>
        <span className="mt-2 font-title text-[clamp(30px,6vw,44px)] leading-[1.02] tracking-tight text-white">{title}</span>
        <span className="mt-2 max-w-[34ch] font-reading text-[15px] leading-snug text-cream/80">{blurb}</span>
        <span className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-cream px-5 font-serif text-[14px] font-semibold text-night shadow-[0_10px_26px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:translate-x-1">
          Step inside
          <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
        </span>
      </span>

      <span className="portal__stage" aria-hidden="true">
        {thumbs.length === 0 ? (
          <span className="portal__empty font-title text-[40px] text-cream/40">+</span>
        ) : (
          thumbs.slice(0, SLOTS.length).map((url, i) => {
            const s = SLOTS[i];
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url + i}
                src={toDriveImageUrl(url)}
                alt=""
                loading="lazy"
                decoding="async"
                className="portal__photo"
                style={{
                  left: s.left,
                  top: s.top,
                  width: s.size,
                  height: s.size,
                  ["--rot" as string]: `${s.rot}deg`,
                  animationDelay: s.delay,
                }}
              />
            );
          })
        )}
      </span>
    </Link>
  );
}
