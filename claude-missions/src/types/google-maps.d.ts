/**
 * Minimal ambient typings for the slice of the Google Maps JavaScript API the
 * Trčanje map uses (a plain map, a route polyline, and start/end/live markers).
 *
 * FitMess is deliberately dependency-light (hand-rolled charts, no map library),
 * so rather than pull in `@types/google.maps` we declare only what
 * `src/components/run/run-map.tsx` and `src/lib/run/google-maps-loader.ts`
 * actually touch. The script itself is loaded at runtime from Google; these
 * declarations just let it typecheck.
 */

declare global {
  namespace google.maps {
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface Padding {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }

    enum SymbolPath {
      CIRCLE = 0,
    }

    interface Symbol {
      path: SymbolPath | string;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }

    // A single entry of a Maps JSON style array. Loosely typed on purpose.
    interface MapTypeStyle {
      featureType?: string;
      elementType?: string;
      stylers: Array<Record<string, string | number>>;
    }

    interface MapOptions {
      center?: LatLngLiteral;
      zoom?: number;
      /** Cloud-configured Vector map id — enables 3D buildings + tilt/rotation. */
      mapId?: string;
      /** Camera tilt in degrees (0 = top-down; ~45 for the 3D perspective). */
      tilt?: number;
      /** Camera bearing in degrees clockwise from north. */
      heading?: number;
      /** "LIGHT" | "DARK" | "FOLLOW_SYSTEM" — which Map-ID style variant to use. */
      colorScheme?: string;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
      gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
      clickableIcons?: boolean;
      keyboardShortcuts?: boolean;
      backgroundColor?: string;
      /** Raster-map styling only (ignored on a Vector `mapId`). */
      styles?: MapTypeStyle[];
    }

    interface PolylineOptions {
      path?: LatLngLiteral[];
      map?: Map | null;
      geodesic?: boolean;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      zIndex?: number;
    }

    interface MarkerOptions {
      position?: LatLngLiteral;
      map?: Map | null;
      title?: string;
      icon?: Symbol | string;
      zIndex?: number;
    }

    class Map {
      constructor(element: HTMLElement, options?: MapOptions);
      setCenter(latLng: LatLngLiteral): void;
      panTo(latLng: LatLngLiteral): void;
      setZoom(zoom: number): void;
      getZoom(): number | undefined;
      setTilt(tilt: number): void;
      getTilt(): number | undefined;
      setHeading(heading: number): void;
      getHeading(): number | undefined;
      setOptions(options: MapOptions): void;
      fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
    }

    class Polyline {
      constructor(options?: PolylineOptions);
      setPath(path: LatLngLiteral[]): void;
      setMap(map: Map | null): void;
    }

    class Marker {
      constructor(options?: MarkerOptions);
      setPosition(latLng: LatLngLiteral): void;
      setMap(map: Map | null): void;
    }

    class LatLngBounds {
      constructor();
      extend(latLng: LatLngLiteral): void;
      isEmpty(): boolean;
    }
  }

  interface Window {
    google?: typeof google;
    /** One-shot callback the Maps loader script invokes when ready. */
    __fitmessInitGoogleMaps?: () => void;
  }
}

export {};
