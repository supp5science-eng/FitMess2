import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { aiErrorSr } from "@/lib/ai/gemini";
import {
  estimateExtraFromText,
  extraQuerySchema,
  toAiExtraFood,
} from "@/lib/ai/extra-estimate";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { AI_EXTRA_ID_PREFIX } from "@/lib/log/extras";
import type { Database } from "@/lib/types/db";

// "Napiši šta si još pojeo/la" (2026-08-01): `POST /api/dodaci/opis` -- turn a
// free-text description plus an amount into something the "Dodaj još" sheet can
// step like any other extra.
//
// This replaced catalog search inside that sheet. The catalog is 350 curated
// foods: great for the chips, a dead end for "tartar sos" or "pola pite" --
// and a search that answers "nema u katalogu" is how calories quietly stop
// being logged, which is the exact failure "Dodaj još" exists to prevent.
//
// Auth-gated BEFORE the paid call, like every other estimate path: an anonymous
// request must never reach Gemini. The id is minted HERE rather than on the
// client so that the `ai:` marker the save route keys off (catalog rows are
// re-read, written-in extras are not) always comes from us.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR =
  "Napiši šta si pojeo/la — bar par slova.";
const NOT_FOOD_ERROR_SR =
  "Ovo nam ne liči na hranu. Probaj drugačije da opišeš.";
export const EXTRA_FAILED_ERROR_SR =
  "Nismo uspeli da procenimo. Pokušaj ponovo ili napiši drugačije.";

function buildSessionClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this handler never refreshes the session cookie.
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = buildSessionClient(request);
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = extraQuerySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  try {
    const estimate = await estimateExtraFromText(parsed.data);
    if (!estimate) {
      return NextResponse.json(
        { ok: false, error_sr: EXTRA_FAILED_ERROR_SR },
        { status: 502 }
      );
    }
    // The model's own "this isn't food" verdict. Refusing beats inventing a
    // calorie count for a typo -- a wrong number the user can't see is worse
    // than an honest "probaj drugačije".
    if (!estimate.prepoznato || estimate.kcal_100g <= 0) {
      return NextResponse.json(
        { ok: false, error_sr: NOT_FOOD_ERROR_SR },
        { status: 422 }
      );
    }

    const { food, units } = toAiExtraFood(
      estimate,
      `${AI_EXTRA_ID_PREFIX}${crypto.randomUUID()}`
    );

    return NextResponse.json(
      { ok: true, data: { food, units, napomena: estimate.napomena } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[dodaci/opis] estimate failed:", err);
    // Quota and other Gemini-shaped failures get their own Serbian message
    // ("previše zahteva, probaj za koji minut") instead of a generic retry.
    return NextResponse.json(
      { ok: false, error_sr: aiErrorSr(err, EXTRA_FAILED_ERROR_SR) },
      { status: 502 }
    );
  }
}
