/**
 * Builds every brand image the two stores and the native shell need, from one
 * source: the pear mark. Run by hand when the logo or the brand background
 * changes:
 *
 *   npx --yes -p sharp node scripts/gen-store-assets.cjs .
 *
 * `sharp` is deliberately NOT a project dependency — nothing at runtime needs
 * it, and everything this writes is checked in.
 *
 * What it writes into `assets/` (the folder `@capacitor/assets` reads):
 *
 *   icon-only.png        1024²  opaque brand ground + pear   → iOS AppIcon
 *   icon-foreground.png  1024²  pear on transparent, inset   → Android adaptive
 *   icon-background.png  1024²  flat brand ground            → Android adaptive
 *   splash.png           2732²  white ground + small pear    → light appearance
 *   splash-dark.png      2732²  brand ground + small pear    → dark appearance
 *
 * And into `store/` (uploaded by hand to the two consoles, never bundled):
 *
 *   play-icon-512.png    512²   Play listing icon
 *
 * And into the Android project, which `@capacitor/assets` does NOT cover:
 *
 *   res/drawable-{m,h,xh,xxh,xxxh}dpi/ic_stat_fitmess.png
 *                        24-96²  status-bar silhouette for Podsetnici
 *
 * There is no separate App Store icon file: App Store Connect reads the 1024²
 * icon out of the binary, which is `assets/icon-only.png` after `cap sync`.
 *
 * Two rules that are easy to get wrong and expensive to discover late:
 *
 * 1. **Apple rejects an app icon with an alpha channel.** The pear source is a
 *    transparent PNG, so every icon here is flattened onto a solid ground and
 *    written with `.png({ ... })` after `removeAlpha()`. Play is laxer, but a
 *    flat icon is what its adaptive mask expects anyway.
 *
 * 1b. **The splash is not the icon's colour.** The icon is always dark, but the
 *    app itself is printed on cream (`--background: #f5e9cd` in
 *    `globals.css` — one theme, no dark variant since 2026-08-24). A splash
 *    painted the icon's black would flash cream the moment the site loads, so
 *    the light splash matches `--background` exactly. The `-dark` splash is
 *    kept only because the native shells still ask for a dark-appearance
 *    asset; nothing in the web app can reach it.
 *
 * 2. **Android crops the adaptive foreground to a circle.** Only the middle
 *    ~66% of the canvas survives on a round launcher, so the foreground pear is
 *    drawn smaller than the iOS one — `ANDROID_PEAR_HEIGHT` vs `IOS_PEAR_HEIGHT`
 *    below. They are supposed to differ; equalising them clips the stem.
 *
 * 3. **The status-bar icon keeps only its ALPHA.** Since Android 5 the system
 *    throws away every colour in a notification's small icon and repaints the
 *    remaining shape in white (or the accent colour). Hand it the app icon and
 *    the whole square is opaque, so the user gets a solid white block in the
 *    status bar — the single most common "why does my notification look
 *    broken" bug. So `ic_stat_fitmess` is the pear's silhouette on transparent,
 *    and the colour it is painted white with is deliberate, not incidental.
 *
 * Source of truth for the mark is `public/icons/icon-512.png` rather than
 * `public/brand/pear-source.png`: both are raster, but the pear occupies
 * 247×410 px in the former against 174×289 px in the latter, so it carries
 * ~1.4× more real detail into the upscale.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = process.argv[2] || ".";
const SRC = path.join(root, "public/icons/icon-512.png");
const ASSETS = path.join(root, "assets");
const STORE = path.join(root, "store");
const ANDROID_RES = path.join(root, "android/app/src/main/res");

/** The app's ground colour — `--ground` in `globals.css`, `theme_color` in the
 *  manifest. The icon, the splash and the first painted pixel of the site all
 *  need to be this exact value or the launch flickers. */
const GROUND = { r: 10, g: 12, b: 11, alpha: 1 }; // #0a0c0b
/** `--background` — the cream paper the site paints first. Keep in step with
 *  `globals.css` and with `themeColor` in `src/app/layout.tsx`. */
const GROUND_LIGHT = { r: 245, g: 233, b: 205, alpha: 1 }; // #f5e9cd

/** Fraction of the icon canvas the pear's height fills. iOS shows the icon
 *  whole (rounded corners only), so it can run tall; Android's circular crop
 *  cannot. */
