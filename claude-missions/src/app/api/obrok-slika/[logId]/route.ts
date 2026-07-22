import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import type { Database } from "@/lib/types/db";

// GET /api/obrok-slika/[logId] -- serves the stored "Slikaj obrok" display
// thumbnail for one meal log. The bytes live base64-encoded in `meal_photos`
// (own-row RLS); this handler decodes and streams them so the home meal card's
// <img> stays a plain cacheable URL and the page HTML never carries the base64.
//
// Access control is entirely RLS + "is there a signed-in user": the
// `meal_photos_select_own` policy means the query can only ever return the
// caller's OWN photo, so passing someone else's log id just yields 404.
//
// Builds the Supabase client directly from `request.cookies` (same proven shape
// as `api/foods/barcode/[gtin]`), read-only (no cookie write-back needed).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ logId: string }> }
) {
  const { logId } = await context.params;
  if (!UUID_RE.test(logId)) {
    return new NextResponse(null, { status: 400 });
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: read-only GET; middleware already refreshed the session.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }

  const { data, error } = await supabase
    .from("meal_photos")
    .select("image_base64, mime_type")
    .eq("log_id", logId)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = Buffer.from(data.image_base64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": data.mime_type || "image/jpeg",
      "Content-Length": String(bytes.length),
      // Private (per-user) and short-lived, matching the ~1-day retention.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
