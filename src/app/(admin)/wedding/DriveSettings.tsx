"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, HardDrive } from "lucide-react";
import { disconnectDrive } from "@/lib/wedding/actions";

export type DriveStatus =
  | { kind: "connected"; account: string | null; folderName: string | null; folderId: string; connectedAt: string | null }
  | { kind: "original" }
  | { kind: "none" };

const RESULT: Record<string, string> = {
  connected: "Connected. New photos will go into the folder below.",
  cancelled: "Nothing was connected.",
  "no-token":
    "Google didn't hand over a lasting sign-in. Remove Weddings Weddings at myaccount.google.com/permissions, then connect again.",
  failed: "That didn't work. Try connecting again in a moment.",
};

// Photos live in the couple's own Google Drive: their storage, their account.
export function DriveSettings({ status }: { status: DriveStatus }) {
  const router = useRouter();
  const params = useSearchParams();
  const result = params.get("drive");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="surface mt-6 p-6">
      <p className="eyebrow">Photos</p>
      <h2 className="mt-1 font-title text-[24px]">Your own Google Drive</h2>
      <p className="mt-2 max-w-xl font-reading text-[15px] text-ink-soft">
        Photos added to your site are stored in a folder in your own Google Drive, so they use your storage and stay
        yours. The site can only see the files it puts there, nothing else in your Drive.
      </p>

      {result && RESULT[result] && (
        <p className={`mt-3 font-serif text-[13px] ${result === "connected" ? "text-sec" : "text-alert"}`}>{RESULT[result]}</p>
      )}

      {status.kind === "connected" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2.5 rounded-[14px] bg-sec-tint px-4 py-3 font-serif text-[14px]">
            <HardDrive className="h-4 w-4 text-sec" aria-hidden="true" />
            <span>
              <strong>{status.folderName ?? "Your wedding folder"}</strong>
              {status.account && <span className="block text-[12.5px] text-ink-soft">in {status.account}&rsquo;s Drive</span>}
            </span>
          </span>
          <a
            href={`https://drive.google.com/drive/folders/${status.folderId}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-quiet btn-sm"
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" /> Open folder
          </a>
          <a href="/api/google/oauth/start" className="btn btn-ghost btn-sm">
            Switch account
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await disconnectDrive();
                if (r.error) setError(r.error);
                else router.refresh();
              })
            }
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {status.kind === "original" && (
            <p className="mb-3 font-serif text-[13px] text-ink-soft">
              Photos currently go to the site&rsquo;s original Drive folder. Connect your own to use your own storage from now
              on; photos already uploaded stay where they are.
            </p>
          )}
          <a href="/api/google/oauth/start" className="btn btn-primary">
            <HardDrive className="h-4 w-4" aria-hidden="true" /> Connect Google Drive
          </a>
          <p className="mt-2 font-serif text-[12.5px] text-ink-soft">
            You&rsquo;ll sign in with Google and we&rsquo;ll create a folder called &ldquo;Weddings Weddings&rdquo; in your Drive.
            You can share that folder with anyone, straight from Drive.
          </p>
        </div>
      )}
      {error && <p className="mt-3 font-serif text-[13px] text-alert">{error}</p>}
    </section>
  );
}
