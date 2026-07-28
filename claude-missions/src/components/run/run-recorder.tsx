"use client";

import {
  Check,
  Compass,
  Footprints,
  Navigation,
  Pause,
  Play,
  Settings,
  Square,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MapFab } from "@/components/run/map-fab";
import { RunMap, type RunMapHandle } from "@/components/run/run-map";
import {
  useRunRecorder,
  type RunPayload,
} from "@/components/run/use-run-recorder";
import { googleMapsMapId } from "@/lib/run/google-maps-loader";
import { formatDuration, formatPace } from "@/lib/run/pace";
import { computeRunSummary } from "@/lib/run/summary";
import { cn } from "@/lib/utils";

/** `distanceM` → `"5.02"` km, always two decimals (tabular). */
function km(distanceM: number): string {
  return (distanceM / 1000).toFixed(2);
}

interface RunRecorderProps {
  /** Current body weight (kg) for the live calorie readout; may be null. */
  weightKg: number | null;
}

/**
 * The `/trcanje/snimanje` recording screen — an immersive, full-viewport map
 * with floating glass controls (Strava/Nike-style): exit + compass up top, 3D +
 * recenter on the side, and a Kreni → live-stats flow at the bottom. On Zaustavi
 * it POSTs the trace to `/api/trcanje` and routes to the run summary. On-brand
 * FitMess teal, zero-shame throughout.
 */
export function RunRecorder({ weightKg }: RunRecorderProps) {
  const recorder = useRunRecorder();
  const router = useRouter();
  const mapRef = useRef<RunMapHandle>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<RunPayload | null>(null);
  // Default to 3D when a Vector map id is configured (it can actually tilt).
  const [is3D, setIs3D] = useState<boolean>(Boolean(googleMapsMapId()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myLocation, setMyLocation] =
    useState<google.maps.LatLngLiteral | null>(null);

  const { status, points, elapsedMs } = recorder;
  const isActive = status === "recording" || status === "paused";

  const summary = useMemo(
    () => computeRunSummary(points, weightKg),
    [points, weightKg]
  );

  // Track the user's position for the blue "you are here" dot from the moment
  // the screen opens — so the map shows where you are before you tap Kreni.
  // Uses the already-granted permission (no re-prompt once allowed).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Ignore here — the recorder's own watch surfaces a denied state.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  function toggle3D() {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.setTilt3D(next);
  }

  function exit() {
    router.push("/trcanje");
  }

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
      <main className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
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
          onClick={exit}
          className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Nazad na Trčanje
        </button>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <RunMap ref={mapRef} points={points} live fill myLocation={myLocation} />

      {/* Legibility scrims behind the controls. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/60 to-transparent"
      />

      {/* Top row: exit + compass. */}
      <div
        className="absolute inset-x-0 top-0 flex items-start justify-between p-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <MapFab label="Zatvori" onClick={exit}>
          <X className="size-5" aria-hidden="true" />
        </MapFab>
        <MapFab
          label="Poravnaj na sever"
          onClick={() => mapRef.current?.resetNorth()}
        >
          <Compass className="size-5" aria-hidden="true" />
        </MapFab>
      </div>

      {/* Right stack: 3D toggle + recenter. */}
      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3">
        <MapFab label="3D prikaz" active={is3D} onClick={toggle3D}>
          <span className="text-sm font-bold">3D</span>
        </MapFab>
        <MapFab
          label="Centriraj na mene"
          onClick={() => mapRef.current?.recenter()}
        >
          <Navigation className="size-5" aria-hidden="true" />
        </MapFab>
      </div>

      {/* Bottom controls. */}
      <div
        className="absolute inset-x-0 bottom-0 p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {status === "idle" && (
          <div className="flex items-end justify-between">
            {/* Activity type — running is the selected (and only) mode for now. */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative inline-flex size-14 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur-md">
                <Footprints className="size-6" aria-hidden="true" />
                <span className="absolute -right-0.5 -top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
                Trčanje
              </span>
            </div>

            <button
              type="button"
              onClick={recorder.start}
              className="liquid-glass inline-flex size-24 items-center justify-center rounded-full text-lg font-bold uppercase tracking-wide text-[#04231c] shadow-[0_12px_34px_-8px_rgba(23,209,168,0.7)]"
              style={{ backgroundImage: "linear-gradient(135deg,#2ee0bd,#0d9c7e)" }}
            >
              Kreni
            </button>

            <MapFab
              label="Podešavanja"
              caption="Opcije"
              size="md"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="size-6" aria-hidden="true" />
            </MapFab>
          </div>
        )}

        {isActive && (
          <div className="rounded-3xl border border-white/10 bg-black/70 p-5 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-white/60">
                Vreme
              </span>
              <span className="font-mono text-6xl font-semibold tabular-nums text-white">
                {formatDuration(elapsedMs / 1000)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <SheetStat value={km(summary.distanceM)} label="km" />
              <SheetStat
                value={formatPace(summary.paceSecPerKm)}
                label="tempo /km"
              />
              <SheetStat value={String(summary.calories)} label="kcal" />
            </div>
            {saveError && (
              <p className="mt-3 text-center text-sm text-white/80">
                {saveError}
              </p>
            )}
            <div className="mt-5 flex items-center gap-3">
              {status === "recording" ? (
                <button
                  type="button"
                  onClick={recorder.pause}
                  className="liquid-glass inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 text-base font-semibold text-white"
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
                className="liquid-glass inline-flex size-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"
              >
                <Square className="size-5 fill-current" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {status === "saving" && (
          <div className="rounded-3xl border border-white/10 bg-black/70 p-5 text-center backdrop-blur-xl">
            {!saveError ? (
              <p className="text-sm text-white/80">Čuvam trčanje…</p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-white/80">{saveError}</p>
                {pendingPayload && (
                  <button
                    type="button"
                    onClick={() => pendingPayload && save(pendingPayload)}
                    className="liquid-glass inline-flex h-12 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                  >
                    Pokušaj ponovo
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings sheet. */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-20 flex items-end bg-black/50"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t border-border bg-card p-5"
            onClick={(event) => event.stopPropagation()}
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <h2 className="text-base font-semibold text-foreground">
              Podešavanja
            </h2>
            <button
              type="button"
              onClick={toggle3D}
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left"
            >
              <span className="text-sm text-foreground">3D prikaz mape</span>
              <span
                className={cn(
                  "text-sm font-medium",
                  is3D ? "text-primary" : "text-muted-foreground"
                )}
              >
                {is3D ? "Uključeno" : "Isključeno"}
              </span>
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Ekran ostaje budan tokom trčanja. Jedinice: kilometri.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function SheetStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-semibold tabular-nums text-white">
        {value}
      </span>
      <span className="text-xs text-white/60">{label}</span>
    </div>
  );
}
