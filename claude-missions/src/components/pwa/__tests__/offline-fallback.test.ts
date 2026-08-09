import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * The offline fallback, tested against the real `public/sw.js` and the real
 * `public/offline.html` on disk — not against a copy of their logic.
 *
 * What this is guarding: the fallback used to hand EVERY failed navigation the
 * cached marketing landing. Losing signal inside the installed app therefore
 * answered a tap on "Danas" with a page selling FitMess to someone who already
 * had it installed, in a window with no back button. Nothing failed loudly, so
 * nothing would have caught it but a test that asks what the user is shown.
 */

const ROOT = join(__dirname, "..", "..", "..", "..");
const SW_SOURCE = readFileSync(join(ROOT, "public", "sw.js"), "utf8");
const OFFLINE_PAGE = readFileSync(join(ROOT, "public", "offline.html"), "utf8");
const SHELL_PAGE = readFileSync(
  join(ROOT, "capacitor", "www", "index.html"),
  "utf8"
);

/**
 * Runs the service worker's source with a fake `self` and `caches`, and hands
 * back the internals worth asserting on.
 *
 * A service worker registers its listeners at module scope against globals that
 * do not exist in a test environment, so it is evaluated inside a function that
 * supplies them — and returns the declared functions, which are hoisted into
 * that same scope.
 */
function loadServiceWorker(cached: Record<string, string>) {
  const self = {
    addEventListener: vi.fn(),
    location: { origin: "https://fitmess.app" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    registration: {},
  };
  const caches = {
    match: vi.fn(async (key: string) =>
      key in cached
        ? new Response(cached[key], {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
        : undefined
    ),
    open: vi.fn(async () => ({ addAll: vi.fn(), put: vi.fn() })),
    keys: vi.fn(async () => []),
  };

  const factory = new Function(
    "self",
    "caches",
    `${SW_SOURCE}\nreturn { offlineResponse, PRECACHE, CACHE };`
  );
  return factory(self, caches) as {
    offlineResponse: (url: URL) => Promise<Response>;
    PRECACHE: string[];
    CACHE: string;
  };
}

const LANDING = "<html>marketing landing: instaliraj FitMess</html>";
const OFFLINE = "<html>Nema veze sa internetom</html>";

describe("service worker offline fallback", () => {
  it("test_an_app_screen_without_network_gets_the_offline_page_not_the_landing", async () => {
    const sw = loadServiceWorker({ "/": LANDING, "/offline.html": OFFLINE });

    const response = await sw.offlineResponse(new URL("https://fitmess.app/danas"));

    const body = await response.text();
    expect(body).toContain("Nema veze sa internetom");
    expect(body).not.toContain("instaliraj");
  });

  it("test_the_site_root_still_gets_the_cached_landing", async () => {
    // A visitor reopening fitmess.app offline asked for the landing, and the
    // landing genuinely reads without a network. Only in-app URLs change.
    const sw = loadServiceWorker({ "/": LANDING, "/offline.html": OFFLINE });

    const response = await sw.offlineResponse(new URL("https://fitmess.app/"));

    await expect(response.text()).resolves.toContain("marketing landing");
  });

  it("test_an_empty_cache_still_answers_with_a_page_rather_than_a_dead_view", async () => {
    // `caches.match` resolves to undefined on a miss, and `respondWith(undefined)`
    // fails the navigation outright — a blank web view, the exact thing the
    // offline page exists to replace.
    const sw = loadServiceWorker({});

    const response = await sw.offlineResponse(new URL("https://fitmess.app/danas"));

    expect(response).toBeInstanceOf(Response);
    await expect(response.text()).resolves.toContain("Nema veze sa internetom");
  });

  it("test_the_offline_page_is_precached_or_it_could_never_be_served", async () => {
    const sw = loadServiceWorker({});
    expect(sw.PRECACHE).toContain("/offline.html");
  });
});

describe("offline page", () => {
  it("test_it_needs_nothing_from_the_network_to_render", async () => {
    // Every asset reference is a request that cannot succeed on the one screen
    // guaranteed to be shown with no connection. Inline styles only, no fonts,
    // no images, no bundle.
    expect(OFFLINE_PAGE).not.toMatch(/<link\b/i);
    expect(OFFLINE_PAGE).not.toMatch(/<img\b/i);
    expect(OFFLINE_PAGE).not.toMatch(/\bsrc\s*=/i);
    expect(OFFLINE_PAGE).not.toMatch(/https?:\/\//);
  });

  it("test_it_offers_no_way_out_of_the_app_only_a_retry", async () => {
    // A link here would strand the user: a standalone PWA and a web view have
    // no back button (docs/izlazak-u-store.md).
    expect(OFFLINE_PAGE).not.toMatch(/<a\b/i);
    expect(OFFLINE_PAGE).toContain("location.reload()");
  });

  it("test_it_says_the_same_thing_as_the_native_shells_own_offline_screen", async () => {
    // Two files, one message: `capacitor/www/index.html` covers the cold start
    // where no service worker is running yet, this one covers everything after.
    // A user must not get two different explanations for one problem.
    for (const line of [
      "Nema veze sa internetom",
      "FitMess čuva tvoj dan na serveru",
      "Uključi Wi-Fi ili mobilne podatke",
      "Pokušaj ponovo",
    ]) {
      expect(SHELL_PAGE, `shell page must say: ${line}`).toContain(line);
      expect(OFFLINE_PAGE, `offline page must say: ${line}`).toContain(line);
    }
  });
});
