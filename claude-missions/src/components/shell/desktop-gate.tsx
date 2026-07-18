import { Archivo_Black, DM_Sans } from "next/font/google";
import QRCode from "qrcode";

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

const PRODUCTION_URL = "https://adaptive-cut-companion.vercel.app/";

// Display / headings — heavy, punchy.
const display = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});
// Body — clean, highly legible, minimalist.
const body = DM_Sans({ subsets: ["latin", "latin-ext"], display: "swap" });

export async function DesktopGate() {
  const qrSvg = await QRCode.toString(PRODUCTION_URL, {
    type: "svg",
    margin: 0,
    width: 200,
    color: { dark: "#0a0a0a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return (
    <main
      className={`${body.className} relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-6 py-12`}
      style={{
        backgroundColor: "#f5faf6",
        // Fine dot-grid pattern in a faint brand green.
        backgroundImage:
          "radial-gradient(rgba(22,163,74,0.12) 1px, transparent 1.4px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Soft blurred brand-green glows for depth (decorative). */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-green-400/30 blur-3xl" />

      <div className="relative w-full max-w-md rounded-4xl bg-white p-8 text-center shadow-2xl ring-1 ring-black/5 sm:p-10">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/fitmess-icon.png" alt="" width={34} height={34} />
          <span className={`${display.className} text-2xl text-neutral-900`}>
            Fit<span className="text-primary">Mess</span>
          </span>
        </div>

        <h1
          className={`${display.className} text-balance text-2xl leading-tight text-neutral-900 sm:text-3xl`}
        >
          FitMess radi samo na telefonu.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-base leading-relaxed text-neutral-500">
          Napravljen je isključivo za mobilnu upotrebu. Skeniraj QR kod kamerom
          telefona i kreni.
        </p>

        {/* QR */}
        <div className="mt-8 flex justify-center">
          <div
            className="rounded-3xl border border-neutral-200 bg-white p-5"
            aria-label={`QR kod za ${PRODUCTION_URL}`}
            role="img"
            // qrcode returns a trusted, self-generated SVG string (no user input).
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        <p className="mt-6 text-sm text-neutral-500">
          Ili u pregledaču na telefonu otvori:
        </p>
        <p className="mt-1 break-all text-sm font-semibold text-primary">
          adaptive-cut-companion.vercel.app
        </p>
      </div>
    </main>
  );
}
