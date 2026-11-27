import crypto from "node:crypto";

// Server-only. Encrypts each wedding's Google sign-in before it is stored,
// and signs the "which wedding is connecting" note carried through Google's
// sign-in page. The key comes from the Google client secret, which lives only
// in the hosting settings, so a copy of the database alone can't use the
// stored sign-ins.

function key(purpose: string) {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET isn't set.");
  return crypto.createHash("sha256").update(`${secret}:${purpose}`).digest();
}

export function sealToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key("drive-token"), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function openToken(sealed: string): string | null {
  try {
    const [v, iv, tag, body] = sealed.split(".");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key("drive-token"), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export type ConnectState = { w: string; back: string; exp: number };

export function signState(state: ConnectState): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = crypto.createHmac("sha256", key("drive-state")).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readState(raw: string | null): ConnectState | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", key("drive-state")).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ConnectState;
    return state.exp > Date.now() ? state : null;
  } catch {
    return null;
  }
}
