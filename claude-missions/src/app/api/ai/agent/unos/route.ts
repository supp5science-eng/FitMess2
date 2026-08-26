import { createServerClient } from "@supabase/ssr";
import { after, NextResponse, type NextRequest } from "next/server";

import {
  agentDraftConfirmSchema,
  draftFromItems,
} from "@/lib/ai/agent-draft";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { grantFullDayAward } from "@/lib/awards/grant";
import type { Database } from "@/lib/types/db";

/**
 * `POST /api/ai/agent/unos` — the confirmed half of Prizma's meal draft.
 *
 * This is the ONLY place a Prizma conversation can reach the `logs` table, and
 * it is deliberately the dullest file in the feature:
 *
 * - **No model runs here.** `/api/ai/agent` proposes, this route writes, and
 *   nothing calls both. A single endpoint that could estimate AND write would
 *   eventually write something nobody confirmed.
 * - **No allowance is charged.** The estimate was already paid for by the chat
 *   turn that produced the draft; confirming what you were shown is not a
 *   second AI action (same stance as Gric, where one user action can make two
 *   model calls and still costs one estimate).
 * - **No macro math of its own.** The rows come out of `draftFromItems` →
 *   `buildGricRows`, the same pure function that built the preview the user
 *   confirmed, so the plate on screen and the row in the database are the same
 *   numbers by construction. Row totals are the sum of the parts the SERVER
 *   computed; a client-asserted total is never stored.
 *
 * Session-bound client, built from `request.cookies` exactly like
 * `/api/logs` and `/api/ai/agent` (see the header comment on `POST /api/logs`
 * for the full rationale, including why that shape is directly testable). The
 * insert carries `user_id` because the column is NOT NULL, but what actually
 * enforces "only your own rows" is the `logs_insert_own` RLS policy in
 * `supabase/migrations/0004_foods_logs.sql` — this route never filters on
 * trust and never reaches for the service key.
 *
 * `method: 'agent'` was already in the table's CHECK constraint (0004) and in
 * `LogMethod`, waiting for exactly this; no migration is needed.
 */

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan unos. Pokušaj ponovo.";
const WRITE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.";

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never needs to refresh/write the session cookie
          // back — the page hosting the chat already keeps it fresh.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);
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

  const parsed = agentDraftConfirmSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  // The draft is rebuilt rather than trusted: the client sends back the ITEMS
  // it was given (possibly with a portion chip applied), and the occasions,
  // their names and their totals are computed here, again.
  const draft = draftFromItems(parsed.data.items);

  const rows = draft.occasions.map((row) => ({
    user_id: userId,
    food_id: null,
    name: row.name,
    grams: row.grams,
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    // The breakdown is what keeps a joined occasion editable afterwards:
    // "Dodaj još" and "Nisam sve pojeo" both work off these lines.
    components: row.components,
    method: "agent" as const,
  }));

  // One insert, not one per row: the user confirmed ONE plate (or one
  // morning), so it lands whole or not at all — a partial save would leave
  // them unsure what was recorded, which is the exact doubt confirmation
  // exists to remove.
  const { error } = await supabase.from("logs").insert(rows);
  if (error) {
    console.error("[/api/ai/agent/unos] log insert failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: WRITE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  // This may have been the day's THIRD meal, which earns the "pun dan" award.
  // After the response, like `/api/logs`: confirming a meal must never get
  // slower because it might also be a trophy, and `grantFullDayAward` swallows
  // its own failures so a missed award can never turn a saved log into an
  // error.
  after(() => grantFullDayAward(supabase, userId));

  return NextResponse.json(
    {
      ok: true,
      saved: rows.length,
      totalKcal: draft.totalKcal,
      occasions: draft.occasions,
    },
    { status: 200 }
  );
}
