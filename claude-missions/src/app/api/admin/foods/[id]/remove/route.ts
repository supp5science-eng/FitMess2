import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  resolveAdminSessionForClient,
  toAdminApiResult,
} from "@/lib/auth/admin";
import { FOOD_REMOVE_FAILED_ERROR_SR, removeFood } from "@/lib/food/admin-review";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/db";

// F034 / AS-063: `POST /api/admin/foods/[id]/remove` -- soft-removes a food
// (`is_removed = true`), so it stops appearing in search
// (`public.search_foods()`, supabase/migrations/0006_foods_removal.sql) and
// barcode lookup (`src/lib/food/barcode.ts`), while any existing `logs`
// rows that snapshot it keep their data untouched. Admin-only, server-side
// -- see `.../verify/route.ts`'s header comment for the full rationale of
// this handler's shape (request-cookie-scoped client +
// `resolveAdminSessionForClient`/`toAdminApiResult`, the exact same
// composable admin-decision core `requireAdminApi()` uses, chosen here so
// this handler is directly testable from Vitest with a hand-built
// `NextRequest`).

const MALFORMED_ID_ERROR_SR = "Neispravan identifikator namirnice.";
const idSchema = z.string().min(1, MALFORMED_ID_ERROR_SR);

function buildSessionClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this mutation never needs to refresh/write the session
          // cookie back -- same as every other Route Handler in this repo.
        },
      },
    }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = buildSessionClient(request);
  const session = await resolveAdminSessionForClient(supabase);
  const guard = toAdminApiResult(session);

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
    const result = await removeFood(admin, parsedId.data);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error_sr: result.error_sr },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error("[F034 admin/foods/remove] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: FOOD_REMOVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
