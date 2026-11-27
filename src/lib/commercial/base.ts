import { headers } from "next/headers";
import { SITE_BASE_HEADER } from "@/lib/wedding/host";

// Where the commercial pages live in this address: "" on the main domain,
// "/www" on previews and localhost (see middleware).
export async function siteBase(): Promise<string> {
  try {
    return (await headers()).get(SITE_BASE_HEADER) ?? "/www";
  } catch {
    return "/www";
  }
}
