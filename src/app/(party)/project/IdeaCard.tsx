"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { toDriveImageUrl } from "@/lib/google/image-url";
import { addIdeaImage, deleteIdea, removeIdeaImage, updateIdea } from "./actions";
import { Feedback } from "@/components/feedback/Feedback";
import type { FeedbackData } from "@/lib/feedback/types";

export type IdeaImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

export function IdeaCard({
  id,
  title,
  body,
  tags,
  images,
  canEdit,
  feedback,
  canInteract = true,
  canModerate = false,
  revalidate = "/project",
}: {
  id: string;
  title: string;
  body: string | null;
  tags: string[];
  images: IdeaImage[];
  canEdit: boolean;
  // Votes and comments (0037).
  feedback?: FeedbackData;
  canInteract?: boolean;
  canModerate?: boolean;
  revalidate?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imagePending, startImageTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Delete this idea? This can not be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteIdea(id);
      if (result?.error) setError(result.error);
    });
  }

  function handleUploaded(url: string) {
    setError(null);
    startImageTransition(async () => {
      const result = await addIdeaImage(id, url);
      if (result.error) setError(result.error);
    });
  }

  function handleRemoveImage(imageId: string) {
    setError(null);
    setRemovingId(imageId);
    startImageTransition(async () => {
      const result = await removeIdeaImage(imageId);
      if (result.error) setError(result.error);
      setRemovingId(null);
    });
  }

  if (editing) {
    return (
      <li className="surface p-4">
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await updateIdea(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setEditing(false);
            })
          }
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input
            name="title"
            required
            defaultValue={title}
            placeholder="Idea title"
            className="field w-auto"
          />
          <textarea
            name="body"
            defaultValue={body ?? ""}
            placeholder="Details (optional)"
            rows={2}
            className="field w-auto"
          />
          <input
            name="tags"
            defaultValue={tags.join(", ")}
            placeholder="Tags (comma, separated)"
            className="field w-auto"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary self-start"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-quiet self-start"
            >
              Cancel
            </button>
          </div>
          {error && <p className="font-reading text-xs text-alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="surface surface-lift group p-4 duration-150">
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-sm font-semibold">{title}</p>
        {canEdit && (
          <div className="flex shrink-0 gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {body && <p className="mt-1.5 font-reading text-[13px] text-ink-soft">{body}</p>}

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-soft">
              {tag}
            </span>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {images.map((img) => (
            <div key={img.id} className="group/img relative aspect-square overflow-hidden rounded-[6px] bg-cream-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toDriveImageUrl(img.image_url)} alt={title} className="h-full w-full object-cover" />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  disabled={removingId === img.id}
                  aria-label="Remove image"
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity group-hover/img:opacity-100 disabled:opacity-100"
                >
                  {removingId === img.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-2.5">
          <ImageUpload onUploaded={handleUploaded} label="Add photo" />
        </div>
      )}
      {imagePending && !removingId && (
        <p className="mt-1 font-reading text-[11px] text-ink-soft/60 italic">Uploading…</p>
      )}

      <Feedback
        targetType="idea"
        targetId={id}
        data={feedback}
        canInteract={canInteract}
        canModerate={canModerate}
        revalidate={revalidate}
        className="mt-3"
      />

      {error && <p className="mt-1.5 font-reading text-xs text-alert">{error}</p>}
    </li>
  );
}
