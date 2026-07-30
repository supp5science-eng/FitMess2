import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCard,
  peekCard,
  prewarmCard,
  resetCardCache,
} from "../card-cache";

// The share card is a ~2.5 MB PNG that costs seconds of server render, so the
// cache's whole job is "never build the same card twice" -- across component
// remounts (memory), across a reload (Cache Storage), and across a prewarm
// racing a tap (in-flight de-duplication). These cases pin exactly that.

const LOG = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";

function png(): File {
  return new File([new Uint8Array([137, 80, 78, 71])], "fitmess-story.png", {
    type: "image/png",
  });
}

/**
 * A minimal in-memory Cache Storage, enough for match/put/keys/delete.
 *
 * `stats.bodyReads` counts how many times something actually pulled a stored
 * card's BYTES (as opposed to merely asking whether it exists) -- the
 * distinction the prewarm path depends on. It is counted here, on the way out
 * of `match`, rather than by stubbing the global `Response`: entries are put
 * into the bucket long before a test starts watching, so they are ordinary
 * `Response`s that a later global stub would never see.
 */
function installCacheStorage() {
  const buckets = new Map<string, Map<string, Response>>();
  const stats = { bodyReads: 0 };
  const storage = {
    open: async (name: string) => {
      const bucket = buckets.get(name) ?? new Map<string, Response>();
      buckets.set(name, bucket);
      return {
        match: async (url: string) => {
          const hit = bucket.get(url)?.clone();
          if (!hit) return undefined;
          return {
            arrayBuffer: () => {
              stats.bodyReads += 1;
              return hit.arrayBuffer();
            },
          };
        },
        put: async (url: string, response: Response) => {
          bucket.set(url, response);
        },
        keys: async () => [...bucket.keys()],
        delete: async (url: string) => bucket.delete(url),
      };
    },
    delete: async (name: string) => buckets.delete(name),
  };
  vi.stubGlobal("caches", storage);
  return stats;
}

let cacheStats: { bodyReads: number };

beforeEach(() => {
  cacheStats = installCacheStorage();
});

afterEach(async () => {
  await resetCardCache();
  vi.unstubAllGlobals();
});

