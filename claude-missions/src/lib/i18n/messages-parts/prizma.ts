// Prizma (the `/ai` tab) surface copy: the two-mode top bar (Jarvis / Chat),
// the voice-only Jarvis screen, and the composer. The conversation copy that
// predates the two-mode split still lives inline in `messages.ts` under
// `agent.*`; everything added for the redesign is namespaced `prizma.*`.
export const prizmaMessages = {
  sr: {
    // --- Top bar -----------------------------------------------------
    "prizma.mode.voice": "Jarvis",
    "prizma.mode.chat": "Chat",
    "prizma.mode.switch": "Način razgovora",
    "prizma.settings": "Profil i podešavanja",
    "prizma.close": "Zatvori Prizmu",

    // --- Jarvis (voice-only) -----------------------------------------
    "prizma.voice.idle": "Dodirni i pričaj",
    "prizma.voice.idleHint": "Reci šta si jeo, ili pitaj bilo šta.",
    "prizma.voice.listening": "Slušam te…",
    "prizma.voice.listeningHint": "Dodirni ponovo kad završiš.",
    "prizma.voice.transcribing": "Zapisujem…",
    "prizma.voice.thinking": "Razmišljam…",
    "prizma.voice.speaking": "Dodirni da je prekineš",
    "prizma.voice.start": "Počni da pričaš",
    "prizma.voice.stop": "Završi i pošalji",
    "prizma.voice.interrupt": "Prekini",
    "prizma.voice.toChat": "Vidi kao tekst",

    // --- Composer ----------------------------------------------------
    "prizma.composer.placeholder": "Pitaj bilo šta…",
    "prizma.composer.attach": "Dodaj fotku",
    "prizma.composer.voice": "Reci umesto da kucaš",
    "prizma.composer.send": "Pošalji",
    "prizma.composer.stop": "Zaustavi",
  },
  en: {
    "prizma.mode.voice": "Jarvis",
    "prizma.mode.chat": "Chat",
    "prizma.mode.switch": "Conversation mode",
    "prizma.settings": "Profile and settings",
    "prizma.close": "Close Prizma",

    "prizma.voice.idle": "Tap and talk",
    "prizma.voice.idleHint": "Say what you ate, or ask anything.",
    "prizma.voice.listening": "Listening…",
    "prizma.voice.listeningHint": "Tap again when you're done.",
    "prizma.voice.transcribing": "Writing it down…",
    "prizma.voice.thinking": "Thinking…",
    "prizma.voice.speaking": "Tap to interrupt",
    "prizma.voice.start": "Start talking",
    "prizma.voice.stop": "Finish and send",
    "prizma.voice.interrupt": "Interrupt",
    "prizma.voice.toChat": "See it as text",

    "prizma.composer.placeholder": "Ask anything…",
    "prizma.composer.attach": "Add a photo",
    "prizma.composer.voice": "Talk instead of typing",
    "prizma.composer.send": "Send",
    "prizma.composer.stop": "Stop",
  },
} as const;
