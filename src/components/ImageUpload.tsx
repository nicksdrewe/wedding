"use client";

import { useRef, useState } from "react";

// Drop-in "add a photo" control backed by /api/upload → the couple's
// shared Google Drive folder. Callers just get a URL back once the upload
// finishes — what happens with it (add to a list, save to a form field,
// etc.) is up to them.
export function ImageUpload({
  onUploaded,
  label = "Add photo",
  className,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Upload failed — try again.");
      return;
    }
    const { url } = await res.json();
    onUploaded(url);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-ink/20 bg-cream px-4 py-2 font-serif text-sm text-ink-soft transition hover:border-accent disabled:opacity-60">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleChange}
          disabled={busy}
          className="hidden"
        />
        {busy ? "Uploading…" : label}
      </label>
      {error && <p className="font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}
