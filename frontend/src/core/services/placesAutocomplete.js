/**
 * Address suggestions via Places API (New): `AutocompleteSuggestion`.
 *
 * Replaces the legacy `google.maps.places.AutocompleteService`, which Google
 * no longer enables for new projects ("You're calling a legacy API, which is
 * not enabled for your project").
 *
 * Results are returned in the legacy prediction shape the UI already renders
 * ({ place_id, description, structured_formatting }), so callers only swap the
 * fetch call. Selecting a result still resolves coordinates with the Geocoder
 * (Geocoding API) using `place_id`.
 *
 * Requires "Places API (New)" to be enabled for the Maps key.
 */

let placesLibraryPromise = null;

async function getPlacesLibrary() {
  const importLibrary = window.google?.maps?.importLibrary;
  if (typeof importLibrary !== "function") {
    throw new Error("Google Maps is not loaded");
  }
  if (!placesLibraryPromise) {
    placesLibraryPromise = importLibrary("places").catch((err) => {
      placesLibraryPromise = null; // allow a retry on the next search
      throw err;
    });
  }
  return placesLibraryPromise;
}

/** New session token (groups keystrokes + selection into one billed session). */
export async function createPlacesSessionToken() {
  try {
    const { AutocompleteSessionToken } = await getPlacesLibrary();
    return AutocompleteSessionToken ? new AutocompleteSessionToken() : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} options
 * @param {string} options.input           What the user typed.
 * @param {object} [options.sessionToken]  From createPlacesSessionToken().
 * @param {string[]} [options.regionCodes] Restrict results to these countries (default India).
 * @param {{center:{lat:number,lng:number}, radius:number}} [options.locationBias]
 * @param {number} [options.limit]         Max suggestions to return.
 * @returns {Promise<Array<{place_id:string, description:string, structured_formatting:{main_text:string, secondary_text:string}}>>}
 */
export async function fetchPlaceSuggestions({
  input,
  sessionToken,
  regionCodes = ["in"],
  locationBias,
  limit = 5,
}) {
  const { AutocompleteSuggestion } = await getPlacesLibrary();
  if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    throw new Error("Places API (New) autocomplete is unavailable");
  }

  const request = { input, includedRegionCodes: regionCodes };
  if (sessionToken) request.sessionToken = sessionToken;
  if (locationBias) request.locationBias = locationBias;

  const { suggestions = [] } =
    await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

  return suggestions
    .map((s) => s.placePrediction)
    .filter((p) => p?.placeId)
    .slice(0, limit)
    .map((p) => {
      const full = p.text?.text || "";
      return {
        place_id: p.placeId,
        description: full,
        structured_formatting: {
          main_text: p.mainText?.text || full,
          secondary_text: p.secondaryText?.text || "",
        },
        // Keeps the autocomplete session when the place details are fetched.
        toPlace: () => p.toPlace(),
      };
    });
}

/**
 * Coordinates + address for a chosen suggestion, via Places API (New).
 * @param {{place_id:string, toPlace?:Function}} suggestion
 * @returns {Promise<{lat:number, lng:number, name:string, address:string}>}
 */
export async function fetchPlaceLocation(suggestion) {
  const { Place } = await getPlacesLibrary();
  const place =
    typeof suggestion?.toPlace === "function"
      ? suggestion.toPlace()
      : new Place({ id: suggestion.place_id });

  await place.fetchFields({
    fields: ["location", "formattedAddress", "displayName"],
  });
  if (!place.location) throw new Error("Place has no location");

  return {
    lat: place.location.lat(),
    lng: place.location.lng(),
    name: place.displayName || "",
    address: place.formattedAddress || "",
  };
}
