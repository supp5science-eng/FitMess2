"use client";

import { useState } from "react";
import Link from "next/link";

import { BarcodeScanner } from "@/components/scan/barcode-scanner";

// F030: owns the "what happens after a successful scan" state so
// `BarcodeScanner` itself stays a pure, reusable camera/decoder component
// (per its own doc comment). Product lookup + logging from the decoded GTIN
// is F031's scope, not this feature's -- until F031 exists, a successful
// decode surfaces a real, non-blank confirmation screen showing the exact
// code that was read (proving the scan worked) with a link to manual
// search, rather than silently doing nothing or navigating away
// unexpectedly (clarified DoD: "no unintended navigation or global state
// mutation").
//
// F031 should replace the `onDetected={setDetectedCode}` wiring below with
// a handler that calls its lookup-by-barcode API/action (passing `code`),
// then either logs the found product directly or routes to a confirmation
// screen -- `BarcodeScanner`'s `onDetected` contract (a plain
// `(code: string) => void` callback) does not need to change for that.

export function ScanScreen() {
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  if (detectedCode) {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="scanner-detected"
      >
        <p className="text-sm text-muted-foreground">Prepoznat barkod:</p>
        <p
          data-testid="scanner-detected-code"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          {detectedCode}
        </p>
        <p className="text-sm text-muted-foreground">
          Automatsko pronalaženje proizvoda po barkodu uskoro stiže. Za sada,
          pretraži ručno da dodaš unos.
        </p>
        <Link
          href="/dodaj/pretraga"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Pretraži hranu
        </Link>
        <button
          type="button"
          onClick={() => setDetectedCode(null)}
          data-testid="scanner-scan-again-button"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Skeniraj ponovo
        </button>
      </main>
    );
  }

  return <BarcodeScanner onDetected={setDetectedCode} />;
}
