// Prizma's mouth, v0 (2026-08-26): the system's own TTS (Web Speech API).
//
// This is the bridge until ElevenLabs lands: no network, no key, works
// offline — but the voice quality is whatever the OS ships. Serbian voices
// are rare, so the pick order is sr -> hr -> bs (Croatian reads Serbian
// intelligibly; that hierarchy is the same one planned for the ElevenLabs
// test). When the device has NONE of those, Prizma stays silent rather than
// reading Serbian with an English mouth — silence is less wrong.
//
// Browser-only (speechSynthesis); never import server-side.

/** The best available ex-Yu voice, or null when the device has none. */
export function pickSerbianVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  for (const prefix of ["sr", "hr", "bs"]) {
    const matches = voices.filter((voice) =>
      voice.lang.toLowerCase().replace("_", "-").startsWith(prefix)
    );
    if (matches.length > 0) {
      // A local voice starts instantly and works offline; the OS default is
      // the one the user already knows. Both beat an arbitrary network voice.
      return (
        matches.find((voice) => voice.localService && voice.default) ??
        matches.find((voice) => voice.localService) ??
        matches.find((voice) => voice.default) ??
        matches[0]
      );
    }
  }
  return null;
}

export interface Speaker {
  /** Whether this device can speak at all (API present). A `true` here still
   * doesn't promise a Serbian voice — `speak` reports that per call. */
  supported: boolean;
  /**
   * Speak one reply aloud. Returns `true` when speech actually started
   * (a usable voice existed), `false` when it could not — the caller uses
   * that to skip the "speaking" orb state instead of animating silence.
   * Any previous utterance is cancelled first: Prizma has one mouth.
   */
  speak(
    text: string,
    callbacks?: { onStart?: () => void; onEnd?: () => void }
  ): boolean;
  /** Stop mid-sentence (leaving the screen, a new question). */
  stop(): void;
}

export function createSpeaker(): Speaker {
  const synth =
    typeof window !== "undefined" ? window.speechSynthesis : undefined;

  if (!synth) {
    return { supported: false, speak: () => false, stop: () => {} };
  }

  // Voice lists load asynchronously in most browsers: empty on first call,
  // then `voiceschanged` fires. Kick the load early so the list is warm by
  // the time the first reply wants a mouth.
  let voices = synth.getVoices();
  synth.addEventListener?.("voiceschanged", () => {
    voices = synth.getVoices();
  });

  return {
    supported: true,
    speak(text, callbacks) {
      if (voices.length === 0) voices = synth.getVoices();
      const voice = pickSerbianVoice(voices);
      if (!voice || !text.trim()) return false;

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 1.02;
      let ended = false;
      const finish = () => {
        // `end` and `error` can both fire (a cancel mid-speech); the orb
        // must leave the "speaking" state exactly once.
        if (ended) return;
        ended = true;
        callbacks?.onEnd?.();
      };
      utterance.onstart = () => callbacks?.onStart?.();
      utterance.onend = finish;
      utterance.onerror = finish;
      synth.speak(utterance);
      return true;
    },
    stop() {
      synth.cancel();
    },
  };
}
