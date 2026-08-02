import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { isKnownFunnelEvent } from "@/lib/funnel/events";
import type { Database } from "@/lib/types/db";

// `POST /api/dogadjaj` — records that this user reached a named point in a flow
// (see `supabase/migrations/0028_funnel_events.sql` for why the table exists).
//
// Two properties matter more than anything else here, because this route is
// called from screens where the user is trying to do something else entirely:
//
//   1. It NEVER makes a screen fail. Every outcome that isn't a malformed
//      request is a 200, including a failed insert and including an
//      environment where 0028 has not been applied yet. The caller is
//      fire-and-forget (`src/lib/funnel/record.ts`) and ignores the body.
//   2. The (event, value) pair must be one this app actually asks about. The
//      allow-list lives in `@/lib/funnel/events` and is shared with the
//      client, so the column can never fill with labels nobody defined.
//
// Session-scoped client, so `funnel_events_insert_own` RLS is what ties the row
// to the caller -- the handler never takes a user id from the request body.

const bodySchema = z.object({
  event: z.string().min(1).max(40),
  value: z.string().min(1).max(40),
});

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never refreshes the session cookie.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);
  // Signed out is not an error worth reporting to a screen: the public
  // questionnaire runs before any account exists, and it simply is not
  // measured here.
  if (!userId) return NextResponse.json({ ok: true });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { event, value } = parsed.data;
  if (!isKnownFunnelEvent(event, value)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // `ignoreDuplicates` + the (user_id, event, value) primary key is what makes
  // this idempotent: the FIRST arrival is kept and every later one is a no-op,
  // so an effect that runs twice (React StrictMode) or a user who walks back
  // through the questionnaire cannot move the timestamp or add a row.
  const { error } = await supabase
    .from("funnel_events")
    .upsert({ user_id: userId, event, value }, { ignoreDuplicates: true });

  if (error) {
    // Includes "relation does not exist" on an environment that has not
    // applied 0028. A missing measurement must never cost the user the screen
    // they are actually on.
    console.error("[dogadjaj] insert failed:", error.message);
  }

  return NextResponse.json({ ok: true });
}
