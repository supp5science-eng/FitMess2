import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { resolveAdminApiFromRequest } from "@/lib/auth/admin-api";
import { FOOD_UPDATE_FAILED_ERROR_SR, updateFood } from "@/lib/food/admin-foods";
import { MALFORMED_FOOD_REQUEST_ERROR_SR } from "@/lib/food/create";
import { createAdminClient } from "@/lib/supabase/server";

// F035 / AS-061: `PATCH /api/admin/foods/[id]` edits a food's content (name,
// brand, barcode, per-100g macros, common_units) via `updateFood`. Admin-only,
// server-side (AS-067); the service-role client is only built after the guard
// passes. Verification and removal/restore are their own endpoints
// (`[id]/verify`, `[id]/remove`, `[id]/restore`) -- this one never touches
// `verified`/`is_removed`.

const MALFORMED_ID_ERROR_SR = "Neispravan identifikator namirnice.";
const idSchema = z.string().min(1, MALFORMED_ID_ERROR_SR);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await resolveAdminApiFromRequest(request);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error_sr: guard.error_sr },
      { status: guard.status }
    );
  }

  const { id: rawId } = await context.params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_ID_ERROR_SR },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_FOOD_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const result = await updateFood(admin, parsedId.data, body);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error_sr: result.error_sr,
          existingFoodId: result.existingFoodId,
        },
        { status: result.status }
      );
    }
    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error("[F035 admin/foods update] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: FOOD_UPDATE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
