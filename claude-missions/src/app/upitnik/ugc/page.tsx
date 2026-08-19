import { notFound } from "next/navigation";

import { UgcScene } from "./ugc-scene";

/**
 * Offline capture stage for the UGC screen-recording film (`scripts/ugc/`).
 *
 * NOT a product route. It renders the real onboarding surfaces -- the "kako da
 * te zovemo" name screen and the plan reveal -- against the app's real CSS,
 * tokens and fonts, but with every animation driven off a virtual clock that
 * the capture script steps frame by frame (`window.__ugc.seek(ms)`). That is
 * what makes a 24fps render deterministic: nothing here depends on wall time,
 * so frame N is byte-identical no matter how slow the renderer is.
 *
 * It lives under `/upitnik/*` on purpose: that prefix is already public
 * (`isPublicPath` in `src/lib/auth/route-protection.ts`), so the capture needs
 * no session and the auth boundary needs no exception. It is compiled out of
 * production builds -- `next build` with NODE_ENV=production 404s it unless
 * `FITMESS_UGC_CAPTURE=1` is explicitly set, which only the capture script does.
 */
export const dynamic = "force-dynamic";

export default function UgcCapturePage() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.FITMESS_UGC_CAPTURE === "1";
  if (!enabled) notFound();

  return <UgcScene />;
}
