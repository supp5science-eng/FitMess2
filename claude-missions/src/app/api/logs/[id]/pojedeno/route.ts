import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  FULL_EATEN_SHARE,
  MIN_EATEN_SHARE,
  applyEatenShare,
} from "@/lib/log/eaten-share";
import type { Database } from "@/lib/types/db";

// "Nisam sve pojeo" (2026-08-01): `POST /api/logs/[id]/pojedeno` -- shrink a
// logged entry to the share of it that was actually eaten.
//
// The mirror image of `POST /api/logs/[id]/dodaj`, and built the same way: the
// body carries ONE NUMBER (a percentage), the handler re-reads the row through
// RLS and recomputes every figure server-side. No client-submitted kcal is ever
// written (money-math rule, tech-decisions.md).
//
// Reversible by construction. The row keeps the EATEN numbers and `eaten_share`
// (0025) keeps the ratio, so the served plate is always `stored / share` and
// sliding back to 100% restores the entry -- which is exactly why this is not
// simply a scaled `PATCH`.
//
// RLS (`logs_select_own` / `logs_update_own`, 0004) enforces ownership: another
// user's id is filtered out before this code sees it, so it 404s exactly like a
// nonexistent one (never a "it exists but isn't yours" hint).

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";
const MALFORMED_ID_ERROR_SR = "Neispravan identifikator unosa.";
const NOT_FOUND_ERROR_SR = "Unos više ne postoji.";
export const EATEN_SHARE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo. Pokušaj ponovo.";

const idSchema = z.string().min(1, MALFORMED_ID_ERROR_SR);

const bodySchema = z.object({
  /** Percentage of the served portion that was eaten. */
  share: z.coerce.number().min(MIN_EATEN_SHARE).max(FULL_EATEN_SHARE),
});

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

  const parsedBody = bodySchema.safeParse(rawBody);
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
      console.error("[pojedeno] log lookup failed:", readError.message);
      return NextResponse.json(
        { ok: false, error_sr: EATEN_SHARE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!existingLog) {
      return NextResponse.json(
        { ok: false, error_sr: NOT_FOUND_ERROR_SR },
        { status: 404 }
      );
    }

    const result = applyEatenShare(existingLog, parsedBody.data.share);
    // Saving the share it already has is a no-op, not an error: the user opened
    // the sheet, looked, and confirmed. Return the row untouched.
    if (result.isNoop) {
      return NextResponse.json({ ok: true, data: existingLog }, { status: 200 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("logs")
      .update({
        grams: result.grams,
        kcal: result.kcal,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        fiber: result.fiber,
        sugar: result.sugar,
        sodium: result.sodium,
        sat_fat: result.satFat,
        eaten_share: result.share,
        // Only written when the entry had a breakdown, so a catalog entry keeps
        // its NULL instead of gaining an empty array.
        ...(result.components ? { components: result.components } : {}),
      })
      .eq("id", logId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("[pojedeno] log update failed:", updateError.message);
      return NextResponse.json(
        { ok: false, error_sr: EATEN_SHARE_FAILED_ERROR_SR },
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
    console.error("[pojedeno] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: EATEN_SHARE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
