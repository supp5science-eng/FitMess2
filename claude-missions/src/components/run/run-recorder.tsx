"use client";

import {
  Check,
  Compass,
  Flag,
  Footprints,
  Navigation,
  Pause,
  Play,
  Search,
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
import { loadGoogleMaps } from "@/lib/run/google-maps-loader";
import { haversineMeters } from "@/lib/run/distance";
import {
  bearingDegrees,
  distanceToGoalM,
  formatDistanceShort,
} from "@/lib/run/geo";
import {
  fetchGoalSuggestions,
  resolveGoal,
  type GoalSuggestion,
} from "@/lib/run/places-search";
import { formatDuration, formatPace } from "@/lib/run/pace";
import { computeRunSummary } from "@/lib/run/summary";
import { cn } from "@/lib/utils";

/** `distanceM` → `"5.02"` km, always two decimals (tabular). */
function km(distanceM: number): string {
  return (distanceM / 1000).toFixed(2);
}

const goalKey = (g: google.maps.LatLngLiteral): string => `${g.lat},${g.lng}`;

/** A searched destination the runner is heading toward. */
interface Goal {
  location: google.maps.LatLngLiteral;
  label: string;
}

interface RunRecorderProps {
  /** Current body weight (kg) for the live calorie readout; may be null. */
  weightKg: number | null;
}

/**
 * The `/trcanje/snimanje` recording screen — an immersive, full-viewport map
 * with floating glass controls (Strava/Nike-style): exit + compass up top,
 * search + 3D + recenter on the side, and a Kreni → live-stats flow at the
 * bottom. You can search a destination ("cilj") and the map draws the walked
 * route to it with a live distance. On Zaustavi it POSTs the trace to
 * `/api/trcanje` and routes to the run summary. On-brand teal, zero-shame.
 */
export function RunRecorder({ weightKg }: RunRecorderProps) {
  const recorder = useRunRecorder();
  const router = useRouter();
  const mapRef = useRef<RunMapHandle>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<RunPayload | null>(null);
  // The map is a vector (MapLibre) renderer, so 3D tilt + rotation always
  // work — start tilted, like the reference.
  const [is3D, setIs3D] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myLocation, setMyLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const prevLocRef = useRef<google.maps.LatLngLiteral | null>(null);

  // Destination search ("cilj") state.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plannedRoute, setPlannedRoute] = useState<
    google.maps.LatLngLiteral[] | null
  >(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const routedGoalRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow earlier keystroke's results landing after a newer one.
  const reqIdRef = useRef(0);

  const { status, points, elapsedMs } = recorder;
  const isActive = status === "recording" || status === "paused";

  const summary = useMemo(
    () => computeRunSummary(points, weightKg),
    [points, weightKg]
  );

  const goalDistanceM =
    goal && myLocation ? distanceToGoalM(myLocation, goal.location) : null;

  // Track the user's position (blue dot) and heading (facing beam) from the
  // moment the screen opens — so the map shows where you are, and which way you
  // face, before you tap Kreni. Uses the already-granted permission.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(next);
        const deviceHeading = pos.coords.heading;
        if (typeof deviceHeading === "number" && Number.isFinite(deviceHeading)) {
          // The phone's compass/course is best when moving.
          setHeading(deviceHeading);
          prevLocRef.current = next;
        } else if (prevLocRef.current) {
          // Standing still / no compass: face along the last real move.
          const moved = haversineMeters(prevLocRef.current, next);
          if (moved >= 3) {
            setHeading(bearingDegrees(prevLocRef.current, next));
            prevLocRef.current = next;
          }
        } else {
          prevLocRef.current = next;
        }
      },
      () => {
        // Ignore here — the recorder's own watch surfaces a denied state.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Once we have both a goal and a fix, draw the walked route to the cilj — but
  // only once per goal (routing on every GPS drift would hammer the API).
  useEffect(() => {
    if (!goal || !myLocation) return;
    const key = goalKey(goal.location);
    if (routedGoalRef.current === key) return;
    routedGoalRef.current = key;

    const origin = myLocation;
    const destination = goal.location;
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        const service = new google.maps.DirectionsService();
        const result = await service.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.WALKING,
        });
        const route = result.routes[0];
        if (cancelled) return;
        if (route && route.overview_path.length >= 2) {
          setPlannedRoute(
            route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }))
          );
          setRouteNote(null);
          return;
        }
        throw new Error("no route");
      } catch {
        if (cancelled) return;
        // Fall back to a straight line so the cilj still has a visible path.
        setPlannedRoute([origin, destination]);
        setRouteNote("Ne mogu da iscrtam rutu, pa je prikazana vazdušna linija.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goal, myLocation]);

  // Drop the pending autocomplete timer if the screen unmounts mid-type.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Live autocomplete: debounce keystrokes, then fetch predictions. A request
  // id drops any stale (out-of-order) response so the list always matches the
  // latest input.
  function handleQueryChange(value: string) {
    setQuery(value);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      const id = ++reqIdRef.current;
      fetchGoalSuggestions(trimmed)
        .then((found) => {
          if (id === reqIdRef.current) setSuggestions(found);
        })
        .catch(() => {
          if (id !== reqIdRef.current) return;
          setSuggestions([]);
          setSearchError(
            "Pretraga ne radi. Uključi „Places API (New)” na Maps ključu."
          );
        })
        .finally(() => {
          if (id === reqIdRef.current) setSearching(false);
        });
    }, 250);
  }

  async function selectSuggestion(suggestion: GoalSuggestion) {
    try {
      const resolved = await resolveGoal(suggestion);
      setGoal({ location: resolved.location, label: resolved.label });
      routedGoalRef.current = null;
      setPlannedRoute(null);
      setRouteNote(null);
      closeSearch();
    } catch {
      setSearchError("Ne mogu da otvorim tu lokaciju, probaj drugu.");
    }
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Enter picks the top suggestion — no free-text geocoding fallback.
    if (suggestions[0]) void selectSuggestion(suggestions[0]);
  }

  function closeSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchOpen(false);
    setSuggestions([]);
    setQuery("");
    setSearching(false);
    setSearchError(null);
  }

  function clearGoal() {
    setGoal(null);
    setPlannedRoute(null);
    setRouteNote(null);
    routedGoalRef.current = null;
  }

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
      <RunMap
        ref={mapRef}
        points={points}
        live
        fill
        myLocation={myLocation}
        heading={heading}
        goal={goal?.location ?? null}
        plannedRoute={plannedRoute}
      />

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

      {/* Goal chip: the searched cilj + live crow-flies distance to it. */}
      {goal && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ top: "calc(max(1rem, env(safe-area-inset-top)) + 3.75rem)" }}
        >
          <div className="flex max-w-[92%] items-center gap-2 rounded-full border border-white/10 bg-black/65 py-2 pl-3 pr-2 backdrop-blur-md">
            <Flag className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm text-white/90">
              {goal.label}
            </span>
            {goalDistanceM !== null && (
              <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                {formatDistanceShort(goalDistanceM)}
              </span>
            )}
            <button
              type="button"
              onClick={clearGoal}
              aria-label="Ukloni cilj"
              className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Right stack: search (cilj) + 3D toggle + recenter. */}
      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3">
        <MapFab
          label="Pretraži cilj"
          active={Boolean(goal)}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-5" aria-hidden="true" />
        </MapFab>
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

      {/* Destination search sheet — live autocomplete. */}
      {searchOpen && (
        <div
          className="absolute inset-0 z-30 flex items-end bg-black/50"
          onClick={closeSearch}
        >
          <div
            className="w-full rounded-t-3xl border-t border-border bg-card p-5"
            onClick={(event) => event.stopPropagation()}
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <h2 className="text-base font-semibold text-foreground">
              Pretraži cilj
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Kucaj i biraj iz predloga — mapa iscrta rutu do cilja.
            </p>
            <form
              onSubmit={onSearchSubmit}
              className="mt-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="npr. Ada Ciganlija, Kalemegdan…"
                autoFocus
                autoComplete="off"
                className="h-12 flex-1 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
              <button
                type="submit"
                disabled={suggestions.length === 0}
                aria-label="Izaberi prvi predlog"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Search className="size-5" aria-hidden="true" />
              </button>
            </form>

            {suggestions.length > 0 && (
              <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.placeId}>
                    <button
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left hover:bg-accent"
                    >
                      <Flag
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-foreground">
                          {suggestion.primary}
                        </span>
                        {suggestion.secondary && (
                          <span className="truncate text-xs text-muted-foreground">
                            {suggestion.secondary}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {searching && suggestions.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Tražim…</p>
            )}
            {searchError && (
              <p className="mt-3 text-sm text-muted-foreground">{searchError}</p>
            )}
          </div>
        </div>
      )}

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
            {routeNote && (
              <p className="mt-3 text-xs text-muted-foreground">{routeNote}</p>
            )}
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
