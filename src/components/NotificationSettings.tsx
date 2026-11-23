"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { typesForRole } from "@/lib/push/types";
import { loadPushPrefs, pushIsConfigured, removePushSubscription, savePushPrefs, savePushSubscription, sendTestPush } from "@/lib/push/actions";

// "Notifications" on My Details: turn them on for this device, choose which
// kinds you want (the list depends on your role), send yourself a test.
// On an iPhone this only works once the site has been added to the Home Screen.

type State = "checking" | "unsupported" | "ios-install" | "off-site" | "blocked" | "off" | "on";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function toB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function NotificationSettings({ role }: { role: string }) {
  const [state, setState] = useState<State>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const types = typesForRole(role);

  useEffect(() => {
    (async () => {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (isIOS && !standalone) return setState("ios-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (!(await pushIsConfigured())) return setState("off-site");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setEndpoint(sub.endpoint);
        setPrefs(await loadPushPrefs(sub.endpoint));
        setState("on");
      } else setState("off");
    })().catch((e) => {
      setMessage(`Something went wrong setting up notifications (${e instanceof Error ? e.message : "unknown"}). Close and reopen the app, then try again.`);
      setState("off");
    });
  }, []);

  function turnOn() {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) return setState("off-site");
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
        const result = await savePushSubscription(
          { endpoint: sub.endpoint, p256dh: toB64(sub.getKey("p256dh")), auth: toB64(sub.getKey("auth")) },
          navigator.userAgent
        );
        if (result.error) {
          await sub.unsubscribe();
          setMessage(result.error);
          return;
        }
        setEndpoint(sub.endpoint);
        setPrefs({});
        setState("on");
      } catch {
        setMessage("Couldn't turn notifications on for this device.");
      }
    });
  }

  function turnOff() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setState("off");
    });
  }

  function toggle(type: string, on: boolean) {
    if (!endpoint) return;
    const next = { ...prefs, [type]: on };
    setPrefs(next);
    startTransition(async () => {
      await savePushPrefs(endpoint, next);
    });
  }

  return (
    <section className="surface surface-raised p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sec-tint text-sec">
          {state === "on" ? <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" /> : <BellOff className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />}
        </span>
        <h2 className="font-title text-[22px] leading-tight">Notifications</h2>
      </div>

      {state === "checking" && <p className="mt-3 font-reading text-[13px] text-ink-soft">One moment…</p>}
      {state === "unsupported" && (
        <p className="mt-3 font-reading text-[13px] text-ink-soft">This browser can&rsquo;t receive notifications. Try Chrome, Edge, Firefox or Safari on an up-to-date phone.</p>
      )}
      {state === "ios-install" && (
        <p className="mt-3 font-reading text-[13px] text-ink-soft">
          On an iPhone or iPad, add this site to your Home Screen first: tap the Share button, then &ldquo;Add to Home Screen&rdquo;. Open it from there and turn notifications on here.
        </p>
      )}
      {state === "off-site" && (
        <p className="mt-3 font-reading text-[13px] text-ink-soft">Notifications haven&rsquo;t been switched on for the site yet. Check back soon.</p>
      )}
      {state === "blocked" && (
        <p className="mt-3 font-reading text-[13px] text-ink-soft">
          Notifications are blocked for this site in your browser settings. Allow them there, then come back.
        </p>
      )}
      {state === "off" && (
        <>
          <p className="mt-3 font-reading text-[13px] text-ink-soft">Get a nudge on this device when something that matters to you changes.</p>
          <button type="button" onClick={turnOn} disabled={pending} className="btn btn-sec mt-4">
            {pending ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="mt-3 font-reading text-[13px] text-ink-soft">On for this device. Choose what you want to hear about:</p>
          <ul className="mt-3 flex flex-col gap-2">
            {types.map((t) => (
              <li key={t.type}>
                <label className="flex items-start gap-3 font-reading text-[14px] text-ink">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--sec)]" checked={prefs[t.type] !== false} onChange={(e) => toggle(t.type, e.target.checked)} />
                  <span>
                    <span className="block font-serif text-[14px] font-semibold">{t.label}</span>
                    <span className="block text-[12px] text-ink-soft">{t.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await sendTestPush();
                  setMessage(r.error ?? "Sent. It should arrive in a moment.");
                })
              }
            >
              Send a test
            </button>
            <button type="button" className="btn btn-quiet btn-sm" disabled={pending} onClick={turnOff}>
              Turn off on this device
            </button>
          </div>
        </>
      )}
      {message && <p className="mt-3 font-reading text-[12px] text-ink-soft">{message}</p>}
    </section>
  );
}
