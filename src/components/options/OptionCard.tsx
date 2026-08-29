"use client";

import { useRef, useState, useTransition } from "react";
import {
  Check,
  ExternalLink,
  ImageOff,
  Loader2,
  Mail,
  Phone,
  Plus,
  X,
} from "lucide-react";
import {
  Disclosure,
  DisclosureContent,
  DisclosureTrigger,
} from "@/components/motion-primitives/disclosure";
import { addOptionImage, markOptionWinner, removeOptionImage } from "@/lib/options/actions";
import { ImageUpload } from "@/components/ImageUpload";

export type OptionImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

export type OptionDetail = {
  id: string;
  name: string;
  description: string | null;
  web_link: string | null;
  predicted_cost: number | null;
  actual_cost: number | null;
  option_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_winner: boolean;
  images: OptionImage[];
};

export function OptionCard({
  option,
  isCouple,
}: {
  option: OptionDetail;
  isCouple: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cover = option.images[0];

  return (
    <Disclosure
      open={open}
      onOpenChange={setOpen}
      className={`overflow-hidden rounded-[10px] border bg-white transition-colors duration-200 ${
        option.is_winner ? "border-2 border-accent" : "border-ink/10"
      }`}
    >
      <DisclosureTrigger>
        <div className="cursor-pointer select-none" role="button" aria-label={`View details for ${option.name}`}>
          <div className="relative aspect-[4/3] w-full bg-cream-deep">
            {cover ? (
              // Arbitrary hosts (Drive-served images plus any pasted URL) —
              // next/image needs a configured remotePatterns allowlist per
              // domain, which doesn't fit "any URL the couple pastes in".
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.image_url}
                alt={option.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-soft/50">
                <ImageOff className="h-6 w-6" strokeWidth={1.5} />
                <span className="font-serif text-[11px] tracking-[0.04em] uppercase">
                  No image yet
                </span>
              </div>
            )}
            {option.is_winner && (
              <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-accent px-3 py-1 font-serif text-[10px] tracking-wide text-cream uppercase">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Winner
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="font-serif text-sm font-semibold text-ink">{option.name}</p>
            <p className="mt-1 font-reading text-[13px] text-ink-soft">
              £{option.predicted_cost ?? "—"} predicted
              {option.actual_cost != null ? ` · £${option.actual_cost} actual` : ""}
            </p>
          </div>
        </div>
      </DisclosureTrigger>
      <DisclosureContent>
        <OptionDetailPanel option={option} isCouple={isCouple} />
      </DisclosureContent>
    </Disclosure>
  );
}

function OptionDetailPanel({
  option,
  isCouple,
}: {
  option: OptionDetail;
  isCouple: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [winnerPending, startWinnerTransition] = useTransition();
  const [imagePending, startImageTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();

  function handleMarkWinner() {
    setError(null);
    startWinnerTransition(async () => {
      const result = await markOptionWinner(option.id);
      if (result.error) setError(result.error);
    });
  }

  function handleUploaded(url: string) {
    setError(null);
    startImageTransition(async () => {
      const result = await addOptionImage(option.id, url);
      if (result.error) setError(result.error);
    });
  }

  function handleAddImage() {
    const url = imageUrl.trim();
    if (!url) return;
    setError(null);
    startImageTransition(async () => {
      const result = await addOptionImage(option.id, url);
      if (result.error) {
        setError(result.error);
        return;
      }
      setImageUrl("");
      inputRef.current?.focus();
    });
  }

  function handleRemoveImage(imageId: string) {
    setError(null);
    setRemovingId(imageId);
    startRemoveTransition(async () => {
      const result = await removeOptionImage(imageId);
      if (result.error) setError(result.error);
      setRemovingId(null);
    });
  }

  const hasContact = option.contact_name || option.contact_phone || option.contact_email;

  return (
    <div className="border-t border-ink/10 p-5">
      {/* Full image gallery */}
      {option.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {option.images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-[8px] bg-cream-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt={option.name} className="h-full w-full object-cover" />
              {isCouple && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  disabled={removingId === img.id}
                  aria-label="Remove image"
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
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

      {/* Real upload, straight into the couple's shared Google Drive folder
          via /api/upload — the primary path now that Drive is wired up.
          The paste-a-URL input stays as a fallback for an image already
          hosted somewhere else (a vendor's own website, say). */}
      {isCouple && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ImageUpload onUploaded={handleUploaded} label="Upload photo" />
          <span className="font-reading text-xs text-ink-soft/60 italic">or</span>
          <input
            ref={inputRef}
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddImage();
              }
            }}
            placeholder="Paste an image URL"
            className="flex-1 rounded-full border border-ink/20 bg-cream px-4 py-2 font-reading text-[13px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleAddImage}
            disabled={imagePending || !imageUrl.trim()}
            className="flex items-center gap-1 rounded-full border border-ink/20 px-3.5 py-2 font-serif text-xs text-ink-soft transition hover:border-ink/40 disabled:opacity-60"
          >
            {imagePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            Add
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 font-reading text-[13px] text-ink-soft">
        <div>
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
            Description
          </p>
          <p className="mt-1 text-ink">{option.description || "No description yet."}</p>
        </div>

        <div>
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
            Web link
          </p>
          {option.web_link ? (
            <a
              href={option.web_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-accent underline underline-offset-2"
            >
              {option.web_link}
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </a>
          ) : (
            <p className="mt-1 text-ink">No link yet.</p>
          )}
        </div>

        <div>
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
            Contact
          </p>
          {hasContact ? (
            <div className="mt-1 flex flex-col gap-0.5 text-ink">
              {option.contact_name && <span>{option.contact_name}</span>}
              {option.contact_phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3" strokeWidth={2} /> {option.contact_phone}
                </span>
              )}
              {option.contact_email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" strokeWidth={2} /> {option.contact_email}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-ink">No contact logged yet.</p>
          )}
        </div>

        {option.option_date && (
          <div>
            <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
              Date
            </p>
            <p className="mt-1 text-ink">{option.option_date}</p>
          </div>
        )}
      </div>

      {isCouple && (
        <button
          type="button"
          onClick={handleMarkWinner}
          disabled={winnerPending || option.is_winner}
          className={`mt-4 flex items-center gap-1.5 rounded-full px-4.5 py-2 font-serif text-xs transition disabled:opacity-70 ${
            option.is_winner
              ? "bg-accent text-cream"
              : "border border-ink/20 text-ink-soft hover:border-ink/40"
          }`}
        >
          {option.is_winner ? (
            <>
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Winner
            </>
          ) : winnerPending ? (
            "Marking…"
          ) : (
            "Mark as winner"
          )}
        </button>
      )}

      {error && <p className="mt-3 font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}
