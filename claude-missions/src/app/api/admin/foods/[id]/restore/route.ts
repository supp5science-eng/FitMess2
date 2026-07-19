import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { resolveAdminApiFromRequest } from "@/lib/auth/admin-api";
import {
  FOOD_RESTORE_FAILED_ERROR_SR,
  restoreFood,
} from "@/lib/food/admin-review";
import { createAdminClient } from "@/lib/supabase/server";

// F035 admin restore: `POST /api/admin/foods/[id]/restore` reverses a soft
// removal (`restoreFood`), so a mistakenly-pulled food reappears in search and
// barcode lookup. Admin-only, server-side (AS-067) -- mirrors the verify/remove
// route pattern.

const MALFORMED_ID_ERROR_SR = "Neispravan identifikator namirnice.";
const idSchema = z.string().min(1, MALFORMED_ID_ERROR_SR);

export async function POST(
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

  try {
    const admin = createAdminClient();
    const result = await restoreFood(admin, parsedId.data);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error_sr: result.error_sr },
        { status: result.status }
      );
    }
    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error("[F035 admin/foods restore] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: FOOD_RESTORE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
