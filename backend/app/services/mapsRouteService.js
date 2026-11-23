import { getRedisClient } from "../config/redis.js";
import { writeRoutePolyline, getRoutePolyline } from "./firebaseService.js";
import { distanceMeters } from "../utils/geoUtils.js";
import logger from "./logger.js";

const ROUTE_CACHE_TTL_SEC = () =>
  parseInt(process.env.ROUTE_CACHE_TTL_SEC || "900", 10);
const ROUTE_CACHE_MATCH_THRESHOLD_M = () =>
  parseInt(process.env.ROUTE_CACHE_MATCH_THRESHOLD_METERS || "150", 10);

const FIREBASE_CACHE_TIMEOUT_MS = 1500;

/** Resolve `fallback` if `promise` hasn't settled within `ms`. */
function withTimeout(promise, ms, fallback = null) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function roundCoord(n) {
  return Math.round(n * 1e5) / 1e5;
}

/** Bump when route payload shape changes (invalidates Redis entries). */
function cacheKey(origin, dest, mode) {
  return `route:v4:${roundCoord(origin.lat)},${roundCoord(origin.lng)}:${roundCoord(dest.lat)},${roundCoord(dest.lng)}:${mode}`;
}

/* ------------------------------------------------------------------
 * Google Routes API (computeRoutes).
 *
 * Replaces the legacy Directions API, which Google no longer enables for new
 * projects ("You're calling a legacy API, which is not enabled for your
 * project"). Requires "Routes API" enabled for GOOGLE_MAPS_API_KEY.
 * ------------------------------------------------------------------ */

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const TRAVEL_MODES = {
  driving: "DRIVE",
  walking: "WALK",
  bicycling: "BICYCLE",
  two_wheeler: "TWO_WHEELER",
  transit: "TRANSIT",
};

let lastRouteErrorLogAt = 0;
/** Log Google's real error (at most once a minute) instead of failing silently. */
function logRouteError(message) {
  const now = Date.now();
  if (now - lastRouteErrorLogAt < 60000) return;
  lastRouteErrorLogAt = now;
  logger.warn("Google Routes API request failed", {
    scope: "mapsRouteService",
    error: message,
  });
}

