"use client";

// Leaflet pin map for an options board: one marker per option that has both
// latitude and longitude set, with a compact popup (cover image, name,
// predicted cost) styled to match the app's paper-and-ink card language
// instead of Leaflet's default popup chrome.
//
// This file is only ever loaded through OptionsMapLoader's
// next/dynamic(..., { ssr: false }) — importing the `leaflet` package
// evaluates browser-sniffing code (window.requestAnimationFrame etc.) at
// module load time, which throws during Next.js's server render pass. The
// dynamic-import-with-ssr-false wrapper is what keeps this module out of
// that server pass entirely; "use client" alone is not enough, since App
// Router still renders client components once on the server for the initial
// HTML.
import { useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./options-map.css";

// The classic Next.js/webpack + Leaflet gotcha: Leaflet's default marker
// icon is loaded via relative CSS `url(images/marker-icon.png)` paths that
// assume a specific unbundled folder layout, which webpack's module
// resolution doesn't preserve. Left alone, markers render as a broken-image
// icon. The documented fix is to delete Leaflet's built-in icon URL getter
// and re-point it at the bundler-resolved asset URLs instead. Imported as
// static assets, Next's webpack config turns each PNG import into a
// StaticImageData object (see next/image-types/global.d.ts) — the actual
// URL is on its `.src`.
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
  className: "option-pin-icon",
});

export type MapOption = {
  id: string;
  name: string;
  predicted_cost: number | null;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string | null;
};

export function OptionsMap({ options }: { options: MapOption[] }) {
  const pinned = useMemo(
    () =>
      options.filter(
        (o): o is MapOption & { latitude: number; longitude: number } =>
          o.latitude != null && o.longitude != null
      ),
    [options]
  );

  const positions = useMemo<[number, number][]>(
    () => pinned.map((o) => [o.latitude, o.longitude]),
    [pinned]
  );

  if (pinned.length === 0) return null;

  return (
    <div className="wedding-map-shell h-80 w-full border border-ink/10">
      <MapContainer
        bounds={positions}
        boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pinned.map((option) => (
          <Marker key={option.id} position={[option.latitude, option.longitude]}>
            <Popup className="option-popup" minWidth={180} maxWidth={220}>
              <div className="flex items-center gap-3 p-2.5">
                {option.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={option.coverImageUrl}
                    alt={option.name}
                    className="h-12 w-12 shrink-0 rounded-[6px] object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-[6px] bg-cream-deep" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-serif text-[13px] font-semibold text-ink">
                    {option.name}
                  </p>
                  <p className="mt-0.5 font-reading text-xs text-ink-soft">
                    £{option.predicted_cost ?? "—"} predicted
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default OptionsMap;
