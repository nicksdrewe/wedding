"use client";

import { useRef, useState, useTransition } from "react";
import { MapPin, X } from "lucide-react";
import { findPlace } from "@/lib/geo/actions";

// One box instead of latitude and longitude: type a postcode, an address or a
// place name, or paste a Google Maps link. It is looked up when you leave the
// box (or press Find), and the result is shown so you can check it. The form
// still sends latitude/longitude, so saving works exactly as before.
export function LocationInput({
  defaultLat,
  defaultLng,
  placeholder = "Postcode, address or Google Maps link",
  className = "",
}: {
  defaultLat?: number | null;
  defaultLng?: number | null;
  placeholder?: string;
  className?: string;
}) {
  const [lat, setLat] = useState<number | null>(defaultLat ?? null);
  const [lng, setLng] = useState<number | null>(defaultLng ?? null);
  const [label, setLabel] = useState<string | null>(defaultLat != null && defaultLng != null ? "On the map" : null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lastLooked = useRef("");

  function look() {
    const q = text.trim();
    if (!q || q === lastLooked.current) return;
    lastLooked.current = q;
    setError(null);
    start(async () => {
      const r = await findPlace(q);
      if (r.place) {
        setLat(r.place.lat);
        setLng(r.place.lng);
        setLabel(r.place.label);
      } else if (r.error) {
        setError(r.error);
      }
    });
  }

  function clear() {
    setLat(null);
    setLng(null);
    setLabel(null);
    setText("");
    setError(null);
    lastLooked.current = "";
  }

  const has = lat != null && lng != null;

  return (
    <div className={className}>
      <input type="hidden" name="latitude" value={lat ?? ""} />
      <input type="hidden" name="longitude" value={lng ?? ""} />
      <div className="flex gap-2">
        <input
          type="text"
          name="locationQuery"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={look}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              look();
            }
          }}
          placeholder={has ? "Change: postcode, address or link" : placeholder}
          className="field min-w-0 flex-1"
          autoComplete="off"
        />
        <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={look} disabled={pending || !text.trim()}>
          {pending ? "Finding…" : "Find"}
        </button>
      </div>
      {has && (
        <p className="mt-1.5 flex items-center gap-1.5 font-reading text-[12px] text-ink-soft">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-sec" aria-hidden="true" />
          <span className="min-w-0 truncate">{label ?? "On the map"}</span>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 underline underline-offset-2 hover:text-ink"
          >
            check
          </a>
          <button type="button" onClick={clear} className="shrink-0 hover:text-alert" aria-label="Remove the location">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </p>
      )}
      {error && <p className="mt-1.5 font-reading text-[12px] text-alert">{error}</p>}
    </div>
  );
}
