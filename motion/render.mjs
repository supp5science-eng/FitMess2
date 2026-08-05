#!/usr/bin/env node
/**
 * Renderuje scenu iz motion/scenes/*.html u 9:16 mp4 (1080x1920).
 *
 * Scena mora da izloži `window.SCENE = { width, height, fps, duration }` i
 * `window.render(t)` — svaki frejm je čista funkcija vremena, pa je render
 * deterministički (nema CSS animacija koje bi klizile između screenshot-ova).
 *
 *   node motion/render.mjs deficit-9x16
 *   node motion/render.mjs deficit-9x16 --fps 60 --scale 2
 *   node motion/render.mjs tokovi-9x16 --mblur 4      # pravi motion blur
 *
 * --mblur N renderuje N pod-frejmova po izlaznom frejmu i stapa ih (ffmpeg
 * tmix), pa brzi elementi dobiju stvarno razmazivanje umesto laznog smera.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith('--')) ?? 'deficit-9x16';
const flag = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : Number(argv[i + 1]);
};

const scene = path.join(HERE, 'scenes', `${name}.html`);
const framesDir = path.join(HERE, '.frames', name);
const outDir = path.join(HERE, 'out');
const outFile = path.join(outDir, `${name}.mp4`);

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(scene).href);
await page.evaluate(() => document.fonts.ready);

const S = await page.evaluate(() => window.SCENE);
const fps = flag('fps', S.fps);
const scale = flag('scale', 2);
const mblur = Math.max(1, Math.round(flag('mblur', S.mblur ?? 1)));
const total = Math.round(S.duration * fps) * mblur;   // pod-frejmovi kad je mblur > 1
const shotFps = fps * mblur;

await page.setViewportSize({ width: S.width, height: S.height });
await page.emulateMedia({ reducedMotion: 'reduce' });
const ctx = page.context();
await ctx.close();

// Nov kontekst sa deviceScaleFactor -> screenshot je već 1080x1920.
const context = await browser.newContext({
  viewport: { width: S.width, height: S.height },
  deviceScaleFactor: scale,
});
const p2 = await context.newPage();
await p2.goto(pathToFileURL(scene).href);
await p2.evaluate(() => document.fonts.ready);

process.stdout.write(
  `render ${name}: ${total} frejmova @ ${fps}fps` +
  (mblur > 1 ? ` (x${mblur} pod-frejmova, motion blur)` : '') +
  `, ${S.width * scale}x${S.height * scale}\n`);
for (let i = 0; i < total; i++) {
  const t = i / shotFps;
  await p2.evaluate((tt) => window.render(tt), t);
  await p2.screenshot({
    path: path.join(framesDir, `f${String(i).padStart(5, '0')}.png`),
    animations: 'disabled',
  });
  if (i % 30 === 0) process.stdout.write(`  ${i}/${total}\n`);
}
await browser.close();

const files = (await readdir(framesDir)).length;
if (files !== total) throw new Error(`ocekivano ${total} frejmova, ima ${files}`);

await new Promise((resolve, reject) => {
  const ff = spawn('ffmpeg', [
    '-y',
    '-framerate', String(shotFps),
    '-i', path.join(framesDir, 'f%05d.png'),
    ...(mblur > 1 ? ['-vf', `tmix=frames=${mblur}:weights='${Array(mblur).fill(1).join(' ')}',fps=${fps}`] : []),
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outFile,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  ff.on('error', reject);
  ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
});

await rm(framesDir, { recursive: true, force: true });
process.stdout.write(`gotovo -> ${path.relative(process.cwd(), outFile)}\n`);
