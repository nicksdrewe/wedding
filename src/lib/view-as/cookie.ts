// "View as" marker cookie: signing and verification.
//
// While the couple is viewing the site as someone else, the browser holds
// THAT person's session. Three cookies describe the situation:
//
//   va            signed, httpOnly — the authority. Says who is really
//                 looking (actor), whose session it is (target), and when it
//                 ends. Middleware trusts only this.
//   va-ui         readable by the page — display name for the banner only.
//                 Never trusted for anything.
//   va-admin.<n>  httpOnly — the couple's own session cookies, parked so
//                 they can be put back on exit.
//
// Web Crypto only (no node:crypto) so the same code runs in middleware (edge
// runtime) and in route handlers.

export const VIEW_AS_COOKIE = "va";
export const VIEW_AS_UI_COOKIE = "va-ui";
export const STASH_PREFIX = "va-admin.";
// Supabase's own session cookies: sb-<project>-auth-token, possibly split
// into .0/.1/… chunks.
export const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/;

// Long enough to click through the site as someone; short enough that a
// forgotten tab can't sit in another person's session for hours.
export const VIEW_AS_MAX_AGE_SECONDS = 30 * 60;

export type ViewAsPayload = {
  actorId: string; // the couple member really looking
  targetUserId: string;
  targetContactId: string;
  targetName: string;
  exp: number; // epoch seconds
};

function secret(): string {
  // Server-only key that already exists everywhere this runs; never sent to
  // the browser. Prefixed so this signature can't be confused with any other
  // use of the same key.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return `view-as:v1:${key}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signViewAs(payload: ViewAsPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey("sign"), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

// Returns the payload only if the signature is ours AND it hasn't expired.
// Anything else — missing, tampered, malformed, stale — is null.
export async function verifyViewAs(value: string | undefined | null): Promise<ViewAsPayload | null> {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  try {
    // crypto.subtle.verify is constant-time, unlike comparing strings.
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey("verify"),
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as ViewAsPayload;
    if (
      typeof payload.actorId !== "string" ||
      typeof payload.targetUserId !== "string" ||
      typeof payload.targetContactId !== "string" ||
      typeof payload.targetName !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
