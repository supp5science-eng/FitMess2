import { NextResponse, type NextRequest } from "next/server";

import { resolveAdminApiFromRequest } from "@/lib/auth/admin-api";
import { searchAllFoods } from "@/lib/food/admin-foods";
import { createAdminClient } from "@/lib/supabase/server";

// F035 (agreed addition): `GET /api/admin/foods/search?q=...` -- searches the
// WHOLE catalog (verified + unverified + removed) by name/brand/barcode, so an
// admin can find and fix (or restore) any product, not just what is in the
// review queue. Admin-only (AS-067): the service-role client is only built
// after the guard passes.

const SEARCH_FAILED_ERROR_SR =
  "Nismo uspeli da pretražimo bazu. Pokušaj ponovo.";

export async function GET(request: NextRequest) {
  const guard = await resolveAdminApiFromRequest(request);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error_sr: guard.error_sr },
      { status: guard.status }
    );
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const admin = createAdminClient();
    const { data, error } = await searchAllFoods(admin, q);
    if (error) {
      return NextResponse.json(
        { ok: false, error_sr: SEARCH_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("[F035 admin/foods/search] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: SEARCH_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
