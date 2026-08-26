import { describe, expect, it } from "vitest";

import { pickSerbianVoice } from "@/lib/audio/speak";

function voice(
  lang: string,
  overrides: Partial<SpeechSynthesisVoice> = {}
): SpeechSynthesisVoice {
  return {
    lang,
    name: overrides.name ?? lang,
    default: overrides.default ?? false,
    localService: overrides.localService ?? false,
    voiceURI: overrides.name ?? lang,
  } as SpeechSynthesisVoice;
}

describe("pickSerbianVoice", () => {
  it("prefers Serbian over Croatian over Bosnian, whatever the order", () => {
    const voices = [voice("bs-BA"), voice("hr-HR"), voice("sr-RS")];
    expect(pickSerbianVoice(voices)?.lang).toBe("sr-RS");
    expect(pickSerbianVoice([voice("bs-BA"), voice("hr-HR")])?.lang).toBe(
      "hr-HR"
    );
    expect(pickSerbianVoice([voice("bs-BA")])?.lang).toBe("bs-BA");
  });

  it("matches underscore locales and mixed case (sr_Latn, SR-rs)", () => {
    expect(pickSerbianVoice([voice("sr_Latn")])?.lang).toBe("sr_Latn");
    expect(pickSerbianVoice([voice("SR-rs")])?.lang).toBe("SR-rs");
  });

  it("within a language prefers a local voice, then the default one", () => {
    const remote = voice("sr-RS", { name: "remote" });
    const local = voice("sr-RS", { name: "local", localService: true });
    const fallbackDefault = voice("sr-RS", { name: "default", default: true });
    expect(pickSerbianVoice([remote, fallbackDefault, local])?.name).toBe(
      "local"
    );
    expect(pickSerbianVoice([remote, fallbackDefault])?.name).toBe("default");
  });

  it("returns null rather than an English mouth", () => {
    expect(pickSerbianVoice([voice("en-US"), voice("de-DE")])).toBeNull();
    expect(pickSerbianVoice([])).toBeNull();
  });
});
