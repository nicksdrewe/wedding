"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  ImageOff,
  Loader2,
  Mail,
  MessagesSquare,
  MoveRight,
  Pencil,
  Phone,
  Plus,
  X,
} from "lucide-react";
import {
  Disclosure,
  DisclosureContent,
  DisclosureTrigger,
} from "@/components/motion-primitives/disclosure";
import {
  addOptionImage,
  deleteOption,
  markOptionWinner,
  moveOption,
  removeOptionImage,
} from "@/lib/options/actions";
import { ImageUpload } from "@/components/ImageUpload";
import { toDriveImageUrl } from "@/lib/google/image-url";
import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/convert";
import { computeOptionTotals } from "@/lib/options/totals";
import { normalizeExternalUrl } from "@/lib/url";
import { CostItemsPanel, type CostItemRow, type LinkableCategory, type CostItemLinkInfo } from "./CostItemsPanel";
import { EditOptionForm } from "./EditOptionForm";
import { Feedback, FeedbackSummary } from "@/components/feedback/Feedback";
import type { FeedbackData } from "@/lib/feedback/types";

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
  predicted_cost_min: number | null;
  predicted_cost_max: number | null;
  actual_cost: number | null;
  currency: Currency;
  // True when RLS withheld this option's prices from the viewer (see
  // lib/options/costs.ts) — every cost display and cost input below is then
  // omitted entirely.
  costs_hidden: boolean;
  option_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  nights: number | null;
  sleeps: number | null;
  is_winner: boolean;
  images: OptionImage[];
};

