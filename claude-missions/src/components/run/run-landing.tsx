"use client";

import { Check, Compass, Footprints, Navigation } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MapFab } from "@/components/run/map-fab";
import { RunMap, type RunMapHandle } from "@/components/run/run-map";
import { googleMapsMapId } from "@/lib/run/google-maps-loader";

const NO_POINTS = [] as const;

/**
 * `/trcanje` landing — the immersive map is the first thing the tab shows, with
 * your live position on it and a big teal "Kreni" that opens the recorder. The
 * bottom nav stays (this isn't full-bleed) so you can still switch tabs; the
 * run history lives on Analitika now.
 */
export function RunLanding() {
  const mapRef = useRef<RunMapHandle>(null);
  const [is3D, setIs3D] = useState<boolean>(Boolean(googleMapsMapId()));
  const [myLocation, setMyLocation] =
    useState<google.maps.LatLngLiteral | null>(null);

  // Show the user's position from the moment the tab opens (granted permission
  // is reused — no repeat prompt).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Silent — the recorder handles a hard "denied" state once you start.
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

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-background">
      <RunMap ref={mapRef} points={NO_POINTS} live fill myLocation={myLocation} />

      {/* Bottom scrim for control legibility. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/60 to-transparent"
      />

      {/* Top-right compass. */}
      <div className="absolute right-4 top-4 z-10">
        <MapFab label="Poravnaj na sever" onClick={() => mapRef.current?.resetNorth()}>
          <Compass className="size-5" aria-hidden="true" />
        </MapFab>
      </div>

      {/* Right stack: 3D + recenter. */}
      <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
        <MapFab label="3D prikaz" active={is3D} onClick={toggle3D}>
          <span className="text-sm font-bold">3D</span>
        </MapFab>
        <MapFab label="Centriraj na mene" onClick={() => mapRef.current?.recenter()}>
          <Navigation className="size-5" aria-hidden="true" />
        </MapFab>
      </div>

      {/* Bottom: activity indicator + teal Kreni. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-5">
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

        <Link
          href="/trcanje/snimanje"
          className="liquid-glass inline-flex size-24 items-center justify-center rounded-full text-lg font-bold uppercase tracking-wide text-[#04231c] shadow-[0_12px_34px_-8px_rgba(23,209,168,0.7)]"
          style={{ backgroundImage: "linear-gradient(135deg,#2ee0bd,#0d9c7e)" }}
        >
          Kreni
        </Link>

        {/* Balances the Kreni button; the run history moved to Analitika. */}
        <div className="size-14" aria-hidden="true" />
      </div>
    </div>
  );
}
