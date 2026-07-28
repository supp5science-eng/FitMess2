"use client";

import { MapPin } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import {
  googleMapsApiKey,
  loadGoogleMaps,
} from "@/lib/run/google-maps-loader";
import type { RunRoutePoint } from "@/lib/types/db";

/** Teal accent (matches `--primary` in globals.css) for the route + markers. */
const ROUTE_COLOR = "#17d1a8";
/** The indigo ground the clean style paints — also the map's backdrop while
 * tiles load, so there's never a flash of Google's default grey. */
const GROUND_COLOR = "#232842";
/** Fallback centre when there are no fixes yet — central Belgrade. */
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 44.8176, lng: 20.4633 };
/** Camera tilt (degrees) for the 3D perspective, applied best-effort. */
const TILT_3D = 47;

/**
 * A calm running style we own entirely in code — so the map stays clutter-free
 * (no cafés or shops crowding the runner) no matter how the Google Cloud
 * console is set up. Deep-indigo ground, muted lavender roads, dim water, parks
 * in a quiet green — the palette of the reference running map, under the app's
 * dark, teal-accented controls.
 *
 * Businesses/POI pins and transit are removed, but the names people orient by
 * are kept: main-street labels (arterials + highways) and neighbourhood/place
 * names stay on and legible; only minor local-street labels are dropped so the
 * map reads clean without leaving the runner lost.
 */
const CLEAN_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: GROUND_COLOR }] },
  // Labels we keep: calm lavender text with a dark halo so it reads on indigo.
  { elementType: "labels.text.fill", stylers: [{ color: "#aeb4dd" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#171b30" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  // Businesses & transit stay gone — that was the clutter.
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  // Keep neighbourhood/city names for orientation; drop borders + parcel noise.
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative.neighborhood",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  // Parks as quiet green geometry.
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#2c4a3e" }, { visibility: "on" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.fill",
    stylers: [{ color: "#2b315a" }],
  },
  // Roads: lavender geometry; keep ONLY main-street names (drop local labels).
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#3a4168" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#434d7d" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#4d5891" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#151b33" }] },
];

function circleIcon(
  fill: string,
  stroke: string,
  scale = 6
): google.maps.Symbol {
  return {
    path: 0 /* google.maps.SymbolPath.CIRCLE */,
    scale,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: stroke,
    strokeWeight: 2,
  };
}

/** iOS-style blue "you are here" dot (blue core, white ring). */
function locationDot(): google.maps.Symbol {
  return {
    path: 0 /* google.maps.SymbolPath.CIRCLE */,
    scale: 7,
    fillColor: "#2a7bff",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
  };
}

/**
 * The soft white "facing" cone that fans out from the location dot in the
 * direction the runner is heading (like Google/Apple Maps). A translucent wedge
 * whose apex sits on the dot; `rotation` (degrees clockwise from north) turns it
 * to the live heading.
 */
function headingBeam(rotation: number): google.maps.Symbol {
  return {
    path: "M0,0 L-11,-30 Q0,-37 11,-30 Z",
    scale: 1,
    fillColor: "#ffffff",
    fillOpacity: 0.5,
    strokeColor: "#ffffff",
    strokeOpacity: 0,
    strokeWeight: 0,
    rotation,
    anchor: new google.maps.Point(0, 0),
  };
}

const toLatLng = (p: RunRoutePoint): google.maps.LatLngLiteral => ({
  lat: p.lat,
  lng: p.lng,
});

const goalKey = (g: google.maps.LatLngLiteral): string => `${g.lat},${g.lng}`;

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
  /** The user's current position — drawn as the blue "you are here" dot and
   * (before a run starts) what the map centres on. */
  myLocation?: google.maps.LatLngLiteral | null;
  /** Live heading (degrees clockwise from north) for the facing beam; `null`
   * when unknown (standing still with no compass) hides the beam. */
  heading?: number | null;
  /** A searched destination — drawn as the "cilj" target marker. */
  goal?: google.maps.LatLngLiteral | null;
  /** The walked route to `goal`, drawn as a faint teal underlay. */
  plannedRoute?: readonly google.maps.LatLngLiteral[] | null;
  className?: string;
}

