"use client";

import { Footprints, Pause, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RunMap } from "@/components/run/run-map";
import {
  useRunRecorder,
  type RunPayload,
} from "@/components/run/use-run-recorder";
import { formatDuration, formatPace } from "@/lib/run/pace";
import { computeRunSummary } from "@/lib/run/summary";

/** `distanceM` → `"5.02"` km, always two decimals (tabular). */
function km(distanceM: number): string {
  return (distanceM / 1000).toFixed(2);
}

interface RunRecorderProps {
  /** Current body weight (kg) for the live calorie readout; may be null. */
  weightKg: number | null;
}

/**
 * The `/trcanje/snimanje` recording screen. Owns the live map + stopwatch via
 * `useRunRecorder`, shows the running totals (computed the same way the server
 * will re-compute them), and on Zaustavi POSTs the trace to `/api/trcanje` and
 * routes to the run summary. Zero-shame throughout — no punitive colour.
 */
export function RunRecorder({ weightKg }: RunRecorderProps) {
  const recorder = useRunRecorder();
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<RunPayload | null>(null);

  const { status, points, elapsedMs } = recorder;
  const isActive = status === "recording" || status === "paused";

  const summary = useMemo(
    () => computeRunSummary(points, weightKg),
    [points, weightKg]
  );

  async function save(payload: RunPayload) {
    setSaveError(null);
    try {
      const response = await fetch("/api/trcanje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        ok: boolean;
        id?: string;
        error_sr?: string;
      };
      if (!response.ok || !body.ok || !body.id) {
        throw new Error(body.error_sr ?? "save failed");
      }
      router.push(`/trcanje/${body.id}`);
    } catch {
      setSaveError("Nismo uspeli da sačuvamo trčanje. Pokušaj ponovo.");
    }
  }

  function handleStop() {
    const payload = recorder.finalize();
    if (!payload || payload.points.length === 0) {
      router.push("/trcanje");
      return;
    }
    setPendingPayload(payload);
    void save(payload);
  }

  if (status === "denied") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <Footprints className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">
          Treba mi pristup lokaciji
        </h1>
        <p className="max-w-[18rem] text-sm text-muted-foreground">
          Da bih crtao rutu i merio kilometražu, dozvoli pristup lokaciji u
          podešavanjima pregledača, pa pokušaj ponovo.
        </p>
        <button
          type="button"
          onClick={() => router.push("/trcanje")}
          className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Nazad na Trčanje
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-4">
      <RunMap points={points} live className="min-h-[42vh] flex-1" />

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        {/* Headline: elapsed active time. */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Vreme
          </span>
          <span className="font-mono text-5xl font-semibold tabular-nums text-foreground">
            {formatDuration(elapsedMs / 1000)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="km" value={km(summary.distanceM)} />
          <Stat label="tempo /km" value={formatPace(summary.paceSecPerKm)} />
          <Stat label="kcal" value={String(summary.calories)} />
        </div>

        {saveError && (
          <p className="text-center text-sm text-[--chart-5]">{saveError}</p>
        )}

        {/* Controls. */}
        {status === "idle" && (
          <button
            type="button"
            onClick={recorder.start}
            className="liquid-glass inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)]"
          >
            <Play className="size-6" aria-hidden="true" />
            Kreni
          </button>
        )}

        {isActive && (
          <div className="flex items-center gap-3">
            {status === "recording" ? (
              <button
                type="button"
                onClick={recorder.pause}
                className="liquid-glass inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background text-base font-semibold text-foreground"
              >
                <Pause className="size-5" aria-hidden="true" />
                Pauza
              </button>
            ) : (
              <button
                type="button"
                onClick={recorder.resume}
                className="liquid-glass inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground"
              >
                <Play className="size-5" aria-hidden="true" />
                Nastavi
              </button>
            )}
            <button
              type="button"
              onClick={handleStop}
              aria-label="Zaustavi i sačuvaj"
              className="liquid-glass inline-flex size-14 items-center justify-center rounded-full border border-border bg-background text-foreground"
            >
              <Square className="size-5 fill-current" aria-hidden="true" />
            </button>
          </div>
        )}

        {status === "saving" && !saveError && (
          <p className="text-center text-sm text-muted-foreground">Čuvam trčanje…</p>
        )}
        {status === "saving" && saveError && pendingPayload && (
          <button
            type="button"
            onClick={() => pendingPayload && save(pendingPayload)}
            className="liquid-glass inline-flex h-12 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
          >
            Pokušaj ponovo
          </button>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
