import crypto from "node:crypto";

// Resend signs webhooks with the Svix scheme: HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<body>" with the base64 secret after "whsec_".
const TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhook(body: string, headers: Headers, rawSecret: string | undefined, now = Date.now()): boolean {
  const secret = rawSecret?.trim();
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