/**
 * Draws a run's GPS route on a Google map. In `live` mode it follows the latest
 * fix (recording screen); otherwise it frames the whole route (run detail).
 * With `fill` it becomes the full-viewport, immersive map behind the recorder's
 * floating controls.
 *
 * The look is a label-free, POI-free indigo style we own in code (see
 * {@link CLEAN_MAP_STYLE}) — clean and calm for running, and independent of any
 * Cloud console styling. A searched `goal` adds a target marker plus its walked
 * `plannedRoute`, and `heading` fans a facing beam out of the location dot.
 *
 * Degrades gracefully: with no API key or a failed load it shows a calm
 * placeholder rather than a broken tile — the rest of the screen still works.
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const meRef = useRef<google.maps.Marker | null>(null);
  const beamRef = useRef<google.maps.Marker | null>(null);
  const centeredOnMe = useRef(false);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const plannedRef = useRef<google.maps.Polyline | null>(null);
  const goalRef = useRef<google.maps.Marker | null>(null);
  const goalHaloRef = useRef<google.maps.Marker | null>(null);
  const framedGoalRef = useRef<string | null>(null);
  const startRef = useRef<google.maps.Marker | null>(null);
  const endRef = useRef<google.maps.Marker | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    googleMapsApiKey() ? "loading" : "unavailable"
  );
  // Short diagnostic surfaced under the placeholder so a misconfigured deploy
  // (missing key vs. blocked script) is debuggable from the screen itself.
  const [reason, setReason] = useState<string | null>(
    googleMapsApiKey()
      ? null
      : "Nedostaje NEXT_PUBLIC_GOOGLE_MAPS_API_KEY u build-u."
  );

  useImperativeHandle(ref, () => ({
    recenter: () => {
      const last = points[points.length - 1];
      const target = last ? toLatLng(last) : myLocation;
      if (mapRef.current && target) mapRef.current.panTo(target);
    },
    setTilt3D: (on: boolean) => {
      mapRef.current?.setTilt(on ? TILT_3D : 0);
    },
    resetNorth: () => {
      mapRef.current?.setHeading(0);
    },
  }));

  // One-time map init. `live`/`fill` are read once at mount, so intentionally
  // not dependencies.
  useEffect(() => {
    if (!googleMapsApiKey()) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const first = points[0];
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: first ? toLatLng(first) : DEFAULT_CENTER,
          zoom: live ? 16.5 : 15,
          disableDefaultUI: true,
          gestureHandling: live ? "greedy" : "cooperative",
          clickableIcons: false,
          keyboardShortcuts: false,
          backgroundColor: GROUND_COLOR,
          styles: CLEAN_MAP_STYLE,
          // Tilt/heading are honoured on WebGL (vector) renderers and ignored on
          // the raster fallback — a harmless best-effort at the 3D perspective.
          tilt: live ? TILT_3D : 0,
          heading: 0,
        });
        lineRef.current = new google.maps.Polyline({
          map: mapRef.current,
          geodesic: true,
          strokeColor: ROUTE_COLOR,
          strokeOpacity: 1,
          strokeWeight: 5,
          zIndex: 2,
        });
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("unavailable");
        setReason(
          error instanceof Error ? error.message : "Greška pri učitavanju mape."
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw the route + markers whenever the points change.
  useEffect(() => {
    const map = mapRef.current;
    const line = lineRef.current;
    if (status !== "ready" || !map || !line) return;

    const path = points.map(toLatLng);
    line.setPath(path);

    const first = path[0];
    const last = path[path.length - 1];

    if (live) {
      // The teal start dot + the teal route line; the current position is the
      // blue "you are here" dot (drawn from `myLocation` below). Follow it.
      if (first && !startRef.current) {
        startRef.current = new google.maps.Marker({
          map,
          title: "Start",
          icon: circleIcon(ROUTE_COLOR, "#04231c", 5),
          zIndex: 3,
        });
      }
      if (first) startRef.current?.setPosition(first);
      if (last) map.panTo(last);
      return;
    }

    // Static (run detail): start + finish markers, framed to the whole route.
    if (first) {
      if (!startRef.current) {
        startRef.current = new google.maps.Marker({
          map,
          title: "Start",
          icon: circleIcon(ROUTE_COLOR, "#04231c"),
          zIndex: 3,
        });
      }
      startRef.current.setPosition(first);
    }
    if (last) {
      if (!endRef.current) {
        endRef.current = new google.maps.Marker({
          map,
          title: "Cilj",
          icon: circleIcon("#f3f7f5", ROUTE_COLOR),
          zIndex: 4,
        });
      }
      endRef.current.setPosition(last);
    }
    if (path.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
    } else if (last) {
      map.setCenter(last);
    }
  }, [points, status, live]);

  // Blue "you are here" dot + the facing beam behind it. Before a run starts we
  // centre on the user once (so the map opens on their location), then leave the
  // camera alone.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !myLocation) return;

    if (!meRef.current) {
      meRef.current = new google.maps.Marker({
        map,
        title: "Ovde si",
        icon: locationDot(),
        zIndex: 6,
      });
    }
    meRef.current.setPosition(myLocation);

    if (typeof heading === "number" && Number.isFinite(heading)) {
      if (!beamRef.current) {
        beamRef.current = new google.maps.Marker({
          map,
          title: "Smer",
          icon: headingBeam(heading),
          zIndex: 5,
        });
      }
      beamRef.current.setMap(map);
      beamRef.current.setPosition(myLocation);
      beamRef.current.setIcon(headingBeam(heading));
    } else {
      beamRef.current?.setMap(null);
    }

    if (points.length === 0 && !centeredOnMe.current) {
      map.setCenter(myLocation);
      centeredOnMe.current = true;
    }
  }, [myLocation, heading, status, points.length]);

  // The searched destination ("cilj") — a teal target: a soft halo under a
  // white-cored ring, so it reads apart from the start (teal) and me (blue).
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;

    if (!goal) {
      goalRef.current?.setMap(null);
      goalRef.current = null;
      goalHaloRef.current?.setMap(null);
      goalHaloRef.current = null;
      framedGoalRef.current = null;
      return;
    }

    if (!goalHaloRef.current) {
      goalHaloRef.current = new google.maps.Marker({
        map,
        title: "Cilj",
        icon: {
          path: 0 /* CIRCLE */,
          scale: 15,
          fillColor: ROUTE_COLOR,
          fillOpacity: 0.2,
          strokeColor: ROUTE_COLOR,
          strokeOpacity: 0.35,
          strokeWeight: 1,
        },
        zIndex: 4,
      });
    }
    if (!goalRef.current) {
      goalRef.current = new google.maps.Marker({
        map,
        title: "Cilj",
        icon: circleIcon("#f3f7f5", ROUTE_COLOR, 8),
        zIndex: 5,
      });
    }
    goalHaloRef.current.setPosition(goal);
    goalRef.current.setPosition(goal);
  }, [goal, status]);

  // The walked route to the goal — a faint, wide teal underlay beneath the
  // bright, opaque run trace, so "planned" and "run so far" never blur together.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;

    if (!plannedRoute || plannedRoute.length < 2) {
      plannedRef.current?.setMap(null);
      plannedRef.current = null;
      return;
    }
    if (!plannedRef.current) {
      plannedRef.current = new google.maps.Polyline({
        map,
        geodesic: true,
        strokeColor: ROUTE_COLOR,
        strokeOpacity: 0.5,
        strokeWeight: 6,
        zIndex: 1,
      });
    }
    plannedRef.current.setPath([...plannedRoute]);
  }, [plannedRoute, status]);

  // When a goal is first set (recording), frame me + goal + route once so the
  // whole trip is visible; the point-following effect resumes on the next fix.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !live || !goal) return;
    if (framedGoalRef.current === goalKey(goal)) return;

    const bounds = new google.maps.LatLngBounds();
    if (myLocation) bounds.extend(myLocation);
    (plannedRoute ?? []).forEach((p) => bounds.extend(p));
    bounds.extend(goal);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 80);
      framedGoalRef.current = goalKey(goal);
    }
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
