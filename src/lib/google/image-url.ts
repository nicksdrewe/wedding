// Client-safe URL transform — deliberately separate from drive.ts (which
// is server-only and holds the OAuth client/refresh token) since every
// call site below is a "use client" component rendering an <img>.
//
// uploadToDrive now stores every NEW photo's URL as /api/drive-image/<id>
// directly (see that file's long comment for why: both raw Google URL
// options it tried before turned out to be unreliable under concurrent
// load). This only matters for photos uploaded BEFORE that change — their
// stored image_url is still a raw lh3.googleusercontent.com/d/<id> or
// drive.google.com/thumbnail?id=<id> URL. Rather than a one-off DB
// migration to rewrite those rows, every render site runs the stored URL
// through this first, so a legacy row is fixed transparently and a
// current one just passes through unchanged.
const LH3_PATTERN = /^https:\/\/lh3\.googleusercontent\.com\/d\/([^/?]+)/;
const THUMBNAIL_ID_PATTERN = /[?&]id=([^&]+)/;

export function toDriveImageUrl(url: string): string {
  const lh3Match = url.match(LH3_PATTERN);
  if (lh3Match) return `/api/drive-image/${lh3Match[1]}`;

  if (url.startsWith("https://drive.google.com/thumbnail")) {
    const idMatch = url.match(THUMBNAIL_ID_PATTERN);
    if (idMatch) return `/api/drive-image/${idMatch[1]}`;
  }

  return url;
}
