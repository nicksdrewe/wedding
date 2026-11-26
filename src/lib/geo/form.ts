import { resolvePlace } from "./resolve";

// A location typed but not yet looked up when the form was saved: look it up
// now, so saving straight away still places it on the map. Fills in the
// form's latitude/longitude; does nothing if the box was empty or the place
// couldn't be found (whatever was there before is kept).
export async function applyTypedLocation(formData: FormData) {
  const q = String(formData.get("locationQuery") ?? "").trim();
  if (!q) return;
  try {
    const place = await resolvePlace(q);
    if (place) {
      formData.set("latitude", String(place.lat));
      formData.set("longitude", String(place.lng));
    }
  } catch {
    // keep what was there
  }
}
