// Plays one ElevenLabs MP3 reply and exposes its LIVE loudness, so the orb
// moves on the actual sound of Prizma's voice — measured, not simulated
// (the system-TTS path stays simulated: `speechSynthesis` offers no tap).
//
// One shared AudioContext for the whole session: iOS unlocks audio on the
// first user gesture and that unlock sticks to the context, so creating a
// fresh one per reply would re-lock the sound mid-conversation.
//
// Browser-only; never import server-side.

export interface TtsPlayback {
  /** Live output loudness 0..1 — or -1 when no analyser could be attached
   * (the orb then falls back to its composed speech envelope). */
  level: () => number;
  /** Stop mid-sentence (a new question, leaving the screen). Fires onEnd. */
  stop: () => void;
}

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;
  if (!AudioCtx) return null;
  try {
    sharedCtx = new AudioCtx();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Start playing the MP3 blob. Resolves once playback has actually started
 * (so the caller flips the orb to "speaking" only when there is sound), and
 * rejects when the browser refuses to play — the caller then falls back to
 * system TTS. `onEnd` fires exactly once, on natural end, error or stop().
 */
export async function playTtsBlob(
  blob: Blob,
  callbacks?: { onEnd?: () => void }
): Promise<TtsPlayback> {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    URL.revokeObjectURL(url);
    callbacks?.onEnd?.();
  };
  audio.onended = finish;
  audio.onerror = finish;

  // The analyser is a bonus, never a requirement: any failure here (no
  // AudioContext, a suspended context that won't resume) must still leave
  // a normally playing reply — only the live meter is lost.
  let level: () => number = () => -1;
  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (ctx.state === "suspended") void ctx.resume();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const samples = new Uint8Array(analyser.fftSize);
      level = () => {
        if (ended) return 0;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const centred = (sample - 128) / 128;
          sum += centred * centred;
        }
        // Same x4 mapping as the mic meter in record-wav.ts: speech RMS
        // lives around 0.05-0.25, this spreads it across the orb's range.
        return Math.min(1, Math.sqrt(sum / samples.length) * 4);
      };
    } catch {
      level = () => -1;
    }
  }

  try {
    await audio.play();
  } catch (err) {
    finish();
    throw err;
  }

  return {
    level,
    stop: () => {
      audio.pause();
      finish();
    },
  };
}
