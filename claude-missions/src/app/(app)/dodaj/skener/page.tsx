import { ScanScreen } from "@/components/scan/scan-screen";

/**
 * F030 / AS-052, AS-058: `/dodaj/skener` -- the real barcode scanner screen,
 * reachable from the "+" bottom sheet's "Skeniraj barkod" option in exactly
 * 2 taps (F028's `AddSheet`, updated by this feature). `src/middleware.ts`
 * (F013) already guarantees only an authenticated, verified, onboarded user
 * reaches this route.
 *
 * No server data is needed here -- scanning is a pure client-side camera +
 * WASM-decoder interaction (`ScanScreen` / `BarcodeScanner`), so this page
 * is a thin server component wrapper only, matching the "New page/
 * components" touch scope.
 */
export default function SkenerPage() {
  return <ScanScreen />;
}
