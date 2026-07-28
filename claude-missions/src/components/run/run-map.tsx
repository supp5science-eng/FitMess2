"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./run-map.css";

import { MapPin } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MlMap,
  Marker as MlMarker,
  StyleSpecification,
} from "maplibre-gl";

import { cn } from "@/lib/utils";
import type { RunRoutePoint } from "@/lib/types/db";

/** Teal accent (matches `--primary` in globals.css) for the route + markers. */
const ROUTE_COLOR = "#17d1a8";
/** The indigo ground — also the canvas backdrop while tiles stream in. */
const GROUND_COLOR = "#232842";
/** Fallback centre when there are no fixes yet — central Belgrade. */
const DEFAULT_CENTER: [number, number] = [20.4633, 44.8176];
/** Camera pitch (degrees) for the 3D perspective. */
const TILT_3D = 55;

/** Free, key-less OpenStreetMap vector tiles (OpenFreeMap public instance). */
const OFM_TILES = "https://tiles.openfreemap.org/planet";
const OFM_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const toLngLat = (p: { lat: number; lng: number }): [number, number] => [
  p.lng,
  p.lat,
];
const goalKey = (g: { lat: number; lng: number }): string => `${g.lat},${g.lng}`;

/**
 * A calm, clutter-free running style we own entirely in code, drawn on free
 * OpenFreeMap vector tiles. Deep-indigo ground, muted lavender roads, quiet
 * parks, dim water — no cafés/shops. The names people orient by stay on: main
 * streets (motorway → secondary) and neighbourhood/place labels. Buildings are
 * extruded for the 3D perspective. Because it is a vector style, tilt and
 * two-finger rotation work.
 */
function mapStyle(): StyleSpecification {
  const style = {
    version: 8,
    glyphs: OFM_GLYPHS,
    sources: {
      ofm: {
        type: "vector",
        url: OFM_TILES,
        attribution: "© OpenStreetMap",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": GROUND_COLOR } },
      {
        id: "water",
        type: "fill",
        source: "ofm",
        "source-layer": "water",
        paint: { "fill-color": "#151b33" },
      },
      {
        id: "park",
        type: "fill",
        source: "ofm",
        "source-layer": "park",
        paint: { "fill-color": "#2c4a3e", "fill-opacity": 0.7 },
      },
      {
        id: "landcover-green",
        type: "fill",
        source: "ofm",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "park"]]],
        paint: { "fill-color": "#2a4238", "fill-opacity": 0.5 },
      },
      {
        id: "road-minor",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["minor", "service", "track", "path"]],
        ],
        paint: {
          "line-color": "#333a63",
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 18, 4],
        },
      },
      {
        id: "road-arterial",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["tertiary", "secondary", "primary"]],
        ],
        paint: {
          "line-color": "#434d7d",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 18, 8],
        },
      },
      {
        id: "road-highway",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk"]],
        ],
        paint: {
          "line-color": "#4d5891",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 18, 12],
        },
      },
      {
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "ofm",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#2f3660",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.85,
        },
      },
      {
        id: "road-label",
        type: "symbol",
        source: "ofm",
        "source-layer": "transportation_name",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary", "secondary"]],
        ],
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#c3c8ea",
          "text-halo-color": "#171b30",
          "text-halo-width": 1.4,
        },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["city", "town", "suburb", "neighbourhood", "quarter"]],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 16, 15],
        },
        paint: {
          "text-color": "#aeb4dd",
          "text-halo-color": "#171b30",
          "text-halo-width": 1.6,
        },
      },
    ],
  };
  return style as unknown as StyleSpecification;
}

function meElement(): { el: HTMLDivElement; beam: HTMLDivElement } {
  const el = document.createElement("div");
  el.className = "fm-me";
  const beam = document.createElement("div");
  beam.className = "fm-beam";
  beam.style.display = "none";
  const dot = document.createElement("div");
  dot.className = "fm-dot";
  el.append(beam, dot);
  return { el, beam };
}

function goalElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "fm-goal";
  const dot = document.createElement("div");
  dot.className = "fm-goal-dot";
  el.append(dot);
  return el;
}

function pinElement(color: string, ring: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "fm-pin";
  const dot = document.createElement("div");
  dot.className = "fm-pin-dot";
  dot.style.background = color;
  dot.style.boxShadow = `0 0 0 2px ${ring}`;
  el.append(dot);
  return el;
}

function lineData(
  coords: [number, number][]
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {},
  };
}

/** Imperative controls the floating map FABs drive. */
export interface RunMapHandle {
  /** Pan back to the latest fix (re-follow after the user panned away). */
  recenter: () => void;
  /** Tilt into the 3D perspective (on) or flatten to top-down (off). */
  setTilt3D: (on: boolean) => void;
  /** Rotate the map back to north-up. */
  resetNorth: () => void;
}

interface RunMapProps {
  /** The route so far (recording) or the whole run (detail). */
  points: readonly RunRoutePoint[];
  /** Recording mode: follow the last fix instead of framing the whole route. */
  live?: boolean;
  /** Immersive: fill the parent edge-to-edge (no card border/rounding). */
  fill?: boolean;
  /** The user's current position — the blue "you are here" dot. */
  myLocation?: { lat: number; lng: number } | null;
  /** Live heading (deg clockwise from north) for the facing beam; `null` hides it. */
  heading?: number | null;
  /** A searched destination — drawn as the "cilj" target. */
  goal?: { lat: number; lng: number } | null;
  /** The walked route to `goal`, drawn as a faint teal underlay. */
  plannedRoute?: readonly { lat: number; lng: number }[] | null;
  className?: string;
}

/**
 * Draws a run's GPS route on a MapLibre GL vector map (free OpenFreeMap tiles).
 * In `live` mode it follows the latest fix (recording screen); otherwise it
 * frames the whole route (run detail). With `fill` it becomes the immersive
 * full-viewport map behind the recorder's floating controls.
 *
 * A vector renderer, so the 3D tilt button and two-finger rotate/tilt gestures
 * all work — no Google Cloud Map ID needed. A searched `goal` adds a target
 * marker plus its walked `plannedRoute`, and `heading` fans a facing beam out of
 * the location dot. Degrades to a calm placeholder if the map can't load.
 */
