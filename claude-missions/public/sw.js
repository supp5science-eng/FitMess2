/**
 * FitMess service worker — minimal, install-enabling, auth-safe.
 *
 * Its jobs are narrow on purpose:
 *  1. Provide a `fetch` handler so the app meets the browsers' PWA
 *     installability criteria (this is what makes "Instaliraj" real).
 *  2. Give an offline fallback for full-page navigations by precaching the
 *     public marketing landing ("/").
 *
 * It deliberately does NOT cache authenticated navigations or API responses:
 * user-scoped pages must never be served from a shared cache (they could
 * leak between accounts on a shared device, or go stale after a mutation).
 * Data freshness and auth stay owned by the network + Supabase, not here.
 *
 * F071 adds Web Push: the `push` handler shows the daily reminder the
 * server sends (see src/app/api/cron/reminders/route.ts — the payload is a
 * JSON `{ title, body, url }`, built by src/lib/push/reminders.ts), and
 * `notificationclick` focuses an existing app window or opens a new one on
 * the notification's deep link (default `/danas`).
 */
const CACHE = "fitmess-shell-v1";
const PRECACHE = ["/", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  // Tolerate a missing/malformed payload: iOS in particular REQUIRES a
  // user-visible notification for every push, so always show something.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Fall through to the defaults below.
  }
  const title = data.title || "FitMess";
  const options = {
    body: data.body || "Vreme je da upišeš današnji unos.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/danas" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/danas";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Full-page navigations: network-first, fall back to the cached landing
  // only when the network is unavailable (offline). Never cache the response
  // — it may be an authenticated page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  // Our own static icons/manifest: cache-first (they are versioned by name).
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
