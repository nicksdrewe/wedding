"use client";

import { useEffect } from "react";

// Registers the small service worker that lets the site be installed on a
// phone and receive notifications. Harmless where unsupported.
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
