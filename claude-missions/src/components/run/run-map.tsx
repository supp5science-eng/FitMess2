"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  googleMapsApiKey,
  loadGoogleMaps,
} from "@/lib/run/google-maps-loader";
import type { RunRoutePoint } from "@/lib/types/db";

/** Teal accent (matches `--primary` in globals.css) for the route + markers. */
const ROUTE_COLOR = "#17d1a8";
/** Fallback centre when there are no fixes yet — central Belgrade. */
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 44.8176, lng: 20.4633 };

/**
 * A muted dark map style so the map sits calmly inside FitMess's dark-first UI
 * instead of glowing bright white. Kept compact — geometry, water, roads, and
 * labels toned to the app's near-black/teal palette.
 */
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#14181a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b9490" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0c0b" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#232a2d" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1516" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function circleIcon(fill: string, stroke: string): google.maps.Symbol {
  return {
    path: 0 /* google.maps.SymbolPath.CIRCLE */,
    scale: 6,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: stroke,
    strokeWeight: 2,
  };
}

const toLatLng = (p: RunRoutePoint): google.maps.LatLngLiteral => ({
  lat: p.lat,
  lng: p.lng,
});

interface RunMapProps {
  /** The route so far (recording) or the whole run (detail). */
  points: readonly RunRoutePoint[];
  /** Recording mode: follow the last fix instead of framing the whole route. */
  live?: boolean;
  className?: string;
}

/**
 * Draws a run's GPS route on a Google map. In `live` mode it follows the latest
 * fix (recording screen); otherwise it frames the whole route (run detail).
 *
 * Degrades gracefully: with no API key or a failed load it shows a calm
 * placeholder rather than a broken tile — the rest of the screen still works.
 */
export function RunMap({ points, live = false, className }: RunMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const startRef = useRef<google.maps.Marker | null>(null);
  const endRef = useRef<google.maps.Marker | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    googleMapsApiKey() ? "loading" : "unavailable"
  );

  // One-time map init. `live` is read once at mount (the recorder never toggles
  // it), so it is intentionally not a dependency.
  useEffect(() => {
    if (!googleMapsApiKey()) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const first = points[0];
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: first ? toLatLng(first) : DEFAULT_CENTER,
          zoom: 16,
          disableDefaultUI: true,
          gestureHandling: live ? "greedy" : "cooperative",
          clickableIcons: false,
          keyboardShortcuts: false,
          backgroundColor: "#14181a",
          styles: DARK_MAP_STYLE,
        });
        lineRef.current = new google.maps.Polyline({
          map: mapRef.current,
          geodesic: true,
          strokeColor: ROUTE_COLOR,
          strokeOpacity: 1,
          strokeWeight: 4,
          zIndex: 2,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
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
          title: live ? "Ovde si" : "Cilj",
          icon: circleIcon("#f3f7f5", ROUTE_COLOR),
          zIndex: 4,
        });
      }
      endRef.current.setPosition(last);
    }

    if (live) {
      if (last) map.setCenter(last);
    } else if (path.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
    } else if (last) {
      map.setCenter(last);
    }
  }, [points, status, live]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
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
        </div>
      )}
    </div>
  );
}
