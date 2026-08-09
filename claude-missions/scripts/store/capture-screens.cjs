/**
 * Takes raw screenshots of the running app, logged in as the demo account.
 * These are the *ingredients* — `scripts/store/compose-screenshots.cjs` turns
 * them into the framed images the two stores want.
 *
 * Playwright is not a dependency of this project (nothing at runtime needs a
 * browser), so it is borrowed from the launch-video workspace:
 *
 *   set NODE_PATH=C:\FitMess2\fitmesslaunchvideo\launch-video\node_modules
 *   node scripts/store/capture-screens.cjs --theme=light
 *
 * Flags: --url=<origin> (default https://fitmess.app), --theme=light|dark,
 *        --out=<dir> (default store/raw/<theme>).
 *
 * Three things this has to work around, all learned the hard way:
 *
 * 1. **The desktop gate.** `src/lib/device/is-mobile.ts` reads the User-Agent
 *    and sends anything that is not a phone to `/samo-za-telefon`. The context
 *    below therefore carries a real iPhone UA and `isMobile`.
 * 2. **The install overlay** covers the whole screen on a fresh visit and will
 *    happily become your screenshot. Killing it via localStorage is unreliable
 *    (tried, three ways). Instead we let it appear, dismiss it, and rely on its
 *    own 30-minute cooldown for every page after that.
 * 3. **`chromium.launch()` cannot find its bundled browser** on this machine and
 *    `npx playwright install` never finishes — `channel: "chrome"` uses the
 *    system Chrome and just works.
 * 4. **The service worker undoes the User-Agent override.** `public/sw.js`
 *    handles navigations network-first by re-issuing `fetch(request)` from the
 *    worker, and Playwright's context-level UA override does not reach a
 *    service-worker target. So the first page loads fine, the worker claims the
 *    client, and every navigation after that arrives at the middleware wearing
 *    a desktop UA and comes back as `/samo-za-telefon`. Setting the UA as a
 *    browser launch flag fixes it, because then it is the browser's real UA and
 *    there is nothing left to override.
 */
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ORIGIN = arg("url", "https://fitmess.app");
const THEME = arg("theme", "light");
const OUT = path.resolve(arg("out", path.join("store", "raw", THEME)));

const DEMO = {
  email: "supp5science+fitmess-demo@gmail.com",
  password: "DemoZaVideo!2026",
};

/**
 * One entry per raw screenshot. `prepare` runs after the page settles and is
 * where anything that is not a plain navigation happens — opening a sheet,
 * paging the home pager sideways.
 */
const SCREENS = [
  { id: "pocetna", url: "/danas" },
  // A day the demo account actually ate on. `?dan=` is a real product feature
  // (tap any day in the strip), so this is not a staged screen — it is what the
  // app shows for that date.
  { id: "pocetna-pun-dan", url: "/danas?dan=2026-08-02" },
  {
    // Page three of the home pager (kalorije → koraci/voda → kvalitet), which
    // exists only as a horizontal scroll offset, on a day that has food in it.
    id: "mikronutrijenti",
    url: "/danas?dan=2026-08-02",
    async prepare(page) {
      await page.evaluate(() => {
        const pager = document.querySelector('[data-testid="intake-pager"]');
        if (!pager) return;
        pager.scrollTo({ left: pager.clientWidth * 2, behavior: "instant" });
        pager.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(800);
    },
  },
  { id: "analitika", url: "/analitika" },
  { id: "gric", url: "/dodaj/gric" },
  {
    // The single most convincing screen in the listing: a photo turned into
    // numbers. A headless Chrome has no camera, and the screen says so in a
    // banner ("Nema pristupa kameri") — useless for a store. So we take the
    // upload path instead, which is the same flow with the same result screen,
    // and feed it the meal photo already used on the landing page.
    //
    // This spends one real Gemini call. That is the point: the numbers in the
    // screenshot are the model's actual output, not a mock-up.
    id: "obrok",
    url: "/dodaj/obrok",
    async prepare(page) {
      await page
        .locator('input[type="file"]:not([capture])')
        .setInputFiles(path.join("public", "landing", "obrok.jpg"));
      await page.getByText(/kcal/i).first().waitFor({ timeout: 90000 });
      await page.waitForTimeout(1500);
    },
  },
  { id: "podesavanja", url: "/profil" },
  {
    id: "dodaj-meni",
    url: "/danas",
    async prepare(page) {
      const plus = page.getByRole("button", { name: /dodaj|^\+$/i }).last();
      await plus.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    },
  },
];

async function dismissInstallOverlay(page) {
  // Give the nudge its five seconds to appear, then use its own button so it
  // records that it was shown and stays quiet for the next half hour.
  await page.waitForTimeout(5500);
  const keepGoing = page.getByRole("button", { name: /nastavi u pregleda/i });
  if (await keepGoing.isVisible().catch(() => false)) {
    await keepGoing.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const iphone = devices["iPhone 14 Pro"];
  const browser = await chromium.launch({
    channel: "chrome",
    // Not a duplicate of the context option below — see note 4 in the header.
    args: [`--user-agent=${iphone.userAgent}`],
  });
  const context = await browser.newContext({
    ...iphone,
    // Playwright's iPhone preset subtracts Safari's chrome, giving a 393×659
    // viewport. A store screenshot has to show the whole screen, so the height
    // is forced back to the device's real 852 points.
    viewport: { width: 393, height: 852 },
    // 3× so the capture lands at 1179×2556 — enough pixels to scale into
    // Apple's 1320-wide canvas without softening.
    deviceScaleFactor: 3,
    locale: "sr-RS",
    timezoneId: "Europe/Belgrade",
  });
  await context.addCookies([
    { name: "fm_theme", value: THEME, url: ORIGIN },
  ]);
  // The dev overlay is not part of the product.
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal, #__next-build-watcher { display: none !important; }";
    document.documentElement.appendChild(style);
  });

  const page = await context.newPage();

  await page.goto(`${ORIGIN}/prijava`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(DEMO.email);
  await page.locator('input[type="password"]').fill(DEMO.password);
  await page.getByRole("button", { name: /prijavi se/i }).click();
  await page.waitForURL(/\/(danas|onboarding|telefon)/, { timeout: 45000 });
  console.log("logged in ->", page.url());

  await dismissInstallOverlay(page);

  const only = arg("only", "");
  const wanted = only ? only.split(",") : null;

  for (const screen of SCREENS) {
    if (wanted && !wanted.includes(screen.id)) continue;
    try {
      await page.goto(`${ORIGIN}${screen.url}`, { waitUntil: "networkidle", timeout: 45000 });
      // Two states that are real product behaviour but must never end up in a
      // listing: the cold Vercel→Supabase connection ("Nismo uspeli da učitamo
      // tvoj dan") and the service worker's offline fallback, which also shows
      // up for a few seconds while a deploy swaps the build out. Both clear on
      // a reload.
      const wrongScreen = /nismo uspeli da u|nema veze sa internetom/i;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!(await page.getByText(wrongScreen).isVisible().catch(() => false))) break;
        await page.waitForTimeout(3000);
        await page.reload({ waitUntil: "networkidle" }).catch(() => {});
      }
      await page.waitForTimeout(1200);
      if (screen.prepare) await screen.prepare(page);
      const file = path.join(OUT, `${screen.id}.png`);
      await page.screenshot({ path: file });
      console.log("  captured", path.relative(process.cwd(), file));
    } catch (err) {
      console.warn(`  FAILED ${screen.id}: ${err.message.split("\n")[0]}`);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
