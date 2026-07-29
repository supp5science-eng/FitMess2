"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Upload } from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import { useT } from "@/components/i18n/locale-provider";
import { downscaleImage } from "@/lib/image/downscale";
import { estimateLabelAction } from "./actions";

type Phase = "capture" | "reading";

// Number -> a clean string for the prefill query (drop trailing ".0").
function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function DeklaracijaFlow() {
  const { t } = useT();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(file: File) {
    setError(null);
    setPhase("reading");

    const blob = await downscaleImage(file);
    const formData = new FormData();
    formData.append("slika", blob, "deklaracija.jpg");

    const result = await estimateLabelAction(formData);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("capture");
      return;
    }

    // Hand the extracted per-100g values to the existing "novi proizvod" form
    // (confirm/edit -> create food -> portion -> log). Only pass non-empty
    // fields so the form doesn't show "0" where the label had nothing.
    const est = result.data;
    const params = new URLSearchParams({ izvor: "deklaracija" });
    if (est.naziv) params.set("naziv", est.naziv);
    if (est.brend) params.set("brend", est.brend);
    params.set("kcal", num(est.kcal_100g));
    params.set("protein", num(est.protein_100g));
    params.set("uh", num(est.uh_100g));
    params.set("mast", num(est.mast_100g));

    router.push(`/dodaj/novi-proizvod?${params.toString()}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("dodaj.label.title")}
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("dodaj.cancel")}
        </Link>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handlePhoto(file);
          event.target.value = "";
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        data-testid="deklaracija-upload-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handlePhoto(file);
          event.target.value = "";
        }}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {phase === "capture" ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center transition-colors hover:bg-muted"
          >
            <Camera className="size-9 text-primary" aria-hidden="true" />
            <span className="text-base font-medium text-foreground">
              {t("dodaj.label.captureTitle")}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("dodaj.label.captureHint")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            data-testid="deklaracija-upload-button"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <Upload className="size-4" aria-hidden="true" />
            {t("dodaj.label.uploadFromGallery")}
          </button>
        </div>
      ) : (
        <AiThinking
          title={t("dodaj.label.reading.title")}
          lines={[
            t("dodaj.label.reading.line1"),
            t("dodaj.label.reading.line2"),
            t("dodaj.almostDone"),
          ]}
        />
      )}
    </main>
  );
}
