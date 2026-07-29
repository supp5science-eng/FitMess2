import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import {
  cardFontText,
  cardMacros,
  CARD_FORMATS,
  cleanDishName,
  formatKcal,
  type ScanCardModel,
  toCardFormat,
} from "@/lib/share/card";
import { loadCardFonts } from "@/lib/share/fonts";
import { tierForStreak } from "@/lib/share/tier";
import { getLoggedDayKeys } from "@/lib/streak/read-streak";
import { currentStreak } from "@/lib/streak/streak";
import { createClient } from "@/lib/supabase/server";
import { scanCardElement } from "./scan-card-template";

/**
 * POST /api/card/scan — render the "Scan moment" share card (Share-cards PRD
 * §3.1) as a PNG for a single already-logged meal.
 *
 * The card is shared from the meal down on `/danas`, so the client sends only
 * the `logId` (JSON). Everything else is read server-side, which is both
 * simpler and safer:
 *
 *  - name + macros come from the user's own `logs` row (RLS-scoped),
 *  - the background is the stored `meal_photos` thumbnail for that log,
 *  - the TIER is derived from the user's REAL streak (§4 "zarađuje se, ne
 *    kupuje") — never a client-sent number.
 *
 * A meal with no stored photo can't be a scan card, so the button that calls
 * this only appears on photo meals; a missing photo answers 404 defensively.
 * The response is private and uncacheable (it contains the user's own photo).
 */

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  logId: z.string().regex(UUID_RE),
  format: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }
  const { logId } = parsed.data;
  const format = toCardFormat(parsed.data.format);

  // The meal itself (RLS scopes this to the caller's own logs).
  const { data: log } = await supabase
    .from("logs")
    .select("name, kcal, protein, carbs, fat")
    .eq("id", logId)
    .maybeSingle();
  if (!log) {
    return new NextResponse(null, { status: 404 });
  }

  // Its stored photo -- the full-bleed background. No photo => no scan card.
  const { data: photo } = await supabase
    .from("meal_photos")
    .select("image_base64, mime_type")
    .eq("log_id", logId)
    .maybeSingle();
  if (!photo) {
    return new NextResponse(null, { status: 404 });
  }

  // Tier from the user's real current streak (no client input to trust).
  const todayKey = toBelgradeCalendarDay(new Date());
  const loggedDays = await getLoggedDayKeys(supabase, userId);
  const tier = tierForStreak(currentStreak(loggedDays, todayKey));

  const photoDataUri = `data:${photo.mime_type || "image/jpeg"};base64,${
    photo.image_base64
  }`;

  const model: ScanCardModel = {
    dishName: cleanDishName(log.name),
    kcal: formatKcal(log.kcal),
    macros: cardMacros(log.protein, log.carbs, log.fat),
    tier,
    format,
    photoDataUri,
  };

  // One fixed glyph set for (almost) every card, so the font subset request is
  // byte-identical between meals and the loader's cache actually hits -- the
  // font fetch used to be the slowest part of building a card.
  const fonts = await loadCardFonts(cardFontText(model.dishName));

  const { width, height } = CARD_FORMATS[format];
  return new ImageResponse(scanCardElement(model), {
    width,
    height,
    // Empty when the font fetch was blocked/slow -- satori then uses its
    // built-in sans-serif and the card still renders (see fonts.ts).
    fonts: fonts.length > 0 ? fonts : undefined,
    headers: {
      // Per-user and photo-bearing: never store in a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
