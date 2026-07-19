import { NextResponse, type NextRequest } from "next/server";

import { resolveAdminApiFromRequest } from "@/lib/auth/admin-api";
import { createVerifiedFood } from "@/lib/food/admin-foods";
import {
  FOOD_CREATE_FAILED_ERROR_SR,
  MALFORMED_FOOD_REQUEST_ERROR_SR,
} from "@/lib/food/create";
import { createAdminClient } from "@/lib/supabase/server";

// F035 / AS-061 + PRD Addendum 1 (admin manual seeding): `POST /api/admin/foods`
// creates an admin-entered food, marked verified=true / source='seed'
// (`createVerifiedFood`). Admin-only, server-side (AS-067): the session is
// resolved and checked BEFORE `createAdminClient()` is ever touched -- there is
// no INSERT-verified RLS path, so the service-role client is the only way this
// write can land, and a denied caller never reaches it.

export async function POST(request: NextRequest) {
  const guard = await resolveAdminApiFromRequest(request);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error_sr: guard.error_sr },
      { status: guard.status }
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
    const result = await createVerifiedFood(admin, body);
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
    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (err) {
    console.error("[F035 admin/foods create] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: FOOD_CREATE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
