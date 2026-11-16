"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { IdeaCard, type IdeaImage } from "../IdeaCard";

// Under a tile on an idea wall: a button that opens the full editor (title,
// details, tags, add or remove photos, delete) in place. It is the same
// editor the lists use, so there is one set of rules for editing an idea.
export function IdeaEditor({
  idea,
  revalidate,
}: {
  idea: { id: string; title: string; body: string | null; tags: string[]; images: IdeaImage[] };
  revalidate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-quiet btn-sm">
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        {open ? "Close" : "Edit"}
      </button>
      {open && (
        <ul className="mt-2">
          <IdeaCard
            id={idea.id}
            title={idea.title}
            body={idea.body}
            tags={idea.tags}
            images={idea.images}
            canEdit
            hideFeedback
            revalidate={revalidate}
          />
        </ul>
      )}
    </div>
  );
}
