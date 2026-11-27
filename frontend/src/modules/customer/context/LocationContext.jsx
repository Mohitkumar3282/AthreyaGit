import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { customerApi } from "../services/customerApi";
import { hasValidStoredAuthToken } from "@core/utils/authStorage";
import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";

const LocationContext = createContext(undefined);
const STORAGE_KEY = STORAGE_KEYS.LOCATION;
// "Not now" on the location popup hides it for this visit only (sessionStorage).
const LOCATION_PROMPT_DISMISSED_KEY = "athreya_location_prompt_dismissed_visit";
// 30 days — refresh the cached coordinates if a user comes back to a stale tab
// after roughly a month so we don't keep serving locations from a previous
// address indefinitely.
const LOCATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const LocationProvider = ({ children }) => {
  // Default location (used until we can resolve a better one)
  const [currentLocation, setCurrentLocation] = useState({
    name: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
    time: "12-15 mins",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452018",
    latitude: 22.711140989838025,
    longitude: 75.9001552518043,
    // Built-in fallback, not the customer's real location. Any real location
    // (GPS, search, saved/stored) replaces this object and drops the flag, so
    // checkout never pre-fills this demo address as someone's delivery address.
    isPlaceholder: true,
  });

  // Address list for drawer UI – will be hydrated from profile API.
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  // Update the current location.
  // By default this does NOT change saved addresses; only explicit
  // address actions should touch the saved list.
  const updateLocation = (
    newLoc,
    { persist = true, updateSavedHome = false } = {},
  ) => {
    setCurrentLocation(newLoc);

    if (updateSavedHome) {
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: newLoc.name } : addr,
        ),
      );
    }

    if (persist) {
      const payload = {
        address: newLoc.name,
        city: newLoc.city,
        state: newLoc.state,
        pincode: newLoc.pincode,
        latitude: newLoc.latitude,
        longitude: newLoc.longitude,
        // Internal app properties
        time: newLoc.time,
      };
      setJSON(STORAGE_KEY, payload, { ttlMs: LOCATION_TTL_MS });
    }
  };

  const addAddress = (newAddress) => {
    setSavedAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newAddress.label || "Other",
        address: newAddress.address,
        phone: newAddress.phone || "N/A",
        isCurrent: false,
      },
    ]);
  };

  // Resolve location once using browser geolocation + Google Maps Geocoding.
  // Must be called directly from a user gesture (click/tap) for the browser to show the permission prompt.
  const fetchAndCacheLocation = () =>
    new Promise((resolve) => {
      if (
        typeof window === "undefined" ||
        !("navigator" in window) ||
        !navigator.geolocation
      ) {
        resolve({
          ok: false,
          error: "Geolocation is not supported on this device",
        });
        return;
      }

      setIsFetchingLocation(true);
      setLocationError(null);

      const fallbackFromCoords = (latitude, longitude) => ({
        name: `Lat ${Number(latitude).toFixed(5)}, Lng ${Number(longitude).toFixed(5)}`,
        time: "12-15 mins",
        // Never fall back to the built-in placeholder's Indore city/pincode —
        // it ended up inside real customers' delivery addresses.
        city: currentLocation?.isPlaceholder ? "" : currentLocation?.city || "",
        state: currentLocation?.isPlaceholder ? "" : currentLocation?.state || "",
        pincode: currentLocation?.isPlaceholder ? "" : currentLocation?.pincode || "",
        latitude,
        longitude,
      });

      const handleLocationSuccess = async (latitude, longitude) => {
        try {
          // Always succeed with coordinates (needed for delivery fee calculation),
          // even if reverse geocoding fails (key missing / quota / restrictions).
          let liveLocation = fallbackFromCoords(latitude, longitude);

          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

          if (apiKey) {
            const params = new URLSearchParams({
              latlng: `${latitude},${longitude}`,
              key: apiKey,
            });

            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
            );

            if (!response.ok) {
              throw new Error("Failed to fetch address from Google Maps");
            }

            const data = await response.json();

            // Handle Google Geocoding API error responses
            if (data.status === "REQUEST_DENIED") {
              const msg =
                data.error_message ||
                "Geocoding API rejected (check API key restrictions)";
              throw new Error(msg);
            }
            if (data.status === "OVER_QUERY_LIMIT") {
              throw new Error("Geocoding API quota exceeded");
            }
            if (!data.results || data.results.length === 0) {
              throw new Error(
                data.error_message || "No address found for current location",
              );
            }

            const components = data.results[0].address_components || [];

            const getComponent = (types) =>
              components.find((c) => types.every((t) => c.types.includes(t)))
                ?.long_name;

            // Build address from components to match: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India"
            const premise = getComponent(["premise"]);
            const neighborhood = getComponent(["neighborhood"]);
            const sublocality = getComponent([
              "sublocality_level_1",
              "sublocality",
            ]);
            const locality = getComponent(["locality"]);
            const state = getComponent(["administrative_area_level_1"]);
            const pincode = getComponent(["postal_code"]);
            const country = getComponent(["country"]);

            const displayParts = [];
            if (premise) displayParts.push(premise);
            if (neighborhood) displayParts.push(neighborhood);
            if (sublocality && sublocality !== neighborhood)
              displayParts.push(sublocality);
            if (locality) displayParts.push(locality);

            let statePincode = "";
            if (state) statePincode += state;
            if (pincode) statePincode += (statePincode ? " " : "") + pincode;
            if (statePincode) displayParts.push(statePincode);

            if (country) displayParts.push(country);

            const friendlyName =
              displayParts.join(", ") || data.results[0].formatted_address;

            liveLocation = {
              name: friendlyName,
              time: "12-15 mins",
              // Small towns often have no "locality" — use the next best area
              // name instead of an unrelated city.
              city:
                locality ||
                getComponent(["administrative_area_level_3"]) ||
                getComponent(["administrative_area_level_2"]) ||
                sublocality ||
                liveLocation.city,
              state: state || liveLocation.state,
              pincode: pincode || liveLocation.pincode,
              latitude: latitude,
              longitude: longitude,
            };
          }

          updateLocation(liveLocation, {
            persist: true,
            updateSavedHome: false,
          });
          resolve({ ok: true, location: liveLocation });
        } catch (err) {
          const loc = fallbackFromCoords(latitude, longitude);
          updateLocation(loc, { persist: true, updateSavedHome: false });
          resolve({
            ok: true,
            location: loc,
            warning: err?.message || "Unable to fetch address",
          });
        } finally {
          setIsFetchingLocation(false);
        }
      };

      const handleLocationError = (error) => {
        const message = typeof error === 'string' ? error : (error.message || "Location permission denied");
        setLocationError(message);
        setIsFetchingLocation(false);
        // code: 1 = permission denied, 2 = position unavailable (GPS off), 3 = timeout
        resolve({ ok: false, error: message, code: typeof error === "object" ? error?.code : undefined });
      };

      // Native Flutter Bridge
      if (window.Flutter) {
        import("../../../lib/appZetoBridge").then(async (m) => {
          const appZetoBridge = m.default;
          const coords = await appZetoBridge.getLocation();
          if (coords && coords.lat && coords.lng) {
            handleLocationSuccess(coords.lat, coords.lng);
          } else {
            handleLocationError("Native location failed");
          }
        }).catch(() => handleLocationError("Bridge not found"));
        return;
      }

      // Standard Browser Geolocation
      navigator.geolocation.getCurrentPosition(
        (position) => handleLocationSuccess(position.coords.latitude, position.coords.longitude),
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });

  const refreshAddresses = useCallback(async () => {
    // Skip if user is not logged in – getProfile would 401 and trigger axios reload loop
    if (!hasValidStoredAuthToken("auth_customer")) return;
    try {
      const { data } = await customerApi.getProfile();
      const profile = data?.result ?? data?.data ?? data;
      const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
      setSavedAddresses(
        raw.map((addr, idx) => ({
          id: addr._id ?? String(idx),
          label:
            (addr.label || "Home").charAt(0).toUpperCase() +
            (addr.label || "home").slice(1),
          address:
            addr.fullAddress ||
            [addr.landmark, addr.city, addr.state, addr.pincode]
              .filter(Boolean)
              .join(", ") ||
            "",
          location:
            addr?.location &&
              typeof addr.location.lat === "number" &&
              typeof addr.location.lng === "number" &&
              Number.isFinite(addr.location.lat) &&
              Number.isFinite(addr.location.lng)
              ? { lat: addr.location.lat, lng: addr.location.lng }
              : null,
          placeId: typeof addr?.placeId === "string" ? addr.placeId : null,
          phone: profile?.phone ?? "",
          isCurrent: idx === 0,
        })),
      );
    } catch {
      // If API fails, keep existing in-memory addresses.
    }
  }, []);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // ------------------------------------------------------------------
  // Location check every time the app is opened / brought to the front.
  //
  // Reasons for the popup:
  //   "permission" — not allowed yet (browsers need a tap to ask)
  //   "denied"     — blocked; must be re-enabled in phone/browser settings
  //   "gps_off"    — allowed, but the phone's Location (GPS) is off
  // "Not now" hides it for this visit only (sessionStorage), so it shows
  // again the next time the customer opens the app.
  // ------------------------------------------------------------------
  const [locationPromptReason, setLocationPromptReason] = useState(null);
  const fetchLocationRef = React.useRef(null);
  fetchLocationRef.current = fetchAndCacheLocation;
  const hasRealLocationRef = React.useRef(false);
  hasRealLocationRef.current = !currentLocation?.isPlaceholder;

  const promptDismissedThisVisit = () => {
    try {
      return window.sessionStorage.getItem(LOCATION_PROMPT_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  };

  const openLocationPrompt = useCallback((reason) => {
    setLocationPromptReason(reason);
    setShowLocationPrompt(Boolean(reason));
  }, []);

  /** Ask the device for a position without changing the chosen location. */
  const probeDeviceLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ ok: false, code: 2 });
      navigator.geolocation.getCurrentPosition(
        () => resolve({ ok: true }),
        (err) => resolve({ ok: false, code: err?.code }),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
      );
    });

  const checkLocationOnOpen = useCallback(async () => {
    if (promptDismissedThisVisit()) return;

    // Native app wrapper: its bridge handles the permission dialog itself.
    if (window.Flutter) {
      const result = await fetchLocationRef.current?.();
      openLocationPrompt(result?.ok ? null : "gps_off");
      return;
    }
    if (!navigator.geolocation) return;

    let state = null;
    try {
      state = (await navigator.permissions?.query({ name: "geolocation" }))?.state || null;
    } catch {
      state = null; // Permissions API not available (e.g. some iOS versions)
    }

    if (state === "denied") {
      openLocationPrompt("denied");
      return;
    }
    if (state === "granted") {
      // Permission is on — make sure the phone's GPS actually works.
      const probe = await probeDeviceLocation();
      if (!probe.ok) {
        openLocationPrompt(probe.code === 1 ? "denied" : "gps_off");
        return;
      }
      openLocationPrompt(null);
      // Fill in a real location only if the customer doesn't have one yet;
      // never overwrite an address they picked themselves.
      if (!hasRealLocationRef.current) fetchLocationRef.current?.();
      return;
    }
    // "prompt" or unknown: we need a tap before the browser can ask.
    if (!hasRealLocationRef.current || state === "prompt") {
      openLocationPrompt("permission");
    }
  }, [openLocationPrompt]);

  useEffect(() => {
    checkLocationOnOpen();

    const onVisible = () => {
      if (document.visibilityState === "visible") checkLocationOnOpen();
    };
    document.addEventListener("visibilitychange", onVisible);

    // If the customer enables location in settings while the app is open,
    // close the popup and pick up their location.
    let permissionStatus = null;
    const onPermissionChange = () => {
      if (permissionStatus?.state === "granted") checkLocationOnOpen();
    };
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        permissionStatus = status;
        status.addEventListener?.("change", onPermissionChange);
      })
      .catch(() => {});

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      permissionStatus?.removeEventListener?.("change", onPermissionChange);
    };
  }, [checkLocationOnOpen]);

  const dismissLocationPrompt = () => {
    try {
      window.sessionStorage.setItem(LOCATION_PROMPT_DISMISSED_KEY, "1");
    } catch {
      // Stays dismissed until the page reloads.
    }
    openLocationPrompt(null);
  };

  // Called from the popup button (a user tap, so the browser may show its dialog).
  const requestLocationPermission = async () => {
    const result = await fetchAndCacheLocation();
    if (result?.ok) {
      openLocationPrompt(null);
      return;
    }
    openLocationPrompt(result?.code === 1 ? "denied" : "gps_off");
  };

  // Restore the saved location on mount. GPS is requested only after the
  // customer taps the first-launch prompt (browser permission requires a gesture).
  useEffect(() => {
    const parsed = getJSON(STORAGE_KEY, null);
    const addressName = parsed?.address || parsed?.name;
    if (parsed && addressName) {
      updateLocation(
        {
          name: addressName,
          time: parsed.time || "12-15 mins",
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        },
        { persist: false, updateSavedHome: false },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic delivery ETA for the selected location.
  //
  // The header used to show a hard-coded "12-15 mins" regardless of where the
  // customer was. Whenever the coordinates change we ask the server for the
  // distance-derived promise from the nearest store that actually serves the
  // point, and patch `time` in place — every existing `updateLocation` call
  // site keeps working, its placeholder is simply corrected a moment later.
  //
  // We only touch `time`, never the coordinates, so this can never feed back
  // into itself.
  useEffect(() => {
    const lat = currentLocation?.latitude;
    const lng = currentLocation?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    let cancelled = false;
    customerApi
      .getDeliveryEta(lat, lng)
      .then((res) => {
        if (cancelled || !res.data?.success) return;
        const label = res.data.result?.eta?.label;
        if (!label) return;
        setCurrentLocation((prev) => (prev.time === label ? prev : { ...prev, time: label }));
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const locationValue = useMemo(() => ({
    currentLocation,
    savedAddresses,
    updateLocation,
    addAddress,
    refreshAddresses,
    isFetchingLocation,
    locationError,
    refreshLocation: fetchAndCacheLocation,
    showLocationPrompt,
    requestLocationPermission,
    dismissLocationPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentLocation, savedAddresses, isFetchingLocation, locationError, refreshAddresses]);

  return (
    <LocationContext.Provider value={locationValue}>
      {children}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
          <section
            aria-labelledby="location-permission-title"
            aria-describedby="location-permission-description"
            aria-modal="true"
            role="dialog"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <span aria-hidden="true" className="text-2xl">⌖</span>
            </div>
            <h2 id="location-permission-title" className="text-xl font-bold text-slate-900">
              {locationPromptReason === "denied"
                ? "Location access is blocked"
                : locationPromptReason === "gps_off"
                  ? "Your location is turned off"
                  : "Turn on your location"}
            </h2>
            <p id="location-permission-description" className="mt-2 text-sm leading-6 text-slate-600">
              {locationPromptReason === "denied"
                ? "Allow location for this app in your phone or browser settings (Settings → Apps / Site settings → Location → Allow), then tap Try again."
                : locationPromptReason === "gps_off"
                  ? "Turn on Location (GPS) from your phone's quick settings, then tap Try again so we can show shops near you."
                  : "Allow location so we can show shops near you and deliver to the right place."}
            </p>
            <button
              type="button"
              onClick={requestLocationPermission}
              disabled={isFetchingLocation}
              className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {isFetchingLocation
                ? "Checking location…"
                : locationPromptReason === "permission"
                  ? "Allow location"
                  : "Try again"}
            </button>
            <button
              type="button"
              onClick={dismissLocationPrompt}
              className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Not now
            </button>
          </section>
        </div>
      )}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
