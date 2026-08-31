export type FxRates = {
  base: "GBP";
  // How many of each currency one GBP buys — e.g. rates.EUR ≈ 1.17 means
  // £1 = €1.17, so converting FROM that currency TO GBP is amount / rate.
  rates: Record<string, number>;
};

// A conservative, clearly-stale-if-ever-actually-used fallback for the rare
// case the FX API is unreachable AND this is a cold start with nothing
// cached yet — keeps the budget page rendering (roughly right) instead of
// erroring outright. Real traffic should always get the live rate below.
const FALLBACK_RATES: FxRates = { base: "GBP", rates: { GBP: 1, EUR: 1.17 } };

// Module-scope, so it survives across requests within the same server
// process (not across deploys/cold starts) — a last-known-good value to
// fall back to if a later fetch fails, better than jumping straight to the
// hardcoded FALLBACK_RATES the moment the API has one bad request.
let lastKnownGood: FxRates | null = null;

// Free, no-key endpoint — see https://www.exchangerate-api.com/docs/free.
// Cached at the Next.js data-cache layer for an hour: exchange rates don't
// move fast enough to justify a live fetch on every single request, and
// this keeps the budget page fast and avoids hitting a free tier's rate
// limit.
const FX_API_URL = "https://open.er-api.com/v6/latest/GBP";

export async function getFxRates(): Promise<FxRates> {
  try {
    const res = await fetch(FX_API_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`FX API responded ${res.status}`);
    const data = await res.json();
    if (!data?.rates || typeof data.rates !== "object") {
      throw new Error("FX API response missing rates");
    }
    const fresh: FxRates = { base: "GBP", rates: data.rates };
    lastKnownGood = fresh;
    return fresh;
  } catch (error) {
    // Never throw out of here — every caller renders a page that must not
    // break just because a free third-party API had a bad moment.
    console.error("getFxRates: falling back", error);
    return lastKnownGood ?? FALLBACK_RATES;
  }
}