export const RunMap = forwardRef<RunMapHandle, RunMapProps>(function RunMap(
  {
    points,
    live = false,
    fill = false,
    myLocation = null,
    heading = null,
    goal = null,
    plannedRoute = null,
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const meRef = useRef<MlMarker | null>(null);
  const beamElRef = useRef<HTMLDivElement | null>(null);
  const centeredOnMe = useRef(false);
  const goalRef = useRef<MlMarker | null>(null);
  const startRef = useRef<MlMarker | null>(null);
  const endRef = useRef<MlMarker | null>(null);
  const framedGoalRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  );
  const [reason, setReason] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      const last = points[points.length - 1];
      const target = last ? toLngLat(last) : myLocation ? toLngLat(myLocation) : null;
      if (mapRef.current && target) mapRef.current.panTo(target);
    },
    setTilt3D: (on: boolean) => {
      mapRef.current?.easeTo({ pitch: on ? TILT_3D : 0, duration: 400 });
    },
    resetNorth: () => {
      mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 });
    },
  }));

  // One-time map init. `live`/`fill` are read once at mount, so intentionally
  // not dependencies.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const gl = await import("maplibre-gl");
        if (cancelled || !containerRef.current || mapRef.current) return;
        const first = points[0];
        const m = new gl.Map({
          container: containerRef.current,
          style: mapStyle(),
          center: first ? toLngLat(first) : DEFAULT_CENTER,
          zoom: live ? 16.5 : 15,
          pitch: live ? TILT_3D : 0,
          bearing: 0,
          attributionControl: false,
          maxPitch: 70,
        });
        map = m;
        mapRef.current = m;
        m.addControl(
          new gl.AttributionControl({
            compact: true,
            customAttribution: "© OpenStreetMap",
          }),
          "bottom-right"
        );

        // The route layers live beneath the labels; they start empty and fill
        // in as GPS fixes (or a planned route) arrive. Guarded so they are
        // only ever added once, whichever activation path fires first.
        const addRouteLayers = () => {
          if (!mapRef.current) return;
          if (!m.getSource("route-planned")) {
            m.addSource("route-planned", { type: "geojson", data: lineData([]) });
          }
          if (!m.getSource("route-actual")) {
            m.addSource("route-actual", { type: "geojson", data: lineData([]) });
          }
          if (!m.getLayer("route-planned")) {
            m.addLayer({
              id: "route-planned",
              type: "line",
              source: "route-planned",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": ROUTE_COLOR,
                "line-opacity": 0.45,
                "line-width": 7,
              },
            });
          }
          if (!m.getLayer("route-actual")) {
            m.addLayer({
              id: "route-actual",
              type: "line",
              source: "route-actual",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": ROUTE_COLOR, "line-width": 5 },
            });
          }
        };

        // Flip to "ready" as soon as the map is usable — and crucially, do NOT
        // gate this on the full `load` event. `load` only fires once *every*
        // tile source has finished loading, so a slow or unreachable tile host
        // (the free OpenFreeMap instance) would otherwise strand the map on the
        // "Učitavam mapu…" spinner forever, with no route, markers or location
        // dot. `style.load` fires the moment the (inline) style is parsed —
        // even when the tiles never arrive — so the map is usable regardless,
        // rendering the run trace and markers over the base colour.
        let activated = false;
        const activate = () => {
          if (cancelled || activated || !mapRef.current) return;
          activated = true;
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = null;
          }
          if (m.isStyleLoaded()) addRouteLayers();
          else m.once("style.load", addRouteLayers);
          setStatus("ready");
        };

        m.on("load", activate);
        m.on("style.load", activate);
        // Safety net: the map must never block recording. If neither event has
        // fired in time (e.g. tiles hang the initial load), show it anyway.
        watchdog = setTimeout(activate, 6000);

        m.on("error", (event) => {
          // Per-tile/font errors are non-fatal — the map still renders geometry.
          if (!cancelled) {
            console.warn("Run map:", event.error?.message ?? event);
          }
        });
      } catch (error: unknown) {
        if (cancelled) return;
        setStatus("unavailable");
        setReason(
          error instanceof Error ? error.message : "Greška pri učitavanju mape."
        );
      }
    })();

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw the actual route + start/finish markers whenever the points change.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;

    const path = points.map(toLngLat);
    (map.getSource("route-actual") as GeoJSONSource | undefined)?.setData(
      lineData(path)
    );

    const first = path[0];
    const last = path[path.length - 1];

    if (live) {
      if (first && !startRef.current) {
        import("maplibre-gl").then((gl) => {
          if (!mapRef.current || startRef.current) return;
          startRef.current = new gl.Marker({ element: pinElement(ROUTE_COLOR, "#04231c") })
            .setLngLat(first)
            .addTo(mapRef.current);
        });
      } else if (first) {
        startRef.current?.setLngLat(first);
      }
      if (last) map.panTo(last, { duration: 500 });
      return;
    }

    // Static (run detail): start + finish markers, framed to the whole route.
    import("maplibre-gl").then((gl) => {
      if (!mapRef.current) return;
      if (first) {
        if (!startRef.current) {
          startRef.current = new gl.Marker({ element: pinElement(ROUTE_COLOR, "#04231c") })
            .setLngLat(first)
            .addTo(mapRef.current);
        } else startRef.current.setLngLat(first);
      }
      if (last) {
        if (!endRef.current) {
          endRef.current = new gl.Marker({ element: pinElement("#f3f7f5", ROUTE_COLOR) })
            .setLngLat(last)
            .addTo(mapRef.current);
        } else endRef.current.setLngLat(last);
      }
    });

    if (path.length >= 2) {
      const bounds = path.reduce(
        (b, p) => [
          [Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])],
          [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])],
        ],
        [
          [path[0][0], path[0][1]],
          [path[0][0], path[0][1]],
        ]
      );
      map.fitBounds(bounds as LngLatBoundsLike, { padding: 48, duration: 0 });
    } else if (last) {
      map.setCenter(last);
    }
  }, [points, status, live]);

  // Blue "you are here" dot + facing beam. Centre on the user once before a run.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !myLocation) return;
    const at = toLngLat(myLocation);

    if (!meRef.current) {
      import("maplibre-gl").then((gl) => {
        if (!mapRef.current || meRef.current) return;
        const { el, beam } = meElement();
        beamElRef.current = beam;
        meRef.current = new gl.Marker({ element: el })
          .setLngLat(at)
          .addTo(mapRef.current);
        applyHeading(beam, heading);
      });
    } else {
      meRef.current.setLngLat(at);
      applyHeading(beamElRef.current, heading);
    }

    if (points.length === 0 && !centeredOnMe.current) {
      map.setCenter(at);
      centeredOnMe.current = true;
    }
  }, [myLocation, heading, status, points.length]);

  // The searched destination ("cilj") — a teal target marker.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;

    if (!goal) {
      goalRef.current?.remove();
      goalRef.current = null;
      framedGoalRef.current = null;
      (map.getSource("route-planned") as GeoJSONSource | undefined)?.setData(
        lineData([])
      );
      return;
    }
    const at = toLngLat(goal);
    if (!goalRef.current) {
      import("maplibre-gl").then((gl) => {
        if (!mapRef.current || goalRef.current) return;
        goalRef.current = new gl.Marker({ element: goalElement() })
          .setLngLat(at)
          .addTo(mapRef.current);
      });
    } else {
      goalRef.current.setLngLat(at);
    }
  }, [goal, status]);

  // The walked route to the goal — a faint teal underlay.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const coords = (plannedRoute ?? []).map(toLngLat);
    (map.getSource("route-planned") as GeoJSONSource | undefined)?.setData(
      lineData(coords)
    );
  }, [plannedRoute, status]);

  // When a goal is first set (recording), frame me + goal + route once.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !live || !goal) return;
    if (framedGoalRef.current === goalKey(goal)) return;

    const pts: [number, number][] = [toLngLat(goal)];
    if (myLocation) pts.push(toLngLat(myLocation));
    (plannedRoute ?? []).forEach((p) => pts.push(toLngLat(p)));
    if (pts.length < 2) return;

    const bounds = pts.reduce(
      (b, p) => [
        [Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])],
        [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])],
      ],
      [
        [pts[0][0], pts[0][1]],
        [pts[0][0], pts[0][1]],
      ]
    );
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 80, duration: 500 });
    framedGoalRef.current = goalKey(goal);
  }, [goal, plannedRoute, myLocation, live, status]);

  return (
    <div
      className={cn(
        "overflow-hidden bg-card",
        fill ? "absolute inset-0" : "relative rounded-2xl border border-border",
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <MapPin className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-[16rem] px-4 text-sm text-muted-foreground">
            {status === "loading"
              ? "Učitavam mapu…"
              : "Mapa trenutno nije dostupna, ali trčanje se i dalje snima."}
          </p>
          {status === "unavailable" && reason && (
            <p className="max-w-[18rem] px-4 text-[11px] text-muted-foreground/70">
              {reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

/** Point the facing beam along `heading` (or hide it when unknown). */
function applyHeading(beam: HTMLDivElement | null, heading: number | null) {
  if (!beam) return;
  if (typeof heading === "number" && Number.isFinite(heading)) {
    beam.style.display = "block";
    beam.style.transform = `rotate(${heading}deg)`;
  } else {
    beam.style.display = "none";
  }
}
