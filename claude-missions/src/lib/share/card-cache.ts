/**
 * The share card's cache and build scheduler.
 *
 * Rendering a "Scan moment" card is EXPENSIVE and the cost is all server-side:
 * `next/og` (satori + resvg) rasterizes a 1080x1920 canvas and PNG-encodes it,
 * measured at ~6 s on a cold serverless instance, ~1.2-1.9 s warm, for a ~2.5 MB
 * response. The meal photo itself is only ~330 ms of that -- the cost tracks
 * pixel count, so there is no cheap server-side win to be had. The only way the
 * button feels instant is to not pay that cost twice.
 *
 * Hence three layers, checked in order:
 *
 *  1. **Memory** (module-level, not per-component): survives a `ShareMealSheet`
 *     remount and is shared across meals, so scrolling `/danas` or reopening the
 *     sheet never rebuilds.
 *  2. **In-flight**: one promise per `logId:format`, so a prewarm and a tap that
 *     races it join a single request instead of both rendering.
 *  3. **Cache Storage**: survives a page reload and navigation away and back --
 *     the case that made a card the user had "already created" render again from
 *     scratch. Bounded to `MAX_PERSISTED` entries because each one is megabytes.
 *
 * On top of that a **serial prewarm queue**: `/danas` can show several photo
 * meals at once, and letting each one prewarm on mount would fire N concurrent
 * 1080x1920 renders and pull N x 2.5 MB over a phone connection. Prewarming is a
 * background nicety, so it runs one at a time and skips anything already cached.
 *
 * Every persistence step is best-effort: Cache Storage needs a secure context
 * and can be disabled, full, or evicted at any time. A failure anywhere here
 * only ever costs a rebuild, so all of it is wrapped and swallowed.
 */

import type { CardFormat } from "@/lib/share/card";

/** Builds the PNG for one meal+format. Injected so this module stays free of
 * `fetch`/route knowledge and is testable without a network. */
export type CardBuilder = (logId: string, format: CardFormat) => Promise<File>;

/** The Cache Storage bucket. Bump the suffix whenever the CARD DESIGN changes,
 * so users stop being served a card rendered by the previous template. */
const CACHE_NAME = "fitmess-share-cards-v1";

/** How many rendered cards may sit in Cache Storage. Each is ~1.5-2.5 MB, and
 * the photo a card is built from is pruned server-side after ~1 day, so there is
 * no point hoarding: this covers a heavy logging day and stays well clear of
 * per-origin storage limits. */
const MAX_PERSISTED = 12;

const memory = new Map<string, File>();
const inFlight = new Map<string, Promise<File>>();
/** Persistence writes still settling. Product code never waits on these (the
 * card is usable the moment it is built); tests await them to assert the
 * survives-a-reload behaviour deterministically. */
const persisting = new Set<Promise<void>>();

function entryKey(logId: string, format: CardFormat): string {
  return `${logId}:${format}`;
}

/**
 * The Cache Storage key. Cache Storage matches on GET requests only (the real
 * card call is a POST), so entries are filed under a synthetic same-origin URL
 * that no route serves -- it is a cache key, never a request anyone makes.
 */
function cacheUrl(logId: string, format: CardFormat): string {
  return `/__share-card/${logId}/${format}.png`;
}

function fileName(format: CardFormat): string {
  return `fitmess-${format}.png`;
}

async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null;
    return await caches.open(CACHE_NAME);
  } catch {
    // No secure context, storage disabled, or a private-mode restriction.
    return null;
  }
}

/**
 * Whether a card is already persisted, WITHOUT pulling its bytes.
 *
 * Existence and content are separate questions here, and conflating them was
 * expensive: `/danas` prewarms one card per photo meal, and answering "is this
 * cached?" by reading the body meant several megabytes of `ArrayBuffer` decoded
 * on mount per meal, for cards the user may never open. That is both jank and
 * storage pressure — and an origin over its quota gets its Cache Storage
 * evicted wholesale, which silently threw away the very cards this layer
 * exists to keep. `match()` alone answers it; the body stays on disk until
 * something actually needs it.
 */
async function hasPersisted(
  logId: string,
  format: CardFormat
): Promise<boolean> {
  try {
    const cache = await openCache();
    if (!cache) return false;
    return (await cache.match(cacheUrl(logId, format))) != null;
  } catch {
    return false;
  }
}

/** Read a previously persisted card, or `null`. Never throws. */
async function readPersisted(
  logId: string,
  format: CardFormat
): Promise<File | null> {
  try {
    const cache = await openCache();
    if (!cache) return null;
    const hit = await cache.match(cacheUrl(logId, format));
    if (!hit) return null;
    // Via ArrayBuffer, not `.blob()`: it is the one body form every Response
    // implementation agrees on, so this path behaves identically in a browser
    // and under test.
    const bytes = await hit.arrayBuffer();
    if (bytes.byteLength === 0) return null;
    return new File([bytes], fileName(format), { type: "image/png" });
  } catch {
    return null;
  }
}

