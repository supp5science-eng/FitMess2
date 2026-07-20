"use server";

import { z } from "zod";

import { generateChatText, type ChatTurn } from "@/lib/ai/gemini";
import { buildLofiSnapshot, buildLofiSystemPrompt } from "@/lib/ai/lofi";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTodayData } from "@/lib/home/today";
import { createClient } from "@/lib/supabase/server";

// M6 (Lofi agent): the chat turn-taking action. The client owns the running
// conversation and sends the whole history here; we rebuild Lofi's LIVE daily
// budget on every turn (so advice always reflects what the user has actually
// eaten so far today, even after logging elsewhere), prepend the persona as a
// system instruction, and return Lofi's next reply. The Gemini key stays
// server-side; anonymous callers never reach the paid API.

// Keep only the tail of a long conversation (persona + recent turns is plenty
// of context, and caps the request size / cost). Each message is length-capped.
const MAX_TURNS = 24;
const MAX_MESSAGE_CHARS = 2000;

const turnSchema = z.object({
  role: z.enum(["user", "lofi"]),
  text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

const historySchema = z.array(turnSchema).min(1).max(60);

export type LofiTurnInput = z.input<typeof turnSchema>;

export type AskLofiResult =
  | { ok: true; reply: string }
  | { ok: false; error_sr: string };

export async function askLofiAction(
  history: LofiTurnInput[]
): Promise<AskLofiResult> {
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) {
    return { ok: false, error_sr: "Poruka nije stigla kako treba. Pokušaj ponovo." };
  }

  const turns = parsed.data;
  if (turns[turns.length - 1]!.role !== "user") {
    return { ok: false, error_sr: "Napiši poruku pa je pošalji." };
  }

  // Auth-gate before touching the paid chat API.
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  // Live daily budget + the user's name (so Lofi's advice fits the real day).
  const [today, profileResult] = await Promise.all([
    getTodayData(supabase, userId),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const snapshot = buildLofiSnapshot(
    today.data?.target ?? null,
    today.data?.logs ?? []
  );
  const systemPrompt = buildLofiSystemPrompt(
    snapshot,
    profileResult.data?.full_name ?? null
  );

  const chatTurns: ChatTurn[] = turns
    .slice(-MAX_TURNS)
    .map((turn) => ({
      role: turn.role === "lofi" ? "model" : "user",
      text: turn.text,
    }));

  try {
    const reply = await generateChatText(systemPrompt, chatTurns);
    return { ok: true, reply };
  } catch (err) {
    console.error("[Lofi] chat failed:", err);
    return {
      ok: false,
      error_sr: "Lofi trenutno ne može da odgovori. Pokušaj ponovo za koji tren.",
    };
  }
}
