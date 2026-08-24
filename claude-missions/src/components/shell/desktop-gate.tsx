import { Archivo_Black, DM_Sans } from "next/font/google";
import QRCode from "qrcode";

import { getT } from "@/lib/i18n/server";

/**
 * The desktop / non-phone experience for FitMess.
 *
 * FitMess is intentionally a phone-only app. The middleware redirects every
 * non-mobile visitor to the phone-only gate route, which renders THIS
 * component. The one and only call to action is "open it on your phone", via
 * a QR code of the production URL.
 *
 * Type system (testbed for a site-wide rollout): Archivo Black for display /
 * headings, DM Sans for body copy. Both are scoped to the gate for now.
 */

const PRODUCTION_URL = "https://fitmess.app/";

// Display / headings — heavy, punchy.
const display = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});
// Body — clean, highly legible, minimalist.
const body = DM_Sans({ subsets: ["latin", "latin-ext"], display: "swap" });

export async function DesktopGate() {
  const { t } = await getT();
  const qrSvg = await QRCode.toString(PRODUCTION_URL, {
    type: "svg",
    margin: 0,
    width: 200,
    // Ink on paper, like everything else -- 12:1 contrast, well inside
    // what a scanner needs.
    color: { dark: "#1c1b8f", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return (
    <main
      className={`${body.className} fm-halftone relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-6 py-12`}
      style={{
        // The app's paper, with a faint wash of the brand ink over it.
        backgroundColor: "color-mix(in oklab, var(--brand) 4%, var(--paper))",
        // The stipple comes from `.fm-halftone` on the class list below, so
        // this gate is screened at the same pitch as the app itself rather
        // than at a second, hand-rolled one.
      }}
    >
      {/* Soft blurred brand-accent glows for depth (decorative). */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{
          backgroundColor: "color-mix(in oklab, var(--brand) 40%, transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full blur-3xl"
        style={{
          backgroundColor: "color-mix(in oklab, var(--brand) 30%, transparent)",
        }}
      />

      <div className="relative w-full max-w-md rounded-4xl bg-white p-8 text-center shadow-2xl ring-1 ring-black/5 sm:p-10">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/fitmess-icon.png" alt="" width={34} height={34} />
          <span className={`${display.className} text-2xl text-neutral-900`}>
            {/* Same accent as every other lockup in the app -- this was the
                one screen still painting "Mess" in flat brand teal. The card
                is a white surface, so `:root`'s (light) gradient applies. */}
            Fit<span className="fm-wordmark-accent">Mess</span>
          </span>
        </div>

        <h1
          className={`${display.className} text-balance text-2xl leading-tight text-neutral-900 sm:text-3xl`}
        >
          {t("app.desktop.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-base leading-relaxed text-neutral-500">
          {t("app.desktop.body")}
        </p>

        {/* QR */}
        <div className="mt-8 flex justify-center">
          <div
            className="rounded-3xl border border-neutral-200 bg-white p-5"
            aria-label={t("app.desktop.qrAria", { url: PRODUCTION_URL })}
            role="img"
            // qrcode returns a trusted, self-generated SVG string (no user input).
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        <p className="mt-6 text-sm text-neutral-500">
          {t("app.desktop.openInBrowser")}
        </p>
        <p className="mt-1 break-all text-sm font-semibold text-primary">
          fitmess.app
        </p>
      </div>
    </main>
  );
}
