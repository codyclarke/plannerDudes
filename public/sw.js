// Service worker: push notifications + offline fallback.
//
// Offline: the app keeps a read-only snapshot of upcoming events in
// localStorage (lib/offline-store.ts). Here we keep a cached copy of the
// /offline page (and the scripts/styles it needs) and serve it whenever a
// page navigation fails for lack of a connection. Only that page shell is
// cached — it contains no personal data; the data lives in the snapshot,
// which is wiped on logout.

const OFFLINE_CACHE = "offline-page-v1";
const OFFLINE_URL = "/offline";

/**
 * (Re)caches the offline page and the /_next/static assets it references.
 * Swaps the whole cache only once everything downloaded, so a half-failed
 * refresh never leaves a broken page, and assets from old deploys don't pile up.
 */
async function cacheOfflinePage() {
  const page = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "same-origin" });
  if (!page.ok) return;
  const html = await page.clone().text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])];
  const fetched = await Promise.all(
    assets.map((url) =>
      fetch(url)
        .then((res) => (res.ok ? [url, res] : null))
        .catch(() => null)
    )
  );
  if (fetched.some((entry) => entry === null)) return;

  await caches.delete(OFFLINE_CACHE);
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.put(OFFLINE_URL, page);
  await Promise.all(fetched.map(([url, res]) => cache.put(url, res)));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear caches from any older version of this worker, then refresh.
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
        .then(() => cacheOfflinePage())
        .catch(() => {}),
    ])
  );
});

// The app asks for a refresh after each new snapshot, so the cached page
// keeps up with new deploys.
self.addEventListener("message", (event) => {
  if (event.data?.type === "cache-offline-page") {
    event.waitUntil(cacheOfflinePage().catch(() => {}));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always go to the network; only if that fails (offline)
  // fall back to the cached offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
        return cached ?? Response.error();
      })
    );
    return;
  }

  // Scripts/styles: use the network normally; fall back to the offline
  // page's cached copies when there's no connection.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request, { cacheName: OFFLINE_CACHE });
        return cached ?? Response.error();
      })
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      // Reuse an open app window if there is one, rather than stacking new ones.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});
