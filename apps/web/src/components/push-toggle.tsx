"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const cleaned = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(cleaned);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

/**
 * Bell button in the topbar. Subscribes the current browser to web-push for
 * the active tenant. The Push API + Notification API are gated behind a user
 * gesture, so we ask for permission only when clicked.
 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "blocked" | "loading">(
    "loading",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function toggle() {
    if (!vapidPublicKey) {
      alert("Push notifications are not configured for this deployment.");
      return;
    }
    const perm = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (perm !== "granted") {
      setState("blocked");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      setState("off");
      return;
    }
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        userAgent: navigator.userAgent,
      }),
    });
    setState("on");
  }

  if (state === "unsupported") return null;

  const label =
    state === "on" ? "Notifications on" :
    state === "blocked" ? "Notifications blocked" :
    state === "loading" ? "…" :
    "Turn on notifications";

  return (
    <button
      onClick={toggle}
      disabled={state === "loading" || state === "blocked"}
      title={label}
      className="rounded-md border border-[hsl(var(--border))] p-1.5 text-xs hover:bg-[hsl(var(--muted))]"
      aria-label={label}
    >
      {state === "on" ? (
        <Bell className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <BellOff className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      )}
    </button>
  );
}
