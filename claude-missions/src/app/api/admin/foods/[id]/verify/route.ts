import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  resolveAdminSessionForClient,
  toAdminApiResult,
} from "@/lib/auth/admin";
import { FOOD_VERIFY_FAILED_ERROR_SR, verifyFood } from "@/lib/food/admin-review";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/db";

// F034 / AS-062: `POST /api/admin/foods/[id]/verify` -- marks a queued
// (`verified = false`) food `verified = true`. Admin-only, server-side
// (AS-067's own enforcement pattern, reused here): the caller's session is
// resolved and checked BEFORE any privileged client is ever touched.
//
// Builds its Supabase client directly from `request.cookies` (not
// `next/headers`'s `cookies()`) -- same shape every other Route Handler in
// this repo uses (`/api/foods/search`, `/api/foods/barcode/[gtin]`,
// `/api/logs/[id]`) so this handler is directly callable in a Vitest
// process with a hand-built `NextRequest`, no running Next server needed.
// `resolveAdminSessionForClient` + `toAdminApiResult` are the exact same
// composable core `src/lib/auth/admin.ts`'s `requireAdminApi()` uses
// internally -- exported separately from that function by F033
// specifically so a Route Handler that (like every other one in this repo)
// builds its own request-scoped client can still reuse the identical
// admin-decision logic without needing a real Next.js request context for
// `next/headers`.
//
// Only once `guard.ok` is true does this handler ever construct
// `createAdminClient()` (the service-role client) -- `public.foods` has no
// UPDATE RLS policy at all (0004_foods_logs.sql), so the admin client is
// the only way this mutation can succeed, and it is never reached by a
// denied caller.

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
    const result = await verifyFood(admin, parsedId.data);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error_sr: result.error_sr },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error("[F034 admin/foods/verify] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: FOOD_VERIFY_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
