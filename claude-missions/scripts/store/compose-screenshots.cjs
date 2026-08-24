/**
 * Turns the raw captures from `capture-screens.cjs` into the framed images the
 * two stores accept, at their exact required pixel sizes.
 *
 *   set NODE_PATH=C:\FitMess2\fitmesslaunchvideo\launch-video\node_modules
 *   node scripts/store/compose-screenshots.cjs
 *
 * Why a browser and not an image library: the headline is set in Archivo Black
 * and DM Sans, the same two faces the app uses. Compositing text with `sharp`
 * would mean shipping font files and hand-rolling line breaking; rendering the
 * frame as a page gives real type, real shadows and a real gradient for free.
 *
 * Sizes are not suggestions. App Store Connect rejects a 6.9" screenshot that
 * is one pixel off 1320×2868, and Play requires a 9:16 phone screenshot — hence
 * two separate canvases rather than one image scaled twice.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const RAW = path.resolve(arg("raw", path.join("store", "raw")));
const OUT = path.resolve(arg("out", path.join("store", "screenshots")));

/**
 * The listing's story, in order. `id` matches a file in the raw folder.
 *
 * The headlines follow the app's own voice: they state what you see, they do
 * not instruct or grade. "Ceo dan na jednom ekranu" — not "Prati svoj dan!".
 */
const SLIDES = [
  // Order matters: only the first image survives into the search thumbnail, so
  // it carries the one thing the app is for — a photo turning into a number.
  {
    id: "obrok",
    title: "Slikaj obrok.\nBroj sam stiže.",
    sub: "Naziv, gramaža i makroi — pa proveriš.",
  },
  {
    id: "pocetna-pun-dan",
    title: "Ceo dan\nna jednom ekranu.",
    sub: "Koliko ti je ostalo — i od čega.",
  },
  {
    id: "dodaj-meni",
    title: "Pet načina\nda upišeš obrok.",
    sub: "Od jedne slike do jedne rečenice.",
  },
  {
    id: "gric",
    title: "Grickao si nešto?\nSamo reci.",
    sub: "Bez slikanja, bez merenja, bez pretrage.",
  },
  {
    id: "mikronutrijenti",
    title: "Ne samo kalorije.",
    sub: "Vlakna, šećer, so i zasićene masti.",
  },
  {
    id: "analitika",
    title: "Nedelja,\nne jedan dan.",
    sub: "Jedan loš obrok ne ruši nedelju.",
  },
];

/** One entry per store canvas. Both must be exact — see the header. */
const TARGETS = [
  // `phoneFill` is the share of the canvas height the device takes, which is
  // what actually controls the composition — the width follows from the
  // screenshot's own aspect ratio, so a re-capture at a different device size
  // cannot silently start cropping.
  { name: "appstore-6.9", width: 1320, height: 2868, phoneFill: 0.78, titleSize: 86, subSize: 42 },
  { name: "play-phone", width: 1080, height: 1920, phoneFill: 0.74, titleSize: 62, subSize: 31 },
  // iPad. The app is declared for tablets (`TARGETED_DEVICE_FAMILY = "1,2"`),
  // and Apple then refuses the submission without a 13" set. The canvas is far
  // squarer than a phone's, so `phoneFill` drops: at 0.78 the device would run
  // into the headline. The mock stays a phone on purpose — every screen is laid
  // out for one, and showing a stretched tablet would promise a layout that
  // does not exist.
  {
    name: "appstore-ipad-13",
    width: 2048,
    height: 2732,
    phoneFill: 0.68,
    titleSize: 104,
    subSize: 50,
  },
];

function page({ target, slide, imageDataUri, imageWidth, imageHeight }) {
  const phoneHeight = Math.round(target.height * target.phoneFill);
  const phoneWidth = Math.round((phoneHeight * imageWidth) / imageHeight);
  const overhang = Math.round(phoneHeight * 0.045);
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${target.width}px; height: ${target.height}px;
    background: #0a0c0b;
    display: flex; flex-direction: column; align-items: center;
    overflow: hidden;
    /* A single soft pearl glow behind the phone — the same greens and blues as
       the mark, kept far below the text so nothing competes with the headline. */
    background-image:
      radial-gradient(120% 60% at 50% 78%, rgba(69,199,141,0.20) 0%, rgba(10,12,11,0) 62%),
      radial-gradient(90% 45% at 18% 22%, rgba(64,140,190,0.16) 0%, rgba(10,12,11,0) 60%);
  }
  /* The headline owns whatever the device leaves over and sits centred in it,
     so a one-line title and a two-line title both look deliberate. */
  .head {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 0 ${Math.round(target.width * 0.085)}px; text-align: center;
  }
  h1 {
    font-family: "Archivo Black", system-ui, sans-serif;
    font-size: ${target.titleSize}px; line-height: 1.06; color: #ffffff;
    letter-spacing: -0.01em; white-space: pre-line;
  }
  p {
    font-family: "DM Sans", system-ui, sans-serif;
    font-size: ${target.subSize}px; line-height: 1.35; color: rgba(255,255,255,0.62);
    margin-top: ${Math.round(target.titleSize * 0.42)}px;
  }
  .phone {
    flex: none;
    width: ${phoneWidth}px; height: ${phoneHeight}px;
    /* Runs off the bottom edge on purpose — the device reads as a device
       standing in the frame, not a rectangle floating in the middle of it. */
    margin-bottom: -${overhang}px;
    border-radius: ${Math.round(phoneWidth * 0.085)}px;
    border: ${Math.max(2, Math.round(phoneWidth * 0.004))}px solid rgba(255,255,255,0.14);
    overflow: hidden;
    box-shadow: 0 ${Math.round(phoneWidth * 0.05)}px ${Math.round(phoneWidth * 0.12)}px rgba(0,0,0,0.55);
  }
  /* fill, not cover: the box is built from this image's own aspect ratio,
     so there is nothing to crop and nothing to letterbox. */
  .phone img { display: block; width: 100%; height: 100%; object-fit: fill; }
</style></head>
<body>
  <div class="head">
    <h1>${slide.title}</h1>
    ${slide.sub ? `<p>${slide.sub}</p>` : ""}
  </div>
  <div class="phone"><img src="${imageDataUri}" alt=""></div>
</body></html>`;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });

  for (const target of TARGETS) {
    const dir = path.join(OUT, target.name);
    fs.mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      deviceScaleFactor: 1,
    });
    const tab = await context.newPage();

    let index = 0;
    for (const slide of SLIDES) {
      const raw = path.join(RAW, `${slide.id}.png`);
      if (!fs.existsSync(raw)) {
        console.warn(`  skip ${target.name}/${slide.id} — no raw capture`);
        continue;
      }
      index += 1;
      const bytes = fs.readFileSync(raw);
      const dataUri = `data:image/png;base64,${bytes.toString("base64")}`;
      await tab.setContent(
        page({
          target,
          slide,
          imageDataUri: dataUri,
          // PNG IHDR: width and height are the two big-endian u32 at byte 16.
          imageWidth: bytes.readUInt32BE(16),
          imageHeight: bytes.readUInt32BE(20),
        }),
        { waitUntil: "load" },
      );
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(200);
      const file = path.join(dir, `${String(index).padStart(2, "0")}-${slide.id}.png`);
      await tab.screenshot({ path: file });
      console.log("  wrote", path.relative(process.cwd(), file));
    }
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
