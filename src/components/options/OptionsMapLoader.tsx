"use client";

// Thin client-only boundary around OptionsMap. Leaflet evaluates
// window/navigator-sniffing code at module import time, which crashes
// Next.js's server render pass — next/dynamic's `ssr: false` is what keeps
// the `leaflet` import out of SSR entirely, and that option is only legal
// inside a "use client" module, hence this separate wrapper rather than
// calling dynamic() straight from the (server-component) category page.
import dynamic from "next/dynamic";
import type { MapOption } from "./OptionsMap";

const OptionsMap = dynamic(() => import("./OptionsMap").then((m) => m.OptionsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-[10px] border border-ink/10 bg-cream-deep/40 font-reading text-xs text-ink-soft/70">
      Loading map…
    </div>
  ),
});

export function OptionsMapLoader({ options }: { options: MapOption[] }) {
  return <OptionsMap options={options} />;
}

export default OptionsMapLoader;
