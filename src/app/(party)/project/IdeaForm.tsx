"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { toDriveImageUrl } from "@/lib/google/image-url";
import { addIdea } from "./actions";

// Add an idea to the main moodboard — title, optional details and tags, and
// an optional first photo uploaded to the shared Drive folder. Open to the
// couple, family, best man and maid of honour (0038_moodboard_contributors
// .sql); the database decides, this just offers it to the right people.
export function IdeaForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          if (imageUrl) formData.set("imageUrl", imageUrl);
          const result = await addIdea(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          setImageUrl(null);
        })
      }
      className="mt-3 flex flex-col gap-2"
    >
      <input
        name="title"
        required
        placeholder="Idea title"
        className="field w-auto"
      />
      <textarea
        name="body"
        placeholder="Details (optional)"
        rows={2}
        className="field w-auto"
      />
      <input
        name="tags"
        placeholder="Tags (comma, separated)"
        className="field w-auto"
      />

      <div className="flex flex-wrap items-center gap-3">
        {imageUrl ? (
          <div className="relative h-14 w-14 overflow-hidden rounded-[8px] bg-cream-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toDriveImageUrl(imageUrl)} alt="Photo to add" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              aria-label="Remove photo"
              className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-cream"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <ImageUpload onUploaded={setImageUrl} label="Add a photo" />
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Adding…" : "Add idea"}
        </button>
      </div>
      {error && <p className="font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}
