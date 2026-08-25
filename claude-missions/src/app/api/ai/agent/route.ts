import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AGENT_ACTIONS } from "@/lib/ai/agent-actions";
import {
  AGENT_RESPONSE_SCHEMA,
  agentModelReplySchema,
  agentRequestSchema,
  buildAgentSystemPrompt,
  type AgentFacts,
} from "@/lib/ai/agent-chat";
import { aiErrorSr, generateAgentTurn } from "@/lib/ai/gemini";
import { chargeAiEstimate } from "@/lib/ai/quota";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { getDanasProfile } from "@/lib/home/profile";
import { getTodayData } from "@/lib/home/today";
import { computeDayTotals } from "@/lib/home/totals";
import type { Database } from "@/lib/types/db";
import { getWaterWeek } from "@/lib/water/water";
import { computeWaterWeek, waterGoalMl } from "@/lib/water/water-week";

/**
 * FitMess agent (faza 2): `POST /api/ai/agent` — the AI tab's chat turn.
 *
 * The client sends the running conversation (`turns`, newest last); the
 * server recomputes today's facts from stored data (same posture as
 * `/api/plan-korekcija` and `/api/merenje/poruka`: a client-supplied number
 * is a client-supplied story), injects them into the persona prompt and asks
 * Gemini for one reply.
 *
 * Quota: each turn charges one AI estimate (`chargeAiEstimate`) — counting
 * is live, enforcement follows the global `ENFORCE_AI_LIMIT` switch, so the
 * agent inherits whatever policy the meal estimators run under.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this endpoint never needs to refresh/write the session
          // cookie; the page that hosts the chat already keeps it fresh.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: "Sesija je istekla. Prijavi se ponovo." },
      { status: 401 }
    );
  }

  let turns;
  try {
    const parsed = agentRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new Error("bad shape");
    turns = parsed.data.turns;
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: "Poruka nije stigla cela. Probaj ponovo." },
      { status: 400 }
    );
  }
  if (turns[turns.length - 1]?.role !== "user") {
    return NextResponse.json(
      { ok: false, error_sr: "Poruka nije stigla cela. Probaj ponovo." },
      { status: 400 }
    );
  }

  // One AI call per turn, charged like every other estimator surface.
  const quota = await chargeAiEstimate(supabase, userId);
  if (!quota.ok) {
    return NextResponse.json(
      { ok: false, error_sr: quota.error_sr },
      { status: 429 }
    );
  }

  // ---- Today's facts, straight from storage ------------------------------
  const now = new Date();
  const [profile, todayResult, waterResult, nameResult] = await Promise.all([
    getDanasProfile(userId),
    getTodayData(supabase, userId),
    getWaterWeek(supabase, userId, now).catch(() => null),
    // The personal register: the first name from `profiles.full_name`.
    // A failed read degrades to the impersonal tone, never to an error.
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const firstName =
    nameResult?.data?.full_name?.trim().split(/\s+/)[0] ?? null;

  const logs = todayResult.data?.logs ?? [];
  const target = todayResult.data?.target ?? null;
  const totals = computeDayTotals(logs);

  const waterGoal = waterGoalMl(profile?.weight_kg ?? null);
  let waterToday: number | null = null;
  if (waterResult) {
    const week = computeWaterWeek(waterResult.rows, now, waterGoal);
    waterToday = week.days.find((day) => day.isToday)?.ml ?? null;
  }

  const facts: AgentFacts = {
    name: firstName || null,
    day: toBelgradeCalendarDay(now),
    goal: target?.goal ?? null,
    targetKcal: target?.daily_kcal ?? null,
    targetProteinG: target?.protein_g ?? null,
    targetFatG: target?.fat_g ?? null,
    targetCarbsG: target?.carbs_g ?? null,
    eatenKcal: totals.kcal,
    eatenProteinG: totals.protein,
    eatenFatG: totals.fat,
    eatenCarbsG: totals.carbs,
    meals: logs.map((log) => ({ name: log.name, kcal: log.kcal })),
    waterMl: waterToday,
    waterGoalMl: waterGoal > 0 ? waterGoal : null,
    profile: {
      sex: profile?.sex ?? null,
      weightKg: profile?.weight_kg ?? null,
      heightCm: profile?.height_cm ?? null,
      birthYear: profile?.birth_year ?? null,
    },
  };

  try {
    const raw = await generateAgentTurn(
      buildAgentSystemPrompt(facts),
      turns,
      AGENT_RESPONSE_SCHEMA
    );
    const parsed = agentModelReplySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error("agent reply did not match the expected shape");
    }
    // Ids -> concrete cards. The catalog is the single source of hrefs; the
    // client renders titles/descriptions from i18n by id.
    const actions = parsed.data.actions.map((id) => ({
      id,
      href: AGENT_ACTIONS[id].href,
    }));
    return NextResponse.json({
      ok: true,
      reply: parsed.data.reply,
      actions,
    });
  } catch (err) {
    console.error("[/api/ai/agent] Gemini call failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error_sr: aiErrorSr(
          err,
          "Nešto je zapelo na našoj strani. Probaj ponovo za koji sekund."
        ),
      },
      { status: 502 }
    );
  }
}
