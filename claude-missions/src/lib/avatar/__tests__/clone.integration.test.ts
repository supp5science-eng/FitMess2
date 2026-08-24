// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { generateAvatarClone, type InlineImage } from "@/lib/ai/gemini";
import { buildClonePrompt, MIN_CLONE_PHOTOS } from "@/lib/avatar/clone-prompt";

/**
 * The klon, against the real image model. Not a unit test -- a way to LOOK at
 * what the prompt in `clone-prompt.ts` actually draws, which is the only thing
 * that can settle whether the art direction is right.
 *
 * Two things must be present or the whole file skips (the degrade-gracefully
 * pattern the other `*.integration.test.ts` files use -- a missing key must
 * never permanently red every future `npm run test`):
 *
 *   1. `GEMINI_API_KEY` in `.env` at the repo root.
 *   2. A folder of your own photos at `klon-proba/` (repo root, gitignored).
 *      Drop 5-20 jpg/png files in it. They are read, sent, and never written
 *      anywhere.
 *
 * The drawing lands at `klon-proba/klon.png`. Open it. If the framing or the
 * style is off, the fix is the constant in `clone-prompt.ts`, and this test is
 * how you see the next attempt.
 */

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const PHOTO_DIR = path.join(ROOT, "klon-proba");
const OUT_FILE = path.join(PHOTO_DIR, "klon.png");

function loadDotEnvIfPresent(): void {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvIfPresent();

function readPhotos(): InlineImage[] {
  if (!fs.existsSync(PHOTO_DIR)) return [];
  return fs
    .readdirSync(PHOTO_DIR)
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
    // The previous run's output is in the same folder -- feeding a klon back
    // in as a source photo would quietly average the drawing into the next one.
    .filter((name) => name !== path.basename(OUT_FILE))
    .sort()
    .map((name) => ({
      base64: fs.readFileSync(path.join(PHOTO_DIR, name)).toString("base64"),
      mimeType: name.toLowerCase().endsWith(".png")
        ? "image/png"
        : name.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg",
    }));
}

const hasKey = Boolean(process.env.GEMINI_API_KEY);
const photos = hasKey ? readPhotos() : [];
const hasPhotos = photos.length >= MIN_CLONE_PHOTOS;

if (!hasKey) {
  console.warn(
    "[klon] SKIP: no GEMINI_API_KEY in .env -- nothing to draw with."
  );
} else if (!hasPhotos) {
  console.warn(
    `[klon] SKIP: put at least ${MIN_CLONE_PHOTOS} photos in ${PHOTO_DIR} (found ${photos.length}).`
  );
}

describe.skipIf(!hasKey || !hasPhotos)("klon against the live image model", () => {
  it(
    "draws one character from the photos and writes it to klon-proba/klon.png",
    async () => {
      const image = await generateAvatarClone(
        photos,
        buildClonePrompt(photos.length)
      );

      expect(image.base64.length).toBeGreaterThan(1000);
      expect(image.mimeType).toMatch(/^image\//);

      fs.writeFileSync(OUT_FILE, Buffer.from(image.base64, "base64"));
      console.info(
        `[klon] ${photos.length} photos -> ${OUT_FILE} (${Math.round(image.base64.length / 1365)} KB, ${image.mimeType})`
      );
    },
    // Drawing runs far past vitest's 15s ceiling; matches IMAGE_TIMEOUT_MS in
    // `gemini.ts` with room for the round trip.
    200_000
  );
});
