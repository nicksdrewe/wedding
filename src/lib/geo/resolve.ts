// Turn whatever someone pastes into a map position:
//   "41.1496, -8.6110"                       coordinates
//   "DN15 7AA"                               a UK postcode (postcodes.io)
//   https://maps.app.goo.gl/abc / google.com/maps/... share links
//   "Hotel Infante Sagres, Porto"           an address or place (OpenStreetMap)
// No API keys needed. Only Google's own map hosts are ever fetched.

export type Place = { lat: number; lng: number; label: string };

const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const UK_POSTCODE = /^\s*([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\s*$/i;
const USER_AGENT = "WeddingsWeddings/1.0 (+https://weddingsweddings.co.uk)";

function valid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function isGoogleMapsHost(host: string) {
  return (
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host === "g.co" ||
    /(^|\.)google\.[a-z.]+$/.test(host) ||
    host === "maps.google.com"
  );
}

// Coordinates (or a place name to look up) inside a Google Maps address.
function fromGoogleUrl(u: URL): Place | { query: string } | null {
  const s = decodeURIComponent(u.href);
  const pick = (re: RegExp) => {
    const m = s.match(re);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    return valid(lat, lng) ? { lat, lng } : null;
  };
  // The pin itself (!3d…!4d…) is more exact than the map's centre (@…).
  const exact = pick(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? pick(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const centre = pick(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const name = s.match(/\/place\/([^/@?]+)/)?.[1]?.replace(/\+/g, " ");
  const at = exact ?? centre;
  if (at) return { ...at, label: name ?? "Pinned from Google Maps" };
  const q = name ?? u.searchParams.get("q") ?? u.searchParams.get("query") ?? u.searchParams.get("destination");
  return q ? { query: q.replace(/\+/g, " ") } : null;
}

// Short share links redirect to the full address; follow them (Google hosts only).
async function expand(url: URL): Promise<URL> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    if (!isGoogleMapsHost(current.hostname)) break;
    const res = await fetch(current, { redirect: "manual", headers: { "User-Agent": USER_AGENT } });
    const next = res.headers.get("location");
    if (!next || res.status < 300 || res.status >= 400) break;
    current = new URL(next, current);
  }
  return current;
}

async function postcode(pc: string): Promise<Place | null> {
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: { latitude: number; longitude: number; postcode: string; admin_district?: string } };
  const r = body.result;
  if (!r || !valid(r.latitude, r.longitude)) return null;
  return { lat: r.latitude, lng: r.longitude, label: [r.postcode, r.admin_district].filter(Boolean).join(", ") };
}

async function search(q: string): Promise<Place | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-GB" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const r = rows[0];
  if (!r) return null;
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lon);
  return valid(lat, lng) ? { lat, lng, label: r.display_name.split(",").slice(0, 3).join(",") } : null;
}

export async function resolvePlace(input: string): Promise<Place | null> {
  const text = input.trim().slice(0, 500);
  if (!text) return null;

  const c = text.match(COORDS);
  if (c) {
    const lat = parseFloat(c[1]);
    const lng = parseFloat(c[2]);
    return valid(lat, lng) ? { lat, lng, label: "Coordinates" } : null;
  }

  const link = text.match(/https?:\/\/\S+/)?.[0];
  if (link) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return null;
    }
    if (!isGoogleMapsHost(url.hostname)) return null;
    const found = fromGoogleUrl(await expand(url));
    if (!found) return null;
    if ("lat" in found) return found;
    return (await postcodeOrSearch(found.query)) ?? null;
  }

  return postcodeOrSearch(text);
}

async function postcodeOrSearch(text: string) {
  const pc = text.match(UK_POSTCODE);
  if (pc) {
    const hit = await postcode(`${pc[1]}${pc[2]}`);
    if (hit) return hit;
  }
  return search(text);
}
