/**
 * FitMess service worker — minimal, install-enabling, auth-safe.
 *
 * Its jobs are narrow on purpose:
 *  1. Provide a `fetch` handler so the app meets the browsers' PWA
 *     installability criteria (this is what makes "Instaliraj" real).
 *  2. Give an offline fallback for full-page navigations, by precaching a
 *     standalone offline page ("/offline.html") and the public marketing
 *     landing ("/"). See `offlineResponse` for which one answers when.
 *  3. Receive Web Push reminders and open the right screen when one is tapped
 *     (2026-07-25, "Podsetnici").
 *  4. Serve the build's own static assets from Cache Storage (2026-07-31), so a
 *     warm launch does not re-download the JS/CSS payload — see the fetch
 *     handler for why the HTTP cache is not enough on iOS.
 *
 * It deliberately does NOT cache authenticated navigations or API responses:
 * user-scoped pages must never be served from a shared cache (they could
 * leak between accounts on a shared device, or go stale after a mutation).
 * Data freshness and auth stay owned by the network + Supabase, not here.
 */
// Bumped to v3 (2026-07-31) alongside the static-asset caching below: a new
// bucket starts clean and the activate handler drops v2, so no entry cached
// under the old, narrower rules lingers.
// v4 (2026-08-09): `/offline.html` joins the precache, so the bucket has to be
// rebuilt for the offline fallback below to have anything to serve.
const CACHE = "fitmess-shell-v4";
const PRECACHE = [
  "/",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
];

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

  // Full-page navigations: network-first, falling back to a cached page only
  // when the network is unavailable (offline). Never cache the response — it
  // may be an authenticated page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlineResponse(url)));
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
    return;
  }

  // Next's build output: cache-first, and safe to be, because every one of
  // these filenames contains a content hash — a changed file is a NEW URL, so a
  // cached entry can never be stale, only superseded (and the activate handler
  // above drops the whole bucket when `CACHE` is bumped).
  //
  // Why bother when HTTP already marks these `immutable`: on iOS, a PWA's HTTP
  // cache is evicted aggressively between launches, so "open the app after a
  // few hours" was re-downloading the entire JS/CSS payload over the network
  // before anything could paint. Cache Storage is not subject to that eviction,
  // so this is what makes a warm launch actually warm.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Brand art (the pear mark). NOT content-hashed, so cache-first would pin an
  // old logo forever — this serves the cached copy immediately and refreshes it
  // in the background, so a launch never waits on it but a changed logo still
  // lands on the next run.
  if (url.pathname.startsWith("/brand/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/**
 * What a full-page navigation gets when the network is gone.
 *
 * This used to be `caches.match("/")` for every URL, which meant that losing
 * signal INSIDE the installed app answered a tap on "Danas" with the marketing
 * landing — a sales page urging you to install FitMess, shown to someone who
 * already had it, with no way back because a standalone app has no browser
 * chrome. It read as "the app is broken and forgot who I am".
 *
 * So the split is by destination, not by network state:
 * - the site ROOT keeps the landing. It is genuinely cached, reads fine with no
 *   connection, and is what a visitor reopening fitmess.app asked for.
 * - everything else gets `/offline.html`, which names the actual problem and
 *   offers one button that retries THIS url (the navigation's address is kept,
 *   so the reload resumes where they were going).
 *
 * The last resort exists because `caches.match` resolves to `undefined` on a
 * miss, and handing `undefined` to `respondWith` fails the navigation outright
 * — a blank web view, which is exactly what this page is here to prevent.
 */
function offlineResponse(url) {
  const wanted = url.pathname === "/" ? "/" : "/offline.html";
  return caches
    .match(wanted)
    .then((cached) => cached || caches.match("/offline.html"))
    .then(
      (cached) =>
        cached ||
        new Response(
          "<!doctype html><meta charset=utf-8><title>FitMess</title>" +
            "<p style=\"font:16px -apple-system,sans-serif;text-align:center;margin-top:3rem\">" +
            "Nema veze sa internetom.",
          { headers: { "content-type": "text/html; charset=utf-8" } }
        )
    );
}

/**
 * Store a response copy, best-effort. Storage can be full or evicted mid-write;
 * that must never surface as a failed request, so the write is fire-and-forget
 * and its rejection is swallowed. Only real, complete same-origin successes are
 * stored — caching a 404 or an opaque error would pin the failure for the life
 * of the bucket.
 */
function putIfOk(request, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  const copy = response.clone();
  caches
    .open(CACHE)
    .then((cache) => cache.put(request, copy))
    .catch(() => {});
}

/**
 * Cached copy if present, else network. On ANY unexpected failure inside the
 * cache path we fall back to a plain `fetch`, so intercepting a request can
 * never leave the app worse off than not intercepting it at all.
 */
function cacheFirst(request) {
  return caches
    .match(request)
    .then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        putIfOk(request, response);
        return response;
      });
    })
    .catch(() => fetch(request));
}

/** Cached copy immediately (if any); refresh it in the background either way. */
function staleWhileRevalidate(request) {
  return caches
    .match(request)
    .then((cached) => {
      const network = fetch(request)
        .then((response) => {
          putIfOk(request, response);
          return response;
        })
        // Offline with a cached copy is fine (we return it); offline with
        // nothing cached surfaces as a failed request, exactly as before.
        .catch(() => cached);
      return cached || network;
    })
    .catch(() => fetch(request));
}

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

  // Buttons on the notification (2026-08-01). The url each one opens travels
  // in `data.actionUrls` because the Notification API hands the click handler
  // only the action's id, not whatever we attached to it.
  const actions = Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [];
  const actionUrls = {};
  for (const item of actions) {
    if (item && item.action && item.url) actionUrls[item.action] = item.url;
  }

  const options = {
    body: payload.body || "",
    tag: payload.tag || "fitmess",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/danas", actionUrls },
    // iOS ignores these and shows the plain notification, which is why every
    // body text has to stand on its own.
    actions: actions.map((item) => ({ action: item.action, title: item.title })),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  // A tapped BUTTON goes where that button promised; a tap on the notification
  // body goes to the reminder's own destination.
  const fromAction =
    event.action && data.actionUrls ? data.actionUrls[event.action] : null;
  const target = fromAction || data.url || "/danas";
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
