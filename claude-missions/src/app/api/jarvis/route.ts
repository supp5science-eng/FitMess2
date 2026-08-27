import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  buildJarvisSystemPrompt,
  hasJarvisKey,
  jarvisTurn,
  type JarvisPoruka,
} from "@/lib/ai/jarvis";
import { chargeAiEstimate } from "@/lib/ai/quota";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClientFromRequest } from "@/lib/supabase/from-request";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { getDanasProfile } from "@/lib/home/profile";
import { getTodayData } from "@/lib/home/today";
import { computeDayTotals } from "@/lib/home/totals";
import { getWaterWeek } from "@/lib/water/water";
import { computeWaterWeek, waterGoalMl } from "@/lib/water/water-week";

/**
 * `POST /api/jarvis` — one turn of the native app's assistant.
 *
 * The native counterpart of `/api/ai/agent`, and different from it in exactly
 * two ways:
 *
 *   - It authenticates from an `Authorization: Bearer` header rather than
 *     cookies (`createClientFromRequest`), because a phone has no cookie jar.
 *   - It answers with a TOOL CALL rather than a navigational action id. The
 *     AI tab points at the screen where the user can do the thing; Jarvis does
 *     the thing.
 *
 * WHY THE PHONE SENDS ITS OWN TOOL LIST. An OTA update can add a tool to the
 * app while an older install still lacks it. Hardcoding the list here would
 * have the model calling something that phone cannot run. The app declares
 * what it can do; this route tells the model only that.
 *
 * WHY THE CONVERSATION IS NOT STORED HERE. It lives on the phone
 * (`fitmess-app/src/jarvis/mozak.ts`), so this route is stateless: it can
 * deploy or restart mid-conversation without dropping anyone.
 *
 * ⚠️ THE FACTS ARE RECOMPUTED, NEVER READ FROM THE BODY. Same posture as
 * `/api/ai/agent` and `/api/plan-korekcija`: a client-supplied number is a
 * client-supplied story. The phone sends words and tool results; every figure
 * in the prompt comes from storage.
 */

const SESSION_EXPIRED_ERROR_SR = "Sesija je istekla. Prijavi se ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const BRAIN_MISSING_ERROR_SR = "Jarvis trenutno nije dostupan.";
const TURN_FAILED_ERROR_SR = "Nešto mi je zapelo. Probaj ponovo.";

/** Mirrors `JarvisPoruka` on the phone. Validated rather than trusted: this
 *  body is forwarded into a paid model call. */
const porukaSchema = z.union([
  z.object({ uloga: z.literal("korisnik"), tekst: z.string().min(1).max(4000) }),
  z.object({
    uloga: z.literal("jarvis"),
    tekst: z.string().max(8000),
    poziv: z
      .object({
        id: z.string().min(1).max(200),
        ime: z.string().min(1).max(100),
        argumenti: z.record(z.string(), z.unknown()),
      })
      .optional(),
  }),
  z.object({
    uloga: z.literal("alat"),
    id: z.string().min(1).max(200),
    rezultat: z.object({ zaModel: z.string().max(8000) }),
  }),
]);

const bodySchema = z.object({
  // Capped so a runaway client cannot hand the model an unbounded history.
  poruke: z.array(porukaSchema).min(1).max(60),
  alati: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(2000),
        input_schema: z.looseObject({ type: z.literal("object") }),
      })
    )
    .max(60),
});

export async function POST(request: NextRequest) {
  const supabase = createClientFromRequest(request);

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  if (!hasJarvisKey()) {
    // No Gemini fallback here on purpose: Gemini has no tool-calling path in
    // this codebase, and an assistant that can only talk would answer as if it
    // had done things it cannot do.
    return NextResponse.json(
      { ok: false, error_sr: BRAIN_MISSING_ERROR_SR },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  // One AI call per turn, charged like every other estimator surface.
  //
  // ⚠️ A single spoken sentence can cost SEVERAL turns ("popio sam čašu i
  // pojeo jabuku" is two tools and then a reply), so a voice conversation
  // burns quota far faster than the AI tab does. That is a pricing decision,
  // not a code one — see the cost note in `docs/nativna-aplikacija.md`.
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
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
  ]);

  const logs = todayResult.data?.logs ?? [];
  const totals = computeDayTotals(logs);
  const goal = waterGoalMl(profile?.weight_kg ?? null);

  let vodaMl: number | null = null;
  if (waterResult) {
    const week = computeWaterWeek(waterResult.rows, now, goal);
    vodaMl = week.days.find((day) => day.isToday)?.ml ?? null;
  }

  const systemPrompt = buildJarvisSystemPrompt({
    ime: nameResult?.data?.full_name?.trim().split(/\s+/)[0] || null,
    dan: toBelgradeCalendarDay(now),
    ciljKcal: todayResult.data?.target?.daily_kcal ?? null,
    pojedenoKcal: totals.kcal,
    obroci: logs.map((log) => ({ naziv: log.name, kcal: log.kcal })),
    vodaMl,
    vodaCiljMl: goal > 0 ? goal : null,
  });

  try {
    const odgovor = await jarvisTurn(
      systemPrompt,
      parsed.data.poruke as JarvisPoruka[],
      parsed.data.alati
    );
    return NextResponse.json({ ok: true, ...odgovor });
  } catch {
    // Refusals, rate limits and network failures all land here. The phone
    // shows this sentence; nothing about the model reaches the user.
    return NextResponse.json(
      { ok: false, error_sr: TURN_FAILED_ERROR_SR },
      { status: 502 }
    );
  }
}