export function OptionCard({
  option,
  isCouple,
  canDelete = isCouple,
  canPickWinner = isCouple,
  feedback,
  canInteract = false,
  canModerateFeedback = false,
  revalidate,
  costItems = [],
  linkableCategories = [],
  linksByItem = {},
  showCommsLink = false,
  moveTargets = [],
}: {
  // Adds a "Comms" link to this option's organising-comms entries.
  showCommsLink?: boolean;
  // Other categories this option could be moved to (couple only).
  moveTargets?: { id: string; title: string }[];
  option: OptionDetail;
  // "May add to and edit this option" (photos, details, and — where prices
  // are visible — costs). Deleting the option and choosing the winner are
  // stricter, couple-only rights on a category board
  // (0033_party_planner_access.sql), hence the two separate flags.
  isCouple: boolean;
  canDelete?: boolean;
  canPickWinner?: boolean;
  // Votes and comments (0037). canInteract is false for plain guests.
  feedback?: FeedbackData;
  canInteract?: boolean;
  canModerateFeedback?: boolean;
  revalidate: string;
  costItems?: CostItemRow[];
  linkableCategories?: LinkableCategory[];
  linksByItem?: Record<string, CostItemLinkInfo[]>;
}) {
  const [open, setOpen] = useState(false);
  // Bumped by the always-visible Edit button to open the editor inside the panel.
  const [editSignal, setEditSignal] = useState(0);
  const [moving, setMoving] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [movePending, startMove] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const canMove = canDelete && moveTargets.length > 0;
  const cover = option.images[0];
  const totals = computeOptionTotals(option, costItems);

  return (
    <Disclosure
      open={open}
      onOpenChange={setOpen}
      className={`surface overflow-hidden transition-[box-shadow,border-color] duration-200 ${
        option.is_winner ? "!border-2 !border-accent shadow-[0_16px_40px_rgba(76,107,82,0.25)]" : ""
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
                src={toDriveImageUrl(cover.image_url)}
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
            {!option.costs_hidden && (
              <p className="mt-1 font-reading text-[13px] text-ink-soft">
                {formatCostRange(totals.headlineMin, totals.headlineMax, option.currency)} predicted
                {totals.headlineActual != null ? ` · ${formatCurrency(totals.headlineActual, option.currency)} actual` : ""}
              </p>
            )}
            {!option.costs_hidden && totals.additionalSum > 0 && (
              <p className="mt-0.5 font-reading text-[12px] text-ink-soft/70">
                + {formatCurrency(totals.additionalSum, option.currency)} additional costs
              </p>
            )}
            {(option.nights != null || option.sleeps != null) && (
              <p className="mt-0.5 font-reading text-[12px] text-ink-soft/70">
                {option.nights != null ? `${option.nights} night${option.nights === 1 ? "" : "s"}` : ""}
                {option.nights != null && option.sleeps != null ? " · " : ""}
                {option.sleeps != null ? `sleeps ${option.sleeps}` : ""}
              </p>
            )}
            <FeedbackSummary data={feedback} />
          </div>
        </div>
      </DisclosureTrigger>
      {(isCouple || showCommsLink || canMove) && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {isCouple && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setEditSignal((n) => n + 1);
              }}
              className="btn btn-quiet btn-sm min-h-11"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Edit
            </button>
          )}
          {canMove && (
            <button type="button" onClick={() => setMoving((m) => !m)} aria-expanded={moving} className="btn btn-quiet btn-sm min-h-11">
              <MoveRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Move
            </button>
          )}
          {showCommsLink && (
            <Link href={`/organising?option=${option.id}`} className="btn btn-quiet btn-sm min-h-11">
              <MessagesSquare className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Comms
            </Link>
          )}
          {moving && (
            <form
              className="flex w-full flex-wrap items-end gap-2"
              action={() =>
                startMove(async () => {
                  setMoveError(null);
                  if (!moveTo) return setMoveError("Pick a category to move it to.");
                  const result = await moveOption(option.id, moveTo, revalidate);
                  if (result.error) return setMoveError(result.error);
                  setMoving(false);
                })
              }
            >
              <label className="min-w-[14rem] flex-1">
                <span className="field-label">Move &ldquo;{option.name}&rdquo; to</span>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="field">
                  <option value="">Choose a category…</option>
                  {moveTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={movePending} className="btn btn-sec btn-sm">
                {movePending ? "Moving…" : "Move"}
              </button>
              <p className="w-full font-reading text-[12px] text-ink-soft">
                Its photos, prices, notes and comments move with it. It stops being the winner here.
              </p>
              {moveError && <p className="w-full font-reading text-xs text-alert">{moveError}</p>}
            </form>
          )}
        </div>
      )}
      <DisclosureContent>
        <OptionDetailPanel
          option={option}
          isCouple={isCouple}
          canDelete={canDelete}
          canPickWinner={canPickWinner}
          revalidate={revalidate}
          costItems={costItems}
          linkableCategories={linkableCategories}
          linksByItem={linksByItem}
          totals={totals}
          feedback={feedback}
          canInteract={canInteract}
          canModerateFeedback={canModerateFeedback}
          editSignal={editSignal}
        />
      </DisclosureContent>
    </Disclosure>
  );
}

function OptionDetailPanel({
  option,
  isCouple,
  canDelete,
  canPickWinner,
  revalidate,
  costItems,
  linkableCategories,
  linksByItem,
  totals,
  feedback,
  canInteract,
  canModerateFeedback,
  editSignal = 0,
}: {
  // Bumped by the card's Edit button to open the editor.
  editSignal?: number;
  feedback?: FeedbackData;
  canInteract: boolean;
  canModerateFeedback: boolean;
  option: OptionDetail;
  isCouple: boolean;
  canDelete: boolean;
  canPickWinner: boolean;
  revalidate: string;
  costItems: CostItemRow[];
  linkableCategories: LinkableCategory[];
  linksByItem: Record<string, CostItemLinkInfo[]>;
  totals: ReturnType<typeof computeOptionTotals>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (editSignal > 0) setEditing(true);
  }, [editSignal]);
  const [winnerPending, startWinnerTransition] = useTransition();
  const [imagePending, startImageTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

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

  function handleDeleteOption() {
    if (
      !window.confirm(
        "Delete this option? It may have images and history — this permanently removes all of it and can not be undone."
      )
    )
      return;
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteOption(option.id, revalidate);
      if (result.error) setError(result.error);
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
      <Feedback
        targetType="page_option"
        targetId={option.id}
        data={feedback}
        canInteract={canInteract}
        canModerate={canModerateFeedback}
        revalidate={revalidate}
        className="mb-4"
      />
      {/* Full image gallery */}
      {option.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {option.images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-[8px] bg-cream-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toDriveImageUrl(img.image_url)} alt={option.name} className="h-full w-full object-cover" />
              {isCouple && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  disabled={removingId === img.id}
                  aria-label="Remove image"
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-cream transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:disabled:opacity-100"
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
            className="field flex-1"
          />
          <button
            type="button"
            onClick={handleAddImage}
            disabled={imagePending || !imageUrl.trim()}
            className="btn btn-quiet btn-sm"
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

      {editing ? (
        <div className="mt-4">
          <EditOptionForm
            option={option}
            revalidate={revalidate}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
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
              href={normalizeExternalUrl(option.web_link)}
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

        {!option.costs_hidden && (
        <div>
          <p className="font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
            Cost breakdown
          </p>
          <p className="mt-1 mb-2 text-ink">
            {formatCostRange(totals.totalMin, totals.totalMax, option.currency)} true total
            {totals.totalActual != null ? ` · ${formatCurrency(totals.totalActual, option.currency)} actual` : ""}
          </p>
          <CostItemsPanel
            pageOptionId={option.id}
            revalidate={revalidate}
            isCouple={isCouple}
            items={costItems}
            currency={option.currency}
            linkableCategories={linkableCategories}
            linksByItem={linksByItem}
          />
        </div>
        )}
      </div>

      {isCouple && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canPickWinner && (
          <button
            type="button"
            onClick={handleMarkWinner}
            disabled={winnerPending || option.is_winner}
            className={`flex items-center gap-1.5 rounded-full px-4.5 py-2 font-serif text-xs transition disabled:opacity-70 ${
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
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec"
          >
            Edit
          </button>
          {canDelete && (
          <button
            type="button"
            onClick={handleDeleteOption}
            disabled={deletePending}
            className="font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
          )}
        </div>
      )}
        </>
      )}

      {error && <p className="mt-3 font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}
