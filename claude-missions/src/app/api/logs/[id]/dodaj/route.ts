import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { addMoreSelectionSchema, applyAddMore } from "@/lib/log/add-more";
import { getExtraFoodsByIds } from "@/lib/log/extras";
import type { Database } from "@/lib/types/db";

// "Dodaj još" (2026-07-25): `POST /api/logs/[id]/dodaj` -- grow an existing
// entry by whole seconds and/or extra units of its components, without
// re-photographing anything.
//
// Same request-building shape as `PATCH /api/logs/[id]` (client built straight
// from `request.cookies` so the handler is callable from Vitest with a
// hand-built `NextRequest`), and the same trust posture: the body carries only
// UNIT COUNTS. The handler re-reads the row through RLS and recomputes every
// number server-side via `applyAddMore` -- a client-submitted kcal is never
// written (money-math rule, tech-decisions.md).
//
// RLS (`logs_select_own` / `logs_update_own`, 0004_foods_logs.sql) is what
// enforces ownership: another user's id is filtered out before this code sees
// it, so it 404s exactly like a nonexistent one (never a "it exists but isn't
// yours" hint).
//
// Deliberately NOT folded into `PATCH /api/logs/[id]`: that route resolves a
// portion against the referenced `foods` row and refuses entries with
// `food_id: null`, which is precisely the AI meal entries this feature exists
// for. This one works off the entry's own snapshot and needs no catalog row.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";
const MALFORMED_ID_ERROR_SR = "Neispravan identifikator unosa.";
const EMPTY_SELECTION_ERROR_SR = "Nisi izabrao/la šta da dodamo.";
const NOT_FOUND_ERROR_SR = "Unos više ne postoji.";
export const ADD_MORE_FAILED_ERROR_SR =
  "Nismo uspeli da dodamo. Pokušaj ponovo.";

const idSchema = z.string().min(1, MALFORMED_ID_ERROR_SR);

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_ID_ERROR_SR },
      { status: 400 }
    );
  }
  const logId = parsedId.data;

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

  const parsedBody = addMoreSelectionSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  try {
    // logs_select_own RLS: only ever returns a row the caller owns.
    const { data: existingLog, error: readError } = await supabase
      .from("logs")
      .select("*")
      .eq("id", logId)
      .maybeSingle();

    if (readError) {
      console.error("[dodaj-jos] log lookup failed:", readError.message);
      return NextResponse.json(
        { ok: false, error_sr: ADD_MORE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!existingLog) {
      return NextResponse.json(
        { ok: false, error_sr: NOT_FOUND_ERROR_SR },
        { status: 404 }
      );
    }

    // Extras arrive as bare catalog ids. Their nutrition is read here, from
    // `foods`, so the numbers written are the catalog's and not the client's --
    // the same rule the components path gets for free by recomputing off the
    // stored row.
    const extraFoods = await getExtraFoodsByIds(
      supabase,
      parsedBody.data.extras.map((pick) => pick.foodId)
    );

    const result = applyAddMore(existingLog, parsedBody.data, extraFoods);
    if (result.isEmpty) {
      return NextResponse.json(
        { ok: false, error_sr: EMPTY_SELECTION_ERROR_SR },
        { status: 400 }
      );
    }

    const { totals } = result;
    const { data: updated, error: updateError } = await supabase
      .from("logs")
      .update({
        grams: totals.grams,
        kcal: totals.kcal,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        sugar: totals.sugar,
        sodium: totals.sodium,
        sat_fat: totals.satFat,
        // Only ever written when the entry had a breakdown to begin with, so a
        // catalog entry keeps its NULL instead of gaining an empty array.
        ...(result.components ? { components: result.components } : {}),
      })
      .eq("id", logId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("[dodaj-jos] log update failed:", updateError.message);
      return NextResponse.json(
        { ok: false, error_sr: ADD_MORE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { ok: false, error_sr: NOT_FOUND_ERROR_SR },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error("[dodaj-jos] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: ADD_MORE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