/** "123s" -> 123 */
function parseDurationSeconds(value) {
  const n = parseFloat(String(value || "").replace(/s$/, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Routes `viewport` -> Directions-style `bounds` (kept for payload compatibility). */
function viewportToBounds(viewport) {
  if (!viewport?.low || !viewport?.high) return null;
  return {
    southwest: { lat: viewport.low.latitude, lng: viewport.low.longitude },
    northeast: { lat: viewport.high.latitude, lng: viewport.high.longitude },
  };
}

/**
 * One route from the Routes API.
 * @returns {Promise<{polyline:string, distanceMeters:number|null, duration:number|null, bounds:object|null}|null>}
 */
async function computeRoute(origin, dest, mode, apiKey) {
  const travelMode = TRAVEL_MODES[mode] || "DRIVE";
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
    travelMode,
    // Full road geometry (the old code merged step polylines for the same reason).
    polylineQuality: "HIGH_QUALITY",
  };
  if (travelMode === "DRIVE" || travelMode === "TWO_WHEELER") {
    body.routingPreference = "TRAFFIC_UNAWARE"; // basic (cheapest) billing tier
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.viewport",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      logRouteError(
        `${resp.status} ${data?.error?.status || ""}: ${data?.error?.message || "unknown error"}`,
      );
      return null;
    }

    const route = data?.routes?.[0];
    const encoded = route?.polyline?.encodedPolyline;
    if (!encoded) {
      logRouteError("No route returned between these points");
      return null;
    }

    return {
      polyline: encoded,
      distanceMeters: Number.isFinite(route.distanceMeters) ? route.distanceMeters : null,
      duration: parseDurationSeconds(route.duration),
      bounds: viewportToBounds(route.viewport),
    };
  } catch (err) {
    logRouteError(err?.name === "AbortError" ? "Request timed out" : err?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Payload returned when no route could be fetched (map shows the "Route unavailable" note).
 */
function degradedPayload() {
  return { polyline: null, bounds: null, distanceMeters: null, duration: null, degraded: true };
}

function hasValidPoint(point) {
  return (
    point &&
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

function isRouteCacheCompatible(cached, origin, dest, phase, mode) {
  if (!cached?.polyline) return false;
  if ((cached.phase || "pickup") !== phase) return false;
  if ((cached.mode || "driving") !== mode) return false;
  if (!hasValidPoint(origin) || !hasValidPoint(dest)) return false;
  if (!hasValidPoint(cached.origin) || !hasValidPoint(cached.destination)) {
    return false;
  }

  const originDrift = distanceMeters(
    origin.lat,
    origin.lng,
    cached.origin.lat,
    cached.origin.lng,
  );
  const destDrift = distanceMeters(
    dest.lat,
    dest.lng,
    cached.destination.lat,
    cached.destination.lng,
  );

  const threshold = Math.max(25, ROUTE_CACHE_MATCH_THRESHOLD_M());
  return originDrift <= threshold && destDrift <= threshold;
}

/**
 * Returns { polyline, bounds, distanceMeters, degraded } from the Google Routes API with Redis + Firebase cache.
 * Requires GOOGLE_MAPS_API_KEY and "Routes API" enabled in Google Cloud (billing on).
 * Does not cache failed or empty routes so fixing the key takes effect immediately.
 * 
 * @param {Object} origin - { lat, lng }
 * @param {Object} dest - { lat, lng }
 * @param {string} mode - "driving" | "walking" | "bicycling" | "transit"
 * @param {string} orderId - Optional order ID for Firebase caching
 * @param {string} phase - "pickup" | "delivery"
 */
export async function getCachedRoute(origin, dest, mode = "driving", orderId = null, phase = "pickup") {
  // Try Firebase cache first if orderId is provided
  if (orderId) {
    try {
      // Bounded: an unreachable Realtime Database makes `once('value')` wait
      // forever, which used to hang every route request.
      const firebaseRoute = await withTimeout(
        getRoutePolyline(orderId),
        FIREBASE_CACHE_TIMEOUT_MS,
      );
      const cachedPhase = firebaseRoute?.phase || "pickup";
      if (isRouteCacheCompatible(firebaseRoute, origin, dest, phase, mode)) {
        return {
          polyline: firebaseRoute.polyline,
          bounds: firebaseRoute.bounds,
          distanceMeters: firebaseRoute.distance,
          duration: firebaseRoute.duration,
          degraded: false,
          source: 'firebase',
          phase: cachedPhase,
        };
      }
    } catch {
      /* ignore firebase cache errors */
    }
  }

  // Try Redis cache
  const redis = getRedisClient();
  const key = cacheKey(origin, dest, mode);
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.polyline && !parsed.degraded) {
          return { ...parsed, source: 'redis', phase };
        }
      }
    } catch {
      /* ignore */
    }
  }

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!apiKey) {
    return degradedPayload();
  }

  try {
    const route = await computeRoute(origin, dest, mode, apiKey);
    if (!route) {
      return degradedPayload();
    }
    const { polyline, distanceMeters, duration, bounds } = route;

    const payload = {
      polyline,
      bounds,
      distanceMeters,
      duration,
      degraded: false,
      source: 'api',
      phase,
    };

    // Cache in Redis
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(payload), "EX", ROUTE_CACHE_TTL_SEC());
      } catch {
        /* ignore */
      }
    }

    // Cache in Firebase if orderId is provided. Fire-and-forget: an RTDB write
    // only resolves once the server acknowledges it, so awaiting it would hang
    // the response whenever Firebase is unreachable.
    if (orderId) {
      writeRoutePolyline(orderId, {
        polyline,
        phase,
        origin,
        destination: dest,
        mode,
        bounds: route?.bounds || null,
        distance: distanceMeters,
        duration,
      }).catch(() => {
        /* ignore firebase write errors */
      });
    }

    return payload;
  } catch {
    return degradedPayload();
  }
}