describe("card cache", () => {
  it("test_builds_once_then_serves_the_card_from_memory", async () => {
    const build = vi.fn(async () => png());

    const first = await getCard(LOG, "story", build);
    const second = await getCard(LOG, "story", build);

    expect(build).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    // Synchronously available, so opening the sheet shows no spinner frame.
    expect(peekCard(LOG, "story")).toBe(first);
  });

  it("test_a_prewarm_and_a_racing_tap_share_one_build", async () => {
    let release!: (file: File) => void;
    const gate = new Promise<File>((resolve) => {
      release = resolve;
    });
    const build = vi.fn(() => gate);

    const tap = getCard(LOG, "story", build);
    const alsoTap = getCard(LOG, "story", build);
    release(png());
    await Promise.all([tap, alsoTap]);

    expect(build).toHaveBeenCalledTimes(1);
  });

  it("test_a_card_survives_a_reload_by_coming_back_from_cache_storage", async () => {
    const build = vi.fn(async () => png());
    await getCard(LOG, "story", build);
    await flushPersist();

    // A reload keeps Cache Storage but wipes module memory.
    await resetMemoryOnly();
    expect(peekCard(LOG, "story")).toBeUndefined();

    const afterReload = await getCard(LOG, "story", build);
    expect(build).toHaveBeenCalledTimes(1);
    expect(afterReload.type).toBe("image/png");
  });

  it("test_formats_and_meals_are_cached_independently", async () => {
    const build = vi.fn(async () => png());

    await getCard(LOG, "story", build);
    await getCard(LOG, "post", build);
    await getCard(OTHER, "story", build);

    expect(build).toHaveBeenCalledTimes(3);
    expect(peekCard(LOG, "post")).toBeDefined();
    expect(peekCard(OTHER, "post")).toBeUndefined();
  });

  it("test_a_failed_build_is_not_cached_so_the_next_attempt_retries", async () => {
    const build = vi
      .fn<() => Promise<File>>()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce(png());

    await expect(getCard(LOG, "story", build)).rejects.toThrow();
    expect(peekCard(LOG, "story")).toBeUndefined();

    await expect(getCard(LOG, "story", build)).resolves.toBeDefined();
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("test_prewarming_several_meals_never_renders_two_cards_at_once", async () => {
    // Several photo meals on /danas each prewarm on mount; concurrent 1080x1920
    // renders would mean N x 2.5 MB over a phone connection.
    let active = 0;
    let peak = 0;
    const build = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return png();
    });

    await Promise.all([
      prewarmCard(LOG, "story", build),
      prewarmCard(OTHER, "story", build),
      prewarmCard("33333333-4444-4555-8666-777777777777", "story", build),
    ]);

    expect(build).toHaveBeenCalledTimes(3);
    expect(peak).toBe(1);
  });

  it("test_prewarming_an_already_cached_card_costs_nothing", async () => {
    const build = vi.fn(async () => png());
    await getCard(LOG, "story", build);

    await prewarmCard(LOG, "story", build);

    expect(build).toHaveBeenCalledTimes(1);
  });

  it("test_a_prewarm_on_a_later_visit_reuses_the_card_built_on_an_earlier_one", async () => {
    // The reported bug, end to end: log a photo meal at 12h (the add-flow
    // prewarms), come back at 13h (fresh document -- module memory is gone,
    // Cache Storage is not) and tap "Podeli". The mount prewarm must recognise
    // the card as already built and NOT render a second one, which is what made
    // the user wait on a spinner for a card they had already paid for.
    const build = vi.fn(async () => png());
    await prewarmCard(LOG, "story", build);
    await flushPersist();
    expect(build).toHaveBeenCalledTimes(1);

    await resetMemoryOnly();

    await prewarmCard(LOG, "story", build);
    expect(build).toHaveBeenCalledTimes(1);

    // And the card itself still comes back, without a rebuild.
    const shared = await getCard(LOG, "story", build);
    expect(build).toHaveBeenCalledTimes(1);
    expect(shared.type).toBe("image/png");
  });

  it("test_checking_for_a_cached_card_does_not_read_its_bytes", async () => {
    // Every photo meal on /danas prewarms, so an existence check that pulled
    // the body meant N x ~2.5 MB decoded on mount -- jank, and enough storage
    // pressure to get the whole bucket evicted (taking the cards with it).
    const build = vi.fn(async () => png());
    await getCard(LOG, "story", build);
    await flushPersist();
    await resetMemoryOnly();

    cacheStats.bodyReads = 0;

    await prewarmCard(LOG, "story", build);

    expect(build).toHaveBeenCalledTimes(1);
    expect(cacheStats.bodyReads).toBe(0);

    // ...but the bytes are still there for the tap that actually opens it.
    const shared = await getCard(LOG, "story", build);
    expect(cacheStats.bodyReads).toBe(1);
    expect(shared.type).toBe("image/png");
  });

  it("test_a_prewarm_failure_is_swallowed_so_mounting_never_throws", async () => {
    const build = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(prewarmCard(LOG, "story", build)).resolves.toBeUndefined();
    expect(peekCard(LOG, "story")).toBeUndefined();
  });

  it("test_it_works_when_cache_storage_is_unavailable", async () => {
    // Private mode / insecure context: persistence is impossible, but building
    // and the in-memory layer must still work.
    vi.stubGlobal("caches", undefined);
    const build = vi.fn(async () => png());

    await getCard(LOG, "story", build);
    await getCard(LOG, "story", build);

    expect(build).toHaveBeenCalledTimes(1);
  });
});

/** Simulate a reload: module memory is gone, Cache Storage persists. */
async function resetMemoryOnly() {
  const { __dropMemoryForTests } = await import("../card-cache");
  __dropMemoryForTests();
}

/** Persistence is deliberately not awaited by `getCard`; wait it out. */
async function flushPersist() {
  const { __flushPersistForTests } = await import("../card-cache");
  await __flushPersistForTests();
}
