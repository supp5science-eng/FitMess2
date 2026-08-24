import { describe, expect, it } from "vitest";

import {
  buildClonePrompt,
  checkPhotoCount,
  CLONE_PROMPT_VERSION,
  MAX_CLONE_PHOTOS,
  MIN_CLONE_PHOTOS,
} from "@/lib/avatar/clone-prompt";

/**
 * The klon's one invariant: THE TEMPLATE IS THE SAME FOR EVERYONE.
 *
 * Every outfit template drawn later assumes a body drawn to the same framing,
 * so a prompt that quietly varies per user breaks a feature that does not exist
 * yet and is expensive to discover. These tests hold the shape of that promise:
 * the only thing the prompt may say differently from one user to the next is
 * how many photos came in.
 */
describe("clone prompt", () => {
  it("differs between two users only in the photo count", () => {
    const five = buildClonePrompt(5).replace("5 fotografija", "N fotografija");
    const twenty = buildClonePrompt(20).replace("20 fotografija", "N fotografija");
    expect(five).toBe(twenty);
  });

  it("tells the model how many photos it is looking at", () => {
    expect(buildClonePrompt(7)).toContain("7 fotografija");
  });

  it("states the fixed framing the outfit templates will be drawn against", () => {
    const prompt = buildClonePrompt(MIN_CLONE_PHOTOS);
    expect(prompt).toContain("Cela figura");
    expect(prompt).toContain("Frontalno");
    expect(prompt).toContain("3:4");
  });

  it("forbids taking anything but identity from the photos", () => {
    const prompt = buildClonePrompt(MIN_CLONE_PHOTOS);
    // The clothes/background/pose ban is what keeps two klons comparable.
    expect(prompt).toContain("Odeću, pozadinu, osvetljenje, pozu");
  });

  it("carries a version, so a rewrite can find the klons drawn by the old one", () => {
    expect(CLONE_PROMPT_VERSION).toMatch(/^v\d+$/);
  });
});

describe("checkPhotoCount", () => {
  it("accepts the whole allowed range", () => {
    expect(checkPhotoCount(MIN_CLONE_PHOTOS).ok).toBe(true);
    expect(checkPhotoCount(MAX_CLONE_PHOTOS).ok).toBe(true);
    expect(checkPhotoCount(12).ok).toBe(true);
  });

  it("rejects below the floor and says how many are missing", () => {
    const verdict = checkPhotoCount(2);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error_sr).toContain("još 3");
  });

  it("rejects above the ceiling and says how many to drop", () => {
    const verdict = checkPhotoCount(MAX_CLONE_PHOTOS + 4);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error_sr).toContain("Izbaci 4");
  });

  it("rejects an empty pick", () => {
    expect(checkPhotoCount(0).ok).toBe(false);
  });
});
