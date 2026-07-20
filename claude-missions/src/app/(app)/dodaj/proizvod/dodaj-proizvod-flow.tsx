"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, PackageCheck } from "lucide-react";

import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { NewProductForm } from "@/components/food/new-product-form";
import { Button } from "@/components/ui/button";
import type { Food } from "@/lib/types/db";

import { estimateLabelAction } from "./actions";
import "./dodaj-proizvod-flow.css";

// "Dodaj proizvod" -- the dedicated add-a-catalog-product flow reached from the
// home "+" sheet. Product decision (2026-07-20): here you add a PACKAGED product
// that has a nutrition declaration AND a barcode, so the flow is barcode-first:
//
//   scan/upload barcode -> (does it already exist?) -> fill values -> saved ✅
//
// Every step reuses an existing, proven building block instead of forking one:
//   * `BarcodeScanner` (F030) drives the barcode step -- camera live-scan OR
//     the image-upload affordance it now also exposes (so a damaged/unscannable
//     code, or a phone with no working camera, can still add a product).
//   * `GET /api/foods/barcode/[gtin]` (F031) does an early duplicate check the
//     moment a barcode is captured, so the user isn't asked to fill the whole
//     form only to be rejected at save time -- a HIT sends them straight to the
//     existing product.
//   * `NewProductForm` (F032, extended) is the confirm/edit step: name, brand,
//     price (RSD), per-100g macros, plus an inline "fill from a photographed
//     nutrition label" prefill (`estimateLabelAction`, Gemini). Its `onCreated`
//     seam hands the saved food back here so we can show the success screen
//     instead of the portion picker.

const LOOKUP_FAILED_ERROR_SR =
  "Nismo uspeli da proverimo barkod. Pokušaj ponovo.";

const SCAN_SUBTITLE_SR =
  "Skeniraj ili otpremi barkod. Ovde dodaješ proizvode koji imaju deklaraciju i barkod.";

interface BarcodeLookupResponseBody {
  ok: boolean;
  data?: Food | null;
  error_sr?: string;
}

type Step =
  | { name: "scan" }
  | { name: "checking" }
  | { name: "exists"; food: Food }
  | { name: "form"; gtin: string }
  | { name: "success"; food: Food }
  | { name: "error" };

export function DodajProizvodFlow() {
  const [step, setStep] = useState<Step>({ name: "scan" });

  async function onDetected(gtin: string) {
    setStep({ name: "checking" });
    try {
      const response = await fetch(
        `/api/foods/barcode/${encodeURIComponent(gtin)}`
      );
      const body = (await response.json()) as BarcodeLookupResponseBody;

      if (!response.ok || !body.ok) {
        setStep({ name: "error" });
        return;
      }

      if (body.data) {
        // Already in the catalog -- don't make them re-enter it.
        setStep({ name: "exists", food: body.data });
        return;
      }

      setStep({ name: "form", gtin });
    } catch {
      setStep({ name: "error" });
    }
  }

  function restart() {
    setStep({ name: "scan" });
  }

  if (step.name === "scan") {
    return (
      <BarcodeScanner
        onDetected={onDetected}
        title="Dodaj proizvod"
        subtitle={SCAN_SUBTITLE_SR}
      />
    );
  }

  if (step.name === "checking") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="dodaj-proizvod-checking"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Proveravamo barkod…</p>
      </main>
    );
  }

  if (step.name === "error") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="dodaj-proizvod-error"
      >
        <p role="alert" className="text-sm font-medium text-destructive">
          {LOOKUP_FAILED_ERROR_SR}
        </p>
        <Button
          type="button"
          onClick={restart}
          data-testid="dodaj-proizvod-error-retry"
        >
          Pokušaj ponovo
        </Button>
      </main>
    );
  }

  if (step.name === "exists") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="dodaj-proizvod-exists"
      >
        <p className="text-sm text-foreground">
          <span className="font-medium">{step.food.name_sr}</span> već postoji u
          bazi — ne moraš ponovo da ga dodaješ.
        </p>
        <Link
          href={`/dodaj/porcija/${step.food.id}`}
          data-testid="dodaj-proizvod-open-existing"
          className="liquid-glass inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Otvori proizvod
        </Link>
        <button
          type="button"
          onClick={restart}
          data-testid="dodaj-proizvod-scan-another"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Dodaj drugi proizvod
        </button>
      </main>
    );
  }

  if (step.name === "form") {
    return (
      <main
        data-testid="dodaj-proizvod-form-step"
        className="flex flex-1 flex-col gap-6 px-6 py-8"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Novi proizvod
          </h1>
          <p className="text-sm text-muted-foreground">
            Barkod{" "}
            <span
              data-testid="dodaj-proizvod-gtin"
              className="font-medium text-foreground"
            >
              {step.gtin}
            </span>{" "}
            nije u bazi. Popuni vrednosti ili slikaj deklaraciju, pa sačuvaj.
          </p>
        </div>

        <NewProductForm
          initialBarcode={step.gtin}
          enableLabelCapture
          estimateLabel={estimateLabelAction}
          onCreated={(food) => setStep({ name: "success", food })}
        />
      </main>
    );
  }

  // step.name === "success"
  return (
    <main className="dp-success" data-testid="dodaj-proizvod-success">
      <div className="dp-success__badge">
        <svg
          className="dp-success__check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h1 className="dp-success__title">Proizvod dodat</h1>
      <p className="dp-success__subtitle">
        <span className="font-medium text-foreground">{step.food.name_sr}</span>{" "}
        je sada u bazi i dostupan svima.
      </p>

      <div className="dp-success__actions">
        <Button
          type="button"
          onClick={restart}
          data-testid="dodaj-proizvod-add-another"
          className="w-full"
        >
          <PackageCheck aria-hidden="true" />
          Dodaj još jedan
        </Button>
        <Link
          href="/danas"
          data-testid="dodaj-proizvod-done"
          className="liquid-glass inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Gotovo
        </Link>
      </div>
    </main>
  );
}
