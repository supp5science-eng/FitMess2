import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { splitLoggedMeal } from "@/lib/ai/split-meal";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { readComponents } from "@/lib/log/add-more";
import type { Database } from "@/lib/types/db";

// "Dodaj još" (2026-07-25): `POST /api/logs/[id]/razlozi` -- break an already
// logged entry into the individual foods it was made of, so the steppers can
// offer "+1 jaje" and "+1 kašika pavlake" separately.
//
// This is what makes the feature work on the entries that ALREADY EXIST (every
// meal logged before 0019, plus everything arriving through catalog / barcode /
// Gric / voice, none of which itemise). Without it, "Dodaj još" would only ever
// be able to double those meals, which is barely better than logging them
// twice.
//
// Runs at most ONCE per entry: the split is written back to `logs.components`
// and this handler short-circuits on the next call. An entry that already has a
// breakdown is returned untouched -- the AI never gets to re-litigate a plate
// the user (or the photo estimator) already itemised.
//
// The stored totals are never touched. `splitLoggedMeal` normalises the parts
// back onto them precisely so the day's kcal cannot move under the user just
// because they opened a sheet.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_ID_ERROR_SR = "Neispravan identifikator unosa.";
const NOT_FOUND_ERROR_SR = "Unos više ne postoji.";
const SPLIT_FAILED_ERROR_SR =
  "Nismo uspeli da razložimo obrok. Možeš da dodaš ceo unos još jednom.";

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
  // Auth-gate BEFORE the paid call -- an anonymous request must never reach
  // Gemini (same posture as the estimate server actions).
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  try {
    // logs_select_own RLS: only ever returns a row the caller owns.
    const { data: log, error: readError } = await supabase
      .from("logs")
      .select("*")
      .eq("id", logId)
      .maybeSingle();

    if (readError) {
      console.error("[razlozi] log lookup failed:", readError.message);
      return NextResponse.json(
        { ok: false, error_sr: SPLIT_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!log) {
      return NextResponse.json(
        { ok: false, error_sr: NOT_FOUND_ERROR_SR },
        { status: 404 }
      );
    }

    const existing = readComponents(log.components);
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, data: log }, { status: 200 });
    }

    const components = await splitLoggedMeal({
      name: log.name,
      grams: log.grams,
      kcal: log.kcal,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
    });

    if (!components || components.length === 0) {
      return NextResponse.json(
        { ok: false, error_sr: SPLIT_FAILED_ERROR_SR },
        { status: 502 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("logs")
      .update({ components })
      .eq("id", logId)
      .select("*")
      .maybeSingle();

    if (updateError || !updated) {
      // The split itself succeeded; only persisting it didn't. Hand it back
      // anyway so this visit works -- the next one just pays for it again.
      console.warn("[razlozi] persist failed:", updateError?.message);
      return NextResponse.json(
        { ok: true, data: { ...log, components } },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error("[razlozi] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: SPLIT_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
