// Jarvis (the `/ai` tab) surface copy: the two-mode top bar (Jarvis / Chat),
// the voice-only Jarvis screen, and the composer. The conversation copy that
// predates the two-mode split still lives inline in `messages.ts` under
// `agent.*`; everything added for the redesign is namespaced `jarvis.*`.
export const jarvisMessages = {
  sr: {
    // --- Top bar -----------------------------------------------------
    "jarvis.mode.voice": "Jarvis",
    "jarvis.mode.chat": "Chat",
    "jarvis.mode.switch": "Način razgovora",
    "jarvis.settings": "Profil i podešavanja",
    "jarvis.close": "Zatvori Jarvisa",
    "jarvis.exit.hint": "Prevuci na gore da izađeš",
    "jarvis.exit.armed": "Pusti da izađeš",

    // --- Jarvis (voice-only) -----------------------------------------
    "jarvis.voice.idle": "Dodirni i pričaj",
    "jarvis.voice.idleHint": "Reci šta si jeo, ili pitaj bilo šta.",
    "jarvis.voice.listening": "Slušam te…",
    "jarvis.voice.listeningHint": "Dodirni ponovo kad završiš.",
    "jarvis.voice.transcribing": "Zapisujem…",
    "jarvis.voice.thinking": "Razmišljam…",
    "jarvis.voice.speaking": "Dodirni da je prekineš",
    "jarvis.voice.start": "Počni da pričaš",
    "jarvis.voice.stop": "Završi i pošalji",
    "jarvis.voice.interrupt": "Prekini",
    "jarvis.voice.toChat": "Vidi kao tekst",

    // --- Composer ----------------------------------------------------
    "jarvis.composer.placeholder": "Pitaj bilo šta…",
    "jarvis.composer.attach": "Dodaj fotku",
    "jarvis.composer.voice": "Reci umesto da kucaš",
    "jarvis.composer.send": "Pošalji",
    "jarvis.composer.stop": "Zaustavi",
  },
  en: {
    "jarvis.mode.voice": "Jarvis",
    "jarvis.mode.chat": "Chat",
    "jarvis.mode.switch": "Conversation mode",
    "jarvis.settings": "Profile and settings",
    "jarvis.close": "Close Jarvis",
    "jarvis.exit.hint": "Pull up to leave",
    "jarvis.exit.armed": "Release to leave",

    "jarvis.voice.idle": "Tap and talk",
    "jarvis.voice.idleHint": "Say what you ate, or ask anything.",
    "jarvis.voice.listening": "Listening…",
    "jarvis.voice.listeningHint": "Tap again when you're done.",
    "jarvis.voice.transcribing": "Writing it down…",
    "jarvis.voice.thinking": "Thinking…",
    "jarvis.voice.speaking": "Tap to interrupt",
    "jarvis.voice.start": "Start talking",
    "jarvis.voice.stop": "Finish and send",
    "jarvis.voice.interrupt": "Interrupt",
    "jarvis.voice.toChat": "See it as text",

    "jarvis.composer.placeholder": "Ask anything…",
    "jarvis.composer.attach": "Add a photo",
    "jarvis.composer.voice": "Talk instead of typing",
    "jarvis.composer.send": "Send",
    "jarvis.composer.stop": "Stop",
  },
} as const;
