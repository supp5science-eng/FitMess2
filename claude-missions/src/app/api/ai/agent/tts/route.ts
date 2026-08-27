import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { hasElevenKey, synthesizeSpeech } from "@/lib/ai/elevenlabs";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { Database } from "@/lib/types/db";

/**
 * `POST /api/ai/agent/tts` — Prizma's reply, spoken by ElevenLabs.
 *
 * Takes the reply TEXT the client just received from `/api/ai/agent` and
 * returns an MP3. Text length is clamped to what an agent reply can
 * legitimately be (the prompt caps replies at 2-5 sentences), so this
 * endpoint cannot be borrowed as a general "read me this article" TTS box —
 * that would be someone else's audiobook on our ElevenLabs bill.
 *
 * Failures return JSON (never a broken audio body): the client's contract
 * is "not ok -> fall back to system TTS", so an expired key or a network
 * blip costs the nicer voice, never the conversation.
 */

const MAX_TTS_CHARS = 1200;

const ttsRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
});

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

  if (!hasElevenKey()) {
    return NextResponse.json(
      { ok: false, error_sr: "Glas trenutno nije dostupan." },
      { status: 503 }
    );
  }

  let text: string;
  try {
    const parsed = ttsRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new Error("bad shape");
    text = parsed.data.text;
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: "Neispravan zahtev." },
      { status: 400 }
    );
  }

  try {
    const audio = await synthesizeSpeech(text);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        // One reply = one voice; there is nothing cacheable about it.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/ai/agent/tts] synthesis failed:", err);
    return NextResponse.json(
      { ok: false, error_sr: "Glas trenutno nije dostupan." },
      { status: 502 }
    );
  }
}
