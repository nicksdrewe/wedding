"use client";

import { useState, useTransition } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { setMyPhoto } from "./actions";

// "Your photo" on My Details, for the couple and the wedding party.
export function MyPhoto({ name, url }: { name: string; url: string | null }) {
  const [photo, setPhoto] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string | null) {
    setError(null);
    const before = photo;
    setPhoto(next);
    startTransition(async () => {
      const result = await setMyPhoto(next);
      if (result?.error) {
        setPhoto(before);
        setError(result.error);
      }
    });
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <section className="surface surface-raised flex flex-col items-center gap-3 p-6 text-center">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-28 w-28 rounded-full object-cover shadow-md ring-2 ring-sec/40" />
      ) : (
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-sec-tint font-title text-4xl text-sec">{initial}</span>
      )}
      <h2 className="font-title text-[22px] leading-tight">Your photo</h2>
      <p className="max-w-xs font-reading text-[13px] text-ink-soft">
        It appears beside your name on the wedding party chart and the guest list.
      </p>
      <div className="flex items-center gap-3">
        <ImageUpload onUploaded={(u) => save(u)} label={photo ? "Change photo" : "Add a photo"} />
        {photo && (
          <button type="button" disabled={pending} onClick={() => save(null)} className="btn btn-quiet btn-sm">
            Remove
          </button>
        )}
      </div>
      {error && <p className="font-reading text-xs text-alert">{error}</p>}
    </section>
  );
}
