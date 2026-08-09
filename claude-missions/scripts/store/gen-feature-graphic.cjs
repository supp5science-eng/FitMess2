/**
 * The Play listing's feature graphic — 1024×500, mandatory, and the banner that
 * sits above the screenshots on the store page.
 *
 *   set NODE_PATH=C:\FitMess2\fitmesslaunchvideo\launch-video\node_modules
 *   node scripts/store/gen-feature-graphic.cjs
 *
 * Rendered in a browser rather than composited, for the same reason as
 * `compose-screenshots.cjs`: it needs Archivo Black, and it needs "Mess" to
 * carry the pearl gradient the wordmark always carries — a `background-clip`
 * trick no image library does for free.
 *
 * The gradient stops are copied from `--wordmark-grad` (dark theme) in
 * `src/app/globals.css`. If that ever changes, change it here too; there is no
 * way to import a CSS custom property into a standalone page.
 *
 * Play crops this graphic on some surfaces, so nothing that matters may sit in
 * the outer eighth of the canvas.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const WIDTH = 1024;
const HEIGHT = 500;
const OUT = path.resolve("store", "play-feature-graphic.png");
const MARK = path.resolve("public", "icons", "icon-512.png");

const html = (markDataUri) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    background: #0a0c0b;
    background-image:
      radial-gradient(70% 120% at 78% 50%, rgba(69,199,141,0.22) 0%, rgba(10,12,11,0) 65%),
      radial-gradient(60% 100% at 12% 30%, rgba(64,140,190,0.18) 0%, rgba(10,12,11,0) 62%);
    display: flex; align-items: center; gap: 44px;
    padding: 0 96px;
  }
  .mark { width: 168px; height: 168px; flex: none; }
  .mark img { width: 100%; height: 100%; object-fit: contain; }
  .word {
    font-family: "Archivo Black", system-ui, sans-serif;
    font-size: 92px; line-height: 1; color: #ffffff; letter-spacing: -0.015em;
  }
  /* "Mess" is never flat — same pearl sweep as the in-app wordmark. */
  .mess {
    background-image: linear-gradient(112deg, #26ddb6 0%, #35d3cc 22%, #ecc766 40%, #57a8ee 62%, #40d98c 83%, #63dd76 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
  }
  .tag {
    font-family: "DM Sans", system-ui, sans-serif;
    font-size: 34px; line-height: 1.3; color: rgba(255,255,255,0.66);
    margin-top: 18px;
  }
</style></head>
<body>
  <div class="mark"><img src="${markDataUri}" alt=""></div>
  <div>
    <div class="word">Fit<span class="mess">Mess</span></div>
    <div class="tag">Slikaj obrok — kalorije stižu same.</div>
  </div>
</body></html>`;

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const tab = await context.newPage();
  const markDataUri = `data:image/png;base64,${fs.readFileSync(MARK).toString("base64")}`;
  await tab.setContent(html(markDataUri), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await tab.screenshot({ path: OUT });
  console.log("wrote", path.relative(process.cwd(), OUT));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
