#!/usr/bin/env node
/**
 * Renders the UGC film (`src/app/upitnik/ugc`) to a 1080x1920 24fps H.264 mp4.
 *
 * Frame-stepped, not screen-recorded: the scene exposes `window.__ugc.seek(ms)`
 * and every animated property in it is a pure function of that virtual clock,
 * so this script sets the clock to `frame / 24` seconds, waits for the paint,
 * and screenshots. The renderer can be as slow as it likes -- the output is
 * identical every run, with no dropped or unevenly spaced frames.
 *
 *   node scripts/ugc/capture.mjs [--out FILE] [--theme light|dark]
 *                                [--port 3111] [--keep-frames]
 *
 * Requires a dev server already serving the app (`npm run dev -- -p 3111`) and
 * an ffmpeg built with libx264 (`--ffmpeg PATH`, or `FFMPEG_PATH`, or the
 * `@ffmpeg-installer/ffmpeg` package if it happens to be installed).
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

// --------------------------------------------------------------------------
// Arguments
// --------------------------------------------------------------------------
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const PORT = Number(arg("port", 3111));
const THEME = arg("theme", "light");
const OUT = path.resolve(arg("out", "fitmess-ugc-plan-reveal.mp4"));
const KEEP_FRAMES = flag("keep-frames");

/** 1080x1920 = a 360x640 CSS phone at 3x, so the app lays out at the mobile
 * width it is designed for and every pixel is rendered, not upscaled. */
const CSS_WIDTH = 360;
const CSS_HEIGHT = 640;
const SCALE = 3;

/** An iPhone UA: the app's phone-only gate (`lib/device/phone-gate.ts`) sends
 * desktop clients to `/samo-za-telefon` before the page ever renders. */
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

// --------------------------------------------------------------------------
// Dependencies
// --------------------------------------------------------------------------
function resolveFfmpeg() {
  const explicit = arg("ffmpeg", process.env.FFMPEG_PATH);
  if (explicit) return explicit;
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return "ffmpeg";
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Fall back to the globally installed copy (the usual setup here).
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    return import(path.join(globalRoot, "playwright", "index.mjs"));
  }
}

// --------------------------------------------------------------------------
// Capture
// --------------------------------------------------------------------------
async function main() {
  const { chromium } = await loadPlaywright();
  const ffmpeg = resolveFfmpeg();
  const frameDir = mkdtempSync(path.join(tmpdir(), "fitmess-ugc-"));

  const browser = await chromium.launch({
    args: [
      // Keep the compositor honest while we step the clock by hand.
      "--force-color-profile=srgb",
      "--disable-lcd-text",
      "--font-render-hinting=none",
      "--hide-scrollbars",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: CSS_WIDTH, height: CSS_HEIGHT },
    deviceScaleFactor: SCALE,
    userAgent: IPHONE_UA,
    isMobile: true,
    hasTouch: true,
    locale: "sr-RS",
    timezoneId: "Europe/Belgrade",
    colorScheme: THEME === "dark" ? "dark" : "light",
    reducedMotion: "no-preference",
  });

  // The app server-renders the theme class from this cookie.
  await context.addCookies([
    { name: "fm_theme", value: THEME, url: `http://localhost:${PORT}` },
    { name: "fm_locale", value: "sr", url: `http://localhost:${PORT}` },
  ]);

  const page = await context.newPage();
  const url = `http://localhost:${PORT}/upitnik/ugc`;
  console.log(`→ ${url} (${THEME})`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(() => window.__ugc?.ready === true, null, {
    timeout: 60_000,
  });
  // Fonts must be resident before the first frame or the opening frames paint
  // in a fallback face.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const { frames, fps } = await page.evaluate(() => ({
    frames: window.__ugc.frames,
    fps: window.__ugc.fps,
  }));
  console.log(`→ ${frames} frames @ ${fps}fps`);

  for (let i = 0; i < frames; i += 1) {
    const ms = (i * 1000) / fps;
    // Two rAFs: the first lets React commit the new clock, the second lets the
    // compositor put that commit on screen before we read pixels back.
    await page.evaluate(
      (t) =>
        new Promise((resolve) => {
          window.__ugc.seek(t);
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
      ms
    );
    await page.screenshot({
      path: path.join(frameDir, `f${String(i).padStart(5, "0")}.png`),
      animations: "disabled",
    });
    if (i % 24 === 0) process.stdout.write(`\r  frame ${i}/${frames}`);
  }
  process.stdout.write(`\r  frame ${frames}/${frames}\n`);

  await browser.close();

  mkdirSync(path.dirname(OUT), { recursive: true });
  console.log("→ encoding H.264");
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-framerate", String(fps),
      "-i", path.join(frameDir, "f%05d.png"),
      "-c:v", "libx264",
      "-preset", "veryslow",
      "-crf", "16",
      "-profile:v", "high",
      "-level", "4.2",
      "-pix_fmt", "yuv420p",
      "-x264-params", "keyint=48:min-keyint=24:scenecut=0",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-colorspace", "bt709",
      "-movflags", "+faststart",
      "-r", String(fps),
      OUT,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );

  if (!KEEP_FRAMES) rmSync(frameDir, { recursive: true, force: true });
  else console.log(`  frames kept in ${frameDir}`);
  console.log(`✓ ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
