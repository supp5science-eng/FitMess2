import type { Metadata } from "next";

import { AgentScreen } from "@/components/ai/agent-screen";
import { hasElevenKey } from "@/lib/ai/elevenlabs";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTodayData } from "@/lib/home/today";
import { computeDayTotals } from "@/lib/home/totals";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * `/ai` — Prizma's tab (Jarvis v1): nothing but the agent.
 *
 * Server Component: it exists to hand `AgentScreen` a PERSONAL opening —
 * the greeting with the user's first name (Belgrade time of day decides
 * jutro/dan/veče) and one line of live context ("ostalo ti je 650 kcal") —
 * so the idle screen already talks about THIS user before a word is typed.
 * Every read degrades gracefully: no name → plain greeting, no data → the
 * generic empty line; the screen itself never blocks on these.
 */
export const metadata: Metadata = {
  title: "Prizma",
};

export default async function AiPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  let name: string | null = null;
  let contextLine: string | null = null;

  if (userId) {
    try {
      const [nameResult, today] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle(),
        getTodayData(supabase, userId),
      ]);
      name = nameResult.data?.full_name?.trim().split(/\s+/)[0] || null;
      if (today.data) {
        const totals = computeDayTotals(today.data.logs);
        const eaten = Math.round(totals.kcal);
        const target = today.data.target?.daily_kcal ?? 0;
        const left = Math.round(target - eaten);
        contextLine =
          target > 0 && left > 0
            ? t("agent.context.remaining", { eaten, left })
            : t("agent.context.plain", { eaten });
      }
    } catch {
      // The greeting is a nicety — a failed read never costs the screen.
    }
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Belgrade",
    }).format(new Date())
  );
  const greetingWord =
    hour >= 4 && hour < 10
      ? t("agent.greeting.morning")
      : hour >= 10 && hour < 18
        ? t("agent.greeting.day")
        : t("agent.greeting.evening");
  const greeting = name ? `${greetingWord}, ${name}.` : `${greetingWord}.`;

  return (
    <AgentScreen
      greeting={greeting}
      contextLine={contextLine}
      // Whether the ElevenLabs mouth is deployed — decided server-side so
      // the client never wastes a request discovering there is no key.
      ttsAvailable={hasElevenKey()}
    />
  );
}
