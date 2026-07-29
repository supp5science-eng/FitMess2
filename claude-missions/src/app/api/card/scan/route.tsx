import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import {
  cardGlyphSet,
  cardMacros,
  CARD_CHROME_TEXT,
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
 * §3.1) as a PNG for the native share sheet.
 *
 * The client (the Prizma result screen) POSTs the downscaled meal photo plus
 * the confirmed macros; this route turns that into a 9:16 or 1:1 branded card
 * with `next/og`. Two deliberate server-side decisions:
 *
 *  - The photo rides in the request body, so satori embeds it as a data URI --
 *    no cross-request auth dance to re-fetch a private `meal_photos` row from
 *    an edge render.
 *  - The TIER is computed here from the user's REAL logged days (§4 "tier se ne
 *    kupuje — samo zarađuje"), never from a client-sent streak. Today's key is
 *    added to the set because the user is, by definition, logging a meal today.
 *
 * Auth is a signed-in session; the response is private and uncacheable (it
 * contains the user's own photo).
 */

export const dynamic = "force-dynamic";

// The client already downscales to ~1080px; this is a generous ceiling that
// still refuses a full-resolution phone photo posted by mistake.
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

const fieldsSchema = z.object({
  naziv: z.string().trim().min(1).max(120),
  kcal: z.coerce.number().min(0).max(20000),
  protein: z.coerce.number().min(0).max(2000),
  carbs: z.coerce.number().min(0).max(2000),
  fat: z.coerce.number().min(0).max(2000),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse({
    naziv: formData.get("naziv"),
    kcal: formData.get("kcal"),
    protein: formData.get("protein"),
    carbs: formData.get("carbs"),
    fat: formData.get("fat"),
  });
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const photo = formData.get("slika");
  if (
    !(photo instanceof File) ||
    photo.size === 0 ||
    photo.size > MAX_PHOTO_BYTES ||
    !photo.type.startsWith("image/")
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const format = toCardFormat(
    typeof formData.get("format") === "string"
      ? (formData.get("format") as string)
      : null
  );

  // Tier from the user's real streak, including today (they're logging now).
  const todayKey = toBelgradeCalendarDay(new Date());
  const loggedDays = await getLoggedDayKeys(supabase, userId);
  loggedDays.add(todayKey);
  const tier = tierForStreak(currentStreak(loggedDays, todayKey));

  const photoBytes = Buffer.from(await photo.arrayBuffer());
  const photoDataUri = `data:${photo.type};base64,${photoBytes.toString(
    "base64"
  )}`;

  const model: ScanCardModel = {
    dishName: cleanDishName(parsed.data.naziv),
    kcal: formatKcal(parsed.data.kcal),
    macros: cardMacros(parsed.data.protein, parsed.data.carbs, parsed.data.fat),
    tier,
    format,
    photoDataUri,
  };

  const fonts = await loadCardFonts(
    cardGlyphSet(model.dishName, CARD_CHROME_TEXT)
  );

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
