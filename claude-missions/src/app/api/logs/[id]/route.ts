import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  deleteLog,
  LOG_DELETE_FAILED_ERROR_SR,
  LOG_FOOD_UNAVAILABLE_ERROR_SR,
  LOG_NOT_FOUND_ERROR_SR,
  LOG_UPDATE_FAILED_ERROR_SR,
  updateLogFromPortion,
} from "@/lib/food/portions";
import type { Database } from "@/lib/types/db";

// F026 / AS-044 (edit a log entry's portion, recompute kcal/macros), AS-045
// (delete a log entry) -- `PATCH`/`DELETE /api/logs/[id]`, the edit/delete
// counterpart to F025's `POST /api/logs`. Same request-building shape as
// that route (and F023's `GET /api/foods/search`, F019's `POST /api/account/
// delete`) for the same reason: builds its Supabase client directly from
// `request.cookies` rather than `next/headers`'s `cookies()`, so both
// handlers are directly callable in a Vitest process with a hand-built
// `NextRequest`.
//
// Uses the SESSION-scoped client end to end -- for the food lookup
// (`foods_select_all_authenticated` RLS), the update (`logs_update_own`
// RLS), and the delete (`logs_delete_own` RLS, see
// `supabase/migrations/0004_foods_logs.sql`). RLS is what actually enforces
// "a user can only ever edit/delete their OWN log rows" -- an id that
// belongs to another user (or does not exist at all) is filtered out by RLS
// before this route code ever sees it, so both handlers respond 404 either
// way (never 403 with a "yes this exists but it's not yours" hint -- see
// `src/lib/food/portions.ts`'s `updateLogFromPortion`/`deleteLog` header
// comments for the full "denied" posture rationale).
//
// `PATCH` only ever accepts a resolved `grams` number (a common-unit
// selection is resolved to grams by the calling UI BEFORE this request is
// sent, exactly like `POST /api/logs` -- see `src/lib/food/portions.ts`'s
// `resolveUnitGrams`), then re-fetches the referenced food's CURRENT
// per-100g values and recomputes kcal/macros server-side -- never trusts a
// client-submitted macro number (money-math rule, tech-decisions.md).

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";
const MALFORMED_ID_ERROR_SR = "Neispravan identifikator unosa.";

const patchBodySchema = z.object({
  grams: z.number({ message: MALFORMED_REQUEST_ERROR_SR }),
});

const idSchema = z.string().min(1, MALFORMED_ID_ERROR_SR);

async function getSessionUserId(
  supabase: ReturnType<typeof createServerClient<Database>>
): Promise<string | null> {
  // getClaims verifies the token locally (no Auth-server round trip). These
  // handlers only need "is there a signed-in caller"; RLS (`logs_*_own`)
  // filters the target row by ownership, so the id itself isn't used here.
  return getCurrentUserId(supabase);
}

function buildSessionClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: neither handler needs to refresh/write the session
          // cookie back -- same as F025's POST /api/logs.
        },
      },
    }
  );
}

export async function PATCH(
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
  const userId = await getSessionUserId(supabase);

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

  const parsedBody = patchBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  try {
    // logs_select_own RLS: this only ever returns a row the caller owns.
    const { data: existingLog, error: logError } = await supabase
      .from("logs")
      .select("id, food_id")
      .eq("id", logId)
      .maybeSingle();

    if (logError) {
      console.error("[F026 logs/[id]] log lookup failed:", logError.message);
      return NextResponse.json(
        { ok: false, error_sr: LOG_UPDATE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!existingLog) {
      return NextResponse.json(
        { ok: false, error_sr: LOG_NOT_FOUND_ERROR_SR },
        { status: 404 }
      );
    }
    if (!existingLog.food_id) {
      return NextResponse.json(
        { ok: false, error_sr: LOG_FOOD_UNAVAILABLE_ERROR_SR },
        { status: 404 }
      );
    }

    const { data: food, error: foodError } = await supabase
      .from("foods")
      .select("id, name_sr, kcal_100g, protein_100g, carbs_100g, fat_100g")
      .eq("id", existingLog.food_id)
      .maybeSingle();

    if (foodError) {
      console.error("[F026 logs/[id]] food lookup failed:", foodError.message);
      return NextResponse.json(
        { ok: false, error_sr: LOG_UPDATE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!food) {
      return NextResponse.json(
        { ok: false, error_sr: LOG_FOOD_UNAVAILABLE_ERROR_SR },
        { status: 404 }
      );
    }

    const result = await updateLogFromPortion(supabase, {
      logId,
      food,
      grams: parsedBody.data.grams,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error_sr: result.error_sr },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error("[F026 logs/[id]] unexpected PATCH failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: LOG_UPDATE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
  const userId = await getSessionUserId(supabase);

  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  try {
    const result = await deleteLog(supabase, logId);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error_sr: result.error_sr },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, data: null }, { status: 200 });
  } catch (err) {
    console.error("[F026 logs/[id]] unexpected DELETE failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: LOG_DELETE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
