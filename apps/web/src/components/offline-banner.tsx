"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Renders a slim banner whenever the browser reports offline. We hold a short
 * grace period after "online" before hiding so transient flaps don't flicker.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function onOffline() {
      if (hideTimer) clearTimeout(hideTimer);
      setOffline(true);
    }
    function onOnline() {
      hideTimer = setTimeout(() => setOffline(false), 500);
    }
    setOffline(!navigator.onLine);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/90 px-3 py-1 text-[11px] font-semibold text-white">
      <WifiOff className="h-3 w-3" />
      You're offline. Some pages may show cached data; new messages won't sync until you're back.
    </div>
  );
}
