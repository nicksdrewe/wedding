// The project address, however it was pasted into the settings: Supabase's
// dashboard also shows the longer ".../rest/v1/" form, which would otherwise
// break every database and sign-in call.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/(rest|auth)\/v1$/, "");