const IOS_PEAR_HEIGHT = 0.74;
const ANDROID_PEAR_HEIGHT = 0.62;
/** The splash pear is small on purpose: the 2732² canvas is centre-cropped to
 *  whatever the device screen is, and a big mark looks like an error dialog. */
const SPLASH_PEAR_HEIGHT = 0.16;
/** The status-bar icon is a 24dp box, and Android expects roughly 2dp of
 *  breathing room inside it — a silhouette that touches the edges reads as
 *  clipped next to the system's own icons. */
const NOTIFICATION_PEAR_HEIGHT = 0.84;
/** `ic_stat_fitmess.png` at each density, keyed by the folder it belongs in.
 *  24dp × the density multiplier (1, 1.5, 2, 3, 4). */
const NOTIFICATION_SIZES = {
  "drawable-mdpi": 24,
  "drawable-hdpi": 36,
  "drawable-xhdpi": 48,
  "drawable-xxhdpi": 72,
  "drawable-xxxhdpi": 96,
};

/** Trim the source to the pear itself, so every placement below is measured
 *  from the mark and not from whatever padding the export happened to carry. */
async function pearOnly() {
  return sharp(SRC).ensureAlpha().trim({ threshold: 8 }).toBuffer();
}

/** Pear centred on `size`² of `background`, scaled so its height is
 *  `heightFraction` of the canvas. `flatten` decides whether the result keeps
 *  an alpha channel (Android foreground) or is baked opaque (everything else). */
async function compose({ pear, size, heightFraction, background, flatten }) {
  const pearHeight = Math.round(size * heightFraction);
  const scaled = await sharp(pear)
    .resize({ height: pearHeight, kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  let canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: flatten ? background : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: scaled, gravity: "centre" }]);

  if (flatten) canvas = canvas.flatten({ background }).removeAlpha();
  return canvas.png({ compressionLevel: 9 }).toBuffer();
}

/**
 * The pear as a white silhouette on transparent — what Android's status bar
 * wants.
 *
 * Done as `dest-in` against a solid white tile rather than by recolouring the
 * pear: the source mark is black, and every "make it white" that works on the
 * COLOUR channels leaves the anti-aliased edge pixels dark. Masking a white
 * tile by the pear's alpha keeps that edge, which is the difference between a
 * clean 24px mark and a ragged one. Both layers are the full tile size, so the
 * mask covers the whole canvas and no white survives outside the pear.
 */
async function silhouette(pear, size) {
  const tile = await compose({
    pear,
    size,
    heightFraction: NOTIFICATION_PEAR_HEIGHT,
    background: null,
    flatten: false,
  });

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: tile, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(STORE, { recursive: true });

  const pear = await pearOnly();
  const meta = await sharp(pear).metadata();
  console.log(`pear source ${meta.width}×${meta.height}`);

  const write = (dir, name, buf) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, buf);
    console.log(`  ${path.relative(root, file)}  ${(buf.length / 1024).toFixed(0)} KB`);
  };

  const iconOnly = await compose({
    pear,
    size: 1024,
    heightFraction: IOS_PEAR_HEIGHT,
    background: GROUND,
    flatten: true,
  });
  write(ASSETS, "icon-only.png", iconOnly);

  write(
    ASSETS,
    "icon-foreground.png",
    await compose({
      pear,
      size: 1024,
      heightFraction: ANDROID_PEAR_HEIGHT,
      background: GROUND,
      flatten: false,
    }),
  );

  write(
    ASSETS,
    "icon-background.png",
    await sharp({ create: { width: 1024, height: 1024, channels: 3, background: GROUND } })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );

  const splashOn = (background) =>
    compose({ pear, size: 2732, heightFraction: SPLASH_PEAR_HEIGHT, background, flatten: true });
  write(ASSETS, "splash.png", await splashOn(GROUND_LIGHT));
  write(ASSETS, "splash-dark.png", await splashOn(GROUND));

  write(
    STORE,
    "play-icon-512.png",
    await sharp(iconOnly).resize(512, 512, { kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toBuffer(),
  );

  // Straight into the Android project: `@capacitor/assets` generates launcher
  // icons and splashes, and nothing else. Without these five files Firebase
  // falls back to the launcher icon, which is a filled square — see rule 3.
  for (const [folder, size] of Object.entries(NOTIFICATION_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    write(dir, "ic_stat_fitmess.png", await silhouette(pear, size));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
