import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { generateChatText } from "@/lib/ai/gemini";
import {
  acceptWeeklyMessage,
  weeklyMessageFacts,
  WEEKLY_MESSAGE_PROMPT,
} from "@/lib/ai/weekly-message";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { DAY_ANSWER_COOKIE, parseDayAnswers } from "@/lib/home/day-trust";
import type { Database } from "@/lib/types/db";
import { loadWeeklyReview } from "@/lib/weight/weekly-review";

// Nedeljno merenje: `POST /api/merenje/poruka` — the Serbian sentence that goes
// on the weekly card, written by Gemini from numbers it is not allowed to
// change.
//
// The request body is IGNORED. Every fact is recomputed here from stored data
// (`loadWeeklyReview`), for the same reason `/api/plan-korekcija` recomputes
// its suggestion: a client-supplied "measured TDEE" would be a client-supplied
// story about the user's metabolism.
//
// There is no error path visible to the user. The card renders a locally-built
// template sentence BEFORE this request is made and only swaps it out on a
// clean success, so a 429 (the free tier's daily per-model cap, which this app
// meets regularly), a timeout, or a reply that failed the number check all
// resolve to "the card keeps the sentence it already had".

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this read never needs to refresh/write the session cookie.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const dayAnswers = parseDayAnswers(
    request.cookies.get(DAY_ANSWER_COOKIE)?.value ?? null
  );

  const review = await loadWeeklyReview(supabase, userId, { dayAnswers });

  // Nothing to phrase. "We don't have enough data" is already one clear
  // sentence in the UI copy, and spending a model call to reword it would spend
  // quota on the one case with nothing to say.
  if (
    review.trend.status === "INSUFFICIENT_DATA" ||
    !review.currentTarget
  ) {
    return NextResponse.json({ ok: false }, { status: 204 });
  }

  const facts = weeklyMessageFacts(
    review.trend,
    review.currentTarget.dailyKcal,
    review.currentTarget.goal
  );

  try {
    const raw = await generateChatText(WEEKLY_MESSAGE_PROMPT, [
      { role: "user", text: JSON.stringify(facts) },
    ]);

    const text = acceptWeeklyMessage(raw, facts);

    if (!text) {
      // Either empty, too long, or it quoted a calorie number we never gave it.
      // The template on screen is already correct, so this is a non-event.
      console.warn("[merenje] AI reply rejected by the number check");
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true, data: { text } }, { status: 200 });
  } catch (err) {
    console.error("[merenje] AI message failed:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
