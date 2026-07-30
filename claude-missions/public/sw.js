/**
 * FitMess service worker — minimal, install-enabling, auth-safe.
 *
 * Its jobs are narrow on purpose:
 *  1. Provide a `fetch` handler so the app meets the browsers' PWA
 *     installability criteria (this is what makes "Instaliraj" real).
 *  2. Give an offline fallback for full-page navigations by precaching the
 *     public marketing landing ("/").
 *  3. Receive Web Push reminders and open the right screen when one is tapped
 *     (2026-07-25, "Podsetnici").
 *
 * It deliberately does NOT cache authenticated navigations or API responses:
 * user-scoped pages must never be served from a shared cache (they could
 * leak between accounts on a shared device, or go stale after a mutation).
 * Data freshness and auth stay owned by the network + Supabase, not here.
 */
const CACHE = "fitmess-shell-v2";
const PRECACHE = ["/", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.json"];

/**
 * Cache Storage buckets this service worker OWNS and may garbage-collect on
 * activate. Everything else in Cache Storage belongs to the app, not to us.
 *
 * This prefix exists because the old activate handler deleted every bucket
 * except the current `CACHE` — which silently wiped `fitmess-share-cards-v1`
 * (the share cards' persistence layer, see `src/lib/share/card-cache.ts`) on
 * every service-worker update. That is why a card prewarmed at save time was
 * gone an hour later and "Podeli" had to render it again from scratch: the
 * card cache was never expired, it was deleted by us.
 */
const OWNED_CACHE_PREFIX = "fitmess-shell-";

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
        Promise.all(
          keys
            // Only OUR OWN superseded shell buckets. Never a bucket the app
            // manages itself (share cards), which we have no business
            // evicting — the app is the only thing that knows when one of
            // those is stale.
            .filter((key) => key.startsWith(OWNED_CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
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

// ---------------------------------------------------------------------------
// Podsetnici (Web Push), 2026-07-25.
//
// The server sends a JSON payload ({ title, body, url, tag }); everything the
// notification shows comes from there, so copy changes never require shipping a
// new service worker. `tag` makes a repeat reminder REPLACE the previous one
// instead of stacking — nobody should wake up to four identical nudges.
//
// iOS note: this only ever runs when FitMess is installed to the Home Screen.
// Safari tabs get no push at all (Apple's rule, not ours), which is why the
// settings screen refuses to arm reminders outside standalone mode.
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "FitMess";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "fitmess",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/danas" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || "/danas";
  const targetUrl = new URL(target, self.location.origin).href;

  // Reuse the already-open app window when there is one (tapping a reminder
  // should not leave the user with two copies of the app running); only open a
  // new one when nothing is running.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.navigate ? client.navigate(targetUrl).then((c) => c && c.focus()) : client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
