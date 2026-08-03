"use client";

import { useEffect, useState } from "react";

import { buildScanCard } from "@/lib/share/build-scan-card";
import type { CardFormat } from "@/lib/share/card";
import { queueCard } from "@/lib/share/card-cache";

/**
 * The rendered "Scan moment" card for one meal, as an object URL ready for an
 * `<img>` — or `null` while it is still building, and forever if it can't be
 * built at all.
 *
 * This is what turns the share card from something you only ever see after
 * tapping "Podeli" into the meal's actual picture on `/danas`: the tile and the
 * lightbox both show THIS instead of the bare photo. Two consequences shape the
 * hook:
 *
 *  - **It must never be load-bearing.** A card can genuinely fail — the photo is
 *    pruned server-side after ~1 day, the render can time out, the user can be
 *    offline. Every failure resolves to `null` and the caller falls back to the
 *    raw photo, which is the card's own background anyway.
 *  - **It goes through the serial queue** (`queueCard`), not `getCard`: several
 *    photo meals can be on screen at once and each card is a ~2.5 MB server
 *    rasterise. A card the add-flow already prewarmed skips the queue entirely,
 *    which is the usual path — logging a photo meal builds the card and lands on
 *    `/danas`, so it is normally finished before the tile ever asks.
 *
 * Only the 9:16 "story" card is ever requested, app-wide, so the tile, the
 * lightbox and the share sheet all show the same single file — one render per
 * meal, and what you see in the app is byte-for-byte what you share.
 */
const FORMAT: CardFormat = "story";

export function useScanCardImage(
  logId: string,
  /** Off for meals with no stored photo — there is no card to build. */
  enabled: boolean
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    queueCard(logId, FORMAT, buildScanCard)
      .then((file) => {
        // `createObjectURL` is missing under some test environments; treating it
        // as "no card" keeps the photo fallback rather than throwing.
        if (cancelled || typeof URL.createObjectURL !== "function") return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
      })
      .catch(() => {
        // Pruned photo, offline, or a render hiccup: the caller shows the photo.
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logId, enabled]);

  return url;
}
