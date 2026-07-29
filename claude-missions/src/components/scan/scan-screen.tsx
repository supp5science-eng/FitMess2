"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { PortionPicker } from "@/components/food/portion-picker";
import { useT } from "@/components/i18n/locale-provider";
import type { Food } from "@/lib/types/db";

// F031 / AS-053 (a found barcode shows the food + portion picker), AS-054
// (confirming a portion after a scan creates a log with method='barcode') --
// `ScanScreen` now owns the full scan -> lookup -> portion -> log flow.
// `BarcodeScanner` (F030) only ever emits the decoded GTIN via its
// `onDetected` callback -- this file is the ONLY thing that changed to wire
// that emission to a real product lookup + the reused F025 portion picker
// (see F030's handoff "Notes for the next worker" section for the exact
// contract this fulfils; `BarcodeScanner` itself is untouched).
//
// On a HIT (`GET /api/foods/barcode/[gtin]` returns a food): renders the
// F025 `PortionPicker` UNMODIFIED in its data flow (still `POST /api/logs`)
// pre-loaded with the found food, passing `method="barcode"` so the
// persisted row is distinguishable from a search-originated entry
// (AS-054).
//
// On a MISS (no `foods` row has this barcode -- a normal 200 with
// `data: null`, per the clarified "sensible empty response with 200"
// answer, NOT an error): routes to `/dodaj/novi-proizvod?barkod=<gtin>`,
// the first-time-entry flow F032 builds the real form for. The GTIN is
// passed along in the query string (not a bare redirect) specifically so
// F032 can pre-fill it -- see that route's own placeholder page for how it
// reads this.
//
// On a genuine lookup FAILURE (network error / 401 / 500): a real Serbian
// error with a retry affordance that goes back to a live scan -- never a
// blank/broken screen, never silently treated as "not found."

interface BarcodeLookupResponseBody {
  ok: boolean;
  data?: Food | null;
  error_sr?: string;
}

type LookupState =
  | { status: "scanning" }
  | { status: "loading" }
  | { status: "found"; food: Food }
  | { status: "error" };

export function ScanScreen() {
  const { t } = useT();
  const router = useRouter();
  const [state, setState] = useState<LookupState>({ status: "scanning" });

  async function onDetected(gtin: string) {
    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/foods/barcode/${encodeURIComponent(gtin)}`
      );
      const body = (await response.json()) as BarcodeLookupResponseBody;

      if (!response.ok || !body.ok) {
        setState({ status: "error" });
        return;
      }

      if (body.data) {
        setState({ status: "found", food: body.data });
        return;
      }

      // MISS: hand the scanned GTIN off to F032's first-time-entry flow --
      // never a silent no-op, never a broken 404.
      router.push(`/dodaj/novi-proizvod?barkod=${encodeURIComponent(gtin)}`);
    } catch {
      setState({ status: "error" });
    }
  }

  if (state.status === "found") {
    return <PortionPicker food={state.food} method="barcode" />;
  }

  if (state.status === "loading") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="scanner-lookup-loading"
      >
        <p className="text-sm text-muted-foreground">
          {t("media.scanLookup.checking")}
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="scanner-lookup-error"
      >
        <p role="alert" className="text-sm font-medium text-destructive">
          {t("media.scanLookup.failed")}
        </p>
        <button
          type="button"
          data-testid="scanner-lookup-retry-button"
          onClick={() => setState({ status: "scanning" })}
          className="liquid-glass inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)]"
        >
          {t("media.scanLookup.retry")}
        </button>
        <Link
          href="/dodaj/pretraga"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("media.scanLookup.searchFood")}
        </Link>
      </main>
    );
  }

  return <BarcodeScanner onDetected={onDetected} />;
}
