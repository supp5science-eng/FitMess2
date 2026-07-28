/**
 * Trčanje: a tiny, dependency-free loader for the Google Maps JavaScript API.
 *
 * We deliberately don't add a maps SDK package (FitMess stays dependency-light).
 * This injects the Maps `<script>` exactly once per page and resolves when the
 * API is ready, memoising the in-flight promise so many `RunMap` instances (the
 * recording screen + the run-detail screen) share a single load.
 *
 * The API key is the public, browser-side `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
 * (locked down by HTTP-referrer restriction in Google Cloud, not by secrecy).
 * A missing key rejects, so callers can fall back to a calm placeholder rather
 * than a broken map.
 */

let loadPromise: Promise<void> | null = null;

/** The browser-side Maps API key, or `undefined` when unconfigured. */
export function googleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
}

/** The Vector map id (Cloud-configured) that enables 3D buildings + tilt, or
 * `undefined` when unset — the map then falls back to a dark-styled raster. */
export function googleMapsMapId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
}

/**
 * Resolve once `window.google.maps` is available, loading the script on first
 * call. Rejects when there is no API key or the script fails to load. Safe to
 * call repeatedly — the load happens at most once.
 */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps se učitava samo u browseru."));
  }
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const apiKey = googleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API ključ nije podešen."));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    window.__fitmessInitGoogleMaps = () => {
      resolve();
      delete window.__fitmessInitGoogleMaps;
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      callback: "__fitmessInitGoogleMaps",
      loading: "async",
      v: "weekly",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Google Maps nije uspeo da se učita."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