/** Persist a built card and trim the bucket back to `MAX_PERSISTED`. Never throws. */
async function persist(
  logId: string,
  format: CardFormat,
  file: File
): Promise<void> {
  try {
    const cache = await openCache();
    if (!cache) return;
    // Hand the Response raw bytes rather than the File itself -- see the note in
    // `readPersisted` about body-form portability.
    await cache.put(
      cacheUrl(logId, format),
      new Response(await file.arrayBuffer(), {
        headers: { "Content-Type": "image/png" },
      })
    );
    // `keys()` resolves in insertion order, so the oldest entries are first --
    // drop from the front until the bucket is back within budget.
    const keys = await cache.keys();
    for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_PERSISTED))) {
      await cache.delete(stale);
    }
  } catch {
    // Quota exceeded or storage evicted mid-write: the card still works, it just
    // won't survive this reload.
  }
}

/** A card already in memory, if there is one. Synchronous, for first render. */
export function peekCard(logId: string, format: CardFormat): File | undefined {
  return memory.get(entryKey(logId, format));
}

/**
 * Get the card for `logId`+`format`, building it only if no layer has it.
 *
 * Resolution order is memory → in-flight → Cache Storage → `build`. A failed
 * build is NOT cached, so the next attempt is free to retry.
 */
export function getCard(
  logId: string,
  format: CardFormat,
  build: CardBuilder
): Promise<File> {
  const key = entryKey(logId, format);

  const warm = memory.get(key);
  if (warm) return Promise.resolve(warm);

  const flying = inFlight.get(key);
  if (flying) return flying;

  const work = (async () => {
    const persisted = await readPersisted(logId, format);
    if (persisted) {
      memory.set(key, persisted);
      return persisted;
    }
    const file = await build(logId, format);
    memory.set(key, file);
    // Don't make the caller wait on persistence -- the file is ready now.
    const write = persist(logId, format, file).finally(() => {
      persisting.delete(write);
    });
    persisting.add(write);
    return file;
  })();

  const tracked = work.finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return tracked;
}

/**
 * Whether a card exists in any layer, without building it — and without
 * reading it. A persisted card is deliberately NOT promoted into memory here:
 * the tap that follows goes through `getCard`, which reads it from Cache
 * Storage in milliseconds, and paying N x megabytes up front for every meal on
 * screen (see `hasPersisted`) cost far more than that read ever saves.
 */
async function isCached(logId: string, format: CardFormat): Promise<boolean> {
  if (memory.has(entryKey(logId, format))) return true;
  return hasPersisted(logId, format);
}

// --- Serial prewarm queue -------------------------------------------------

const queue: (() => Promise<void>)[] = [];
let draining = false;

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (job) await job();
    }
  } finally {
    draining = false;
  }
}

/**
 * Queue a background build for `logId`+`format`, at most one at a time across
 * the whole app, skipping anything already cached.
 *
 * Fire-and-forget by design: the caller is a mount effect, and a prewarm that
 * fails changes nothing -- the sheet still builds on open. Returns a promise so
 * tests can await the queue; product code ignores it.
 */
export function prewarmCard(
  logId: string,
  format: CardFormat,
  build: CardBuilder
): Promise<void> {
  const job = async () => {
    try {
      if (await isCached(logId, format)) return;
      await getCard(logId, format, build);
    } catch {
      // Offline, a 404 because the photo was pruned, or a server hiccup.
    }
  };
  queue.push(job);
  return drain();
}

/**
 * Get a card THROUGH the serial queue, resolving with the file.
 *
 * `getCard` is the right call for a card the user is waiting on (a "Podeli"
 * tap): it starts immediately. `prewarmCard` is the right call for a card
 * nobody asked for. This is the third case the meal tile introduced — a card
 * that is VISIBLE CONTENT, so it must actually arrive, but of which several can
 * be on screen at once. Firing those in parallel is exactly what the queue
 * exists to prevent (N concurrent 1080x1920 renders, N x ~2.5 MB over a phone
 * connection), so the build waits its turn — while a cached card, the common
 * case once the add-flow has prewarmed it, still resolves without queueing.
 */
export function queueCard(
  logId: string,
  format: CardFormat,
  build: CardBuilder
): Promise<File> {
  const key = entryKey(logId, format);

  const warm = memory.get(key);
  if (warm) return Promise.resolve(warm);

  const flying = inFlight.get(key);
  if (flying) return flying;

  return new Promise<File>((resolve, reject) => {
    queue.push(async () => {
      try {
        resolve(await getCard(logId, format, build));
      } catch (error) {
        reject(error);
      }
    });
    void drain();
  });
}

/** Wait for every pending persistence write. Test-only. */
export async function __flushPersistForTests(): Promise<void> {
  while (persisting.size > 0) {
    await Promise.all([...persisting]);
  }
}

/** Drop the in-memory layer only, leaving Cache Storage intact -- exactly what a
 * page reload does. Test-only: it is how the persistence layer is exercised. */
export function __dropMemoryForTests(): void {
  memory.clear();
  inFlight.clear();
}

/** Drop every layer. Test-only: module-level state would otherwise leak between
 * cases (and a stale card between design changes -- see `CACHE_NAME`). */
export async function resetCardCache(): Promise<void> {
  memory.clear();
  inFlight.clear();
  queue.length = 0;
  try {
    if (typeof caches !== "undefined") await caches.delete(CACHE_NAME);
  } catch {
    // Nothing to clear.
  }
}
