// Rosie service worker.
// Strategy:
//   - Shell + static assets: cache-first, refreshed in background.
//   - HTML pages: stale-while-revalidate (instant from cache, refresh on the side).
//   - API / public landing / QR endpoints: network-only, never cached.
//   - When offline and a page isn't cached, serve /_offline.

const SHELL_CACHE = "rosie-shell-v3";
const PAGE_CACHE = "rosie-pages-v3";
const SHELL_ASSETS = [
  "/",
  "/overview",
  "/inbox",
  "/manifest.json",
  "/icon.svg",
  "/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isHtmlRequest(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache APIs, public landing pages, or short links — they're authoritative live data.
  const isLive =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/q/") ||
    url.pathname.startsWith("/p/") ||
    url.pathname.startsWith("/dsar");
  if (isLive) return;

  if (isHtmlRequest(req)) {
    // Stale-while-revalidate for HTML pages.
    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);
        if (cached) {
          // Refresh the cache asynchronously so the next visit is up-to-date.
          event.waitUntil(network);
          return cached;
        }
        const fresh = await network;
        if (fresh) return fresh;
        // Last-resort: the cached shell page.
        const fallback = await cache.match("/overview");
        return (
          fallback ||
          new Response(
            "<!doctype html><meta charset=utf-8><title>Offline · Rosie</title><body style=\"font:14px system-ui;padding:2rem;color:#444\">You're offline. Please reconnect and refresh.",
            { headers: { "Content-Type": "text/html" }, status: 503 },
          )
        );
      }),
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch {
        return new Response("offline", { status: 503 });
      }
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Rosie", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    data.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Rosie", {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      data: { url: data.url || "/inbox" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/inbox";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.endsWith(target) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
