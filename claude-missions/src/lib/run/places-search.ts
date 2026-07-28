/**
 * Trčanje: destination ("cilj") search over the *new* Places API.
 *
 * The legacy `AutocompleteService` is closed to new Google Cloud projects
 * (since March 2025), so this uses `AutocompleteSuggestion` — live predictions
 * as you type — resolved to a lat/lng via `Place.fetchFields`. Everything Google
 * lives here so the recorder component never touches `google.maps.places`.
 *
 * Needs "Places API (New)" enabled (and allowed) on the Maps key.
 */

import { loadGoogleMaps } from "@/lib/run/google-maps-loader";

/** One typed-ahead prediction, ready to render and (on tap) resolve. */
export interface GoalSuggestion {
  placeId: string;
  /** Bold line — the place's own name (e.g. "Ada Ciganlija"). */
  primary: string;
  /** Muted line — the address/context (e.g. "Beograd, Srbija"). */
  secondary: string;
  /** The raw prediction, kept so {@link resolveGoal} can fetch its location. */
  prediction: google.maps.places.PlacePrediction;
}

/** A picked suggestion turned into a map coordinate + a display label. */
export interface ResolvedGoal {
  location: google.maps.LatLngLiteral;
  label: string;
}

// One billing session spans the keystrokes of a single search and ends when a
// suggestion is picked (resolveGoal) — then a fresh token starts next time.
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

async function placesLibrary(): Promise<google.maps.places.PlacesLibrary> {
  await loadGoogleMaps();
  return google.maps.importLibrary("places");
}

/**
 * Live autocomplete predictions for `input`, biased to Serbia in Serbian.
 * Returns `[]` for very short input (under two characters) rather than firing a
 * request per keystroke. Throws if Places (New) isn't enabled — the caller shows
 * a calm hint.
 */
export async function fetchGoalSuggestions(
  input: string
): Promise<GoalSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const { AutocompleteSuggestion, AutocompleteSessionToken } =
    await placesLibrary();
  if (!sessionToken) sessionToken = new AutocompleteSessionToken();

  const { suggestions } =
    await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: trimmed,
      sessionToken,
      includedRegionCodes: ["rs"],
      language: "sr",
    });

  const out: GoalSuggestion[] = [];
  for (const suggestion of suggestions) {
    const prediction = suggestion.placePrediction;
    if (!prediction) continue;
    out.push({
      placeId: prediction.placeId,
      primary: prediction.mainText?.text ?? prediction.text.text,
      secondary: prediction.secondaryText?.text ?? "",
      prediction,
    });
  }
  return out;
}

/**
 * Resolve a picked suggestion to its coordinate + label, and close the billing
 * session so the next search starts fresh. Throws if the place has no location.
 */
export async function resolveGoal(
  suggestion: GoalSuggestion
): Promise<ResolvedGoal> {
  const { place } = await suggestion.prediction
    .toPlace()
    .fetchFields({ fields: ["location", "formattedAddress"] });
  sessionToken = null;

  const location = place.location;
  if (!location) {
    throw new Error("Lokacija nije dostupna za taj rezultat.");
  }
  return {
    location: { lat: location.lat(), lng: location.lng() },
    label: place.formattedAddress ?? suggestion.primary,
  };
}
