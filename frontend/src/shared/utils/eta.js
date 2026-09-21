/**
 * Single source of truth for every "arriving in / estimated time / distance"
 * figure shown to customers and riders.
 *
 * Before this existed each screen carried its own copy of the maths and got
 * different things wrong:
 *   - a routed duration was fetched once and then treated as constant, so
 *     "arriving in 12 mins" stayed at 12 while the rider rode towards you
 *     (and the clock time drifted later every tick);
 *   - raw seconds / metres from the route API were printed as if they were
 *     "mins" / "km";
 *   - straight-line distance was divided by a road speed, under-quoting ~30%;
 *   - invented numbers ("8 mins", "15-20 mins") were shown when data was
 *     missing.
 *
 * Everything here is pure (no React, no I/O) and returns `null` / "--" rather
 * than a made-up number when it genuinely cannot estimate.
 */

/** Straight-line distance is shorter than the road; typical town detour. */
export const ROAD_DETOUR_FACTOR = 1.3;
/** ~24 km/h average bike speed through town, in minutes per ROAD km. */
export const MINUTES_PER_ROAD_KM = 2.5;
/**
 * Minutes per STRAIGHT-LINE km. Matches the backend checkout quote default
 * (`deliveryEta.minutesPerKm`) so a live estimate never contradicts the promise.
 */
export const MINUTES_PER_STRAIGHT_KM = 3;
/** Time at the pickup point (counter / handover) between arriving and leaving. */
export const PICKUP_HANDOVER_MINUTES = 2;

export const hasValidLatLng = (p) =>
  !!p &&
  typeof p.lat === "number" &&
  typeof p.lng === "number" &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng);

/** Accepts `{lat,lng}` or a GeoJSON `[lng, lat]` array; returns `{lat,lng}` or null. */
export const toLatLng = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    const p = { lat: Number(lat), lng: Number(lng) };
    return hasValidLatLng(p) ? p : null;
  }
  if (value && value.coordinates) return toLatLng(value.coordinates);
  if (value) {
    const p = { lat: Number(value.lat), lng: Number(value.lng) };
    return hasValidLatLng(p) ? p : null;
  }
  return null;
};

const toRad = (v) => (v * Math.PI) / 180;

export const haversineMeters = (from, to) => {
  if (!hasValidLatLng(from) || !hasValidLatLng(to)) return null;
  const r = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ------------------------------ formatting ------------------------------ */

export const formatArrivalTime = (arrivalMs) =>
  new Date(arrivalMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** "1 min" · "8 mins" · "1 hr 5 mins". Never returns 0 mins. */
export const formatArrivingIn = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return "Soon";
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min${total === 1 ? "" : "s"}`;
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  const hrLabel = `${hrs} hr${hrs === 1 ? "" : "s"}`;
  return mins ? `${hrLabel} ${mins} min${mins === 1 ? "" : "s"}` : hrLabel;
};

export const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
};

/* ------------------------------ estimation ------------------------------ */

/** Straight-line metres -> minutes on the road. */
export const minutesForStraightMeters = (meters) =>
  Number.isFinite(meters) && meters > 0
    ? (meters / 1000) * ROAD_DETOUR_FACTOR * MINUTES_PER_ROAD_KM
    : null;

/** Road metres -> minutes. */
export const minutesForRoadMeters = (meters) =>
  Number.isFinite(meters) && meters > 0 ? (meters / 1000) * MINUTES_PER_ROAD_KM : null;

const routeDistance = (route) => {
  const d = Number(route?.distanceMeters ?? route?.distance);
  return Number.isFinite(d) && d > 0 ? d : null;
};

const routeDuration = (route) => {
  const s = Number(route?.duration ?? route?.routeDurationSeconds);
  return Number.isFinite(s) && s > 0 ? s : null;
};

/**
 * Minutes left on ONE routed leg (rider -> `dest`), kept live from GPS.
 *
 * A routed duration is a snapshot: it was true where the rider stood when the
 * route was requested. Re-quoting it verbatim is what made the ETA stall.
 * Instead we recover the route's own average speed and road/straight ratio from
 * that snapshot and apply them to how far the rider is from `dest` right now —
 * so the figure counts down as the rider moves, with no extra Directions call.
 *
 * Returns `{ minutes, meters }` or null when nothing sensible can be said.
 */
export const liveLegEstimate = ({ route, rider, dest }) => {
  const durSec = routeDuration(route);
  const distM = routeDistance(route);
  const straightNow = haversineMeters(rider, dest);

  if (durSec && distM) {
    // No live position (or dest unknown): the snapshot is all we have.
    if (straightNow == null) return { minutes: durSec / 60, meters: distM };

    const origin = toLatLng(route?.origin);
    const straightAtQuote = origin ? haversineMeters(origin, dest) : null;
    const detour =
      straightAtQuote && straightAtQuote > 50
        ? Math.min(3, Math.max(1, distM / straightAtQuote))
        : ROAD_DETOUR_FACTOR;

    const speedMps = distM / durSec;
    const remainingM = straightNow * detour;
    return { minutes: remainingM / speedMps / 60, meters: remainingM };
  }

  if (straightNow != null) {
    const meters = straightNow * ROAD_DETOUR_FACTOR;
    return { minutes: minutesForStraightMeters(straightNow), meters };
  }
  return null;
};

/** Straight-line trip estimate between two fixed points (no rider involved). */
export const tripEstimate = (from, to) => {
  const straight = haversineMeters(from, to);
  if (straight == null) return null;
  return {
    minutes: minutesForStraightMeters(straight),
    meters: straight * ROAD_DETOUR_FACTOR,
  };
};

/**
 * What the customer should see.
 *
 * `phase === "pickup"`: the rider is still heading to the pickup, so the honest
 * "arriving in" is the WHOLE remaining job — rider -> pickup, handover, then
 * pickup -> customer. Showing only rider -> pickup made a rider 4 minutes from
 * the shop look like "arriving in 4 mins" at your door.
 * `phase === "delivery"`: rider -> customer.
 *
 * With no live rider position it falls back to the promise frozen at placement
 * (`quote`), counted down against the clock — never an invented number.
 */
export const computeCustomerEta = ({
  phase,
  rider,
  pickup,
  drop,
  route,
  quote,
  now = Date.now(),
}) => {
  const empty = {
    minutes: null,
    arrivalMs: null,
    arrivalTimeText: "--",
    arrivingInText: "--",
    totalDistanceText: "—",
    pickupInText: null,
    source: "none",
  };

  const finish = (minutes, meters, extra = {}) => {
    const arrivalMs = now + minutes * 60 * 1000;
    return {
      minutes,
      arrivalMs,
      arrivalTimeText: formatArrivalTime(arrivalMs),
      arrivingInText: formatArrivingIn(minutes),
      totalDistanceText: formatDistance(meters),
      pickupInText: null,
      source: "live",
      ...extra,
    };
  };

  if (hasValidLatLng(rider)) {
    if (phase === "delivery" && hasValidLatLng(drop)) {
      const leg = liveLegEstimate({ route, rider, dest: drop });
      if (leg && Number.isFinite(leg.minutes)) return finish(leg.minutes, leg.meters);
    }

    if (phase !== "delivery" && hasValidLatLng(pickup)) {
      const toPickup = liveLegEstimate({ route, rider, dest: pickup });
      if (toPickup && Number.isFinite(toPickup.minutes)) {
        const dropLeg = hasValidLatLng(drop) ? tripEstimate(pickup, drop) : null;
        const total =
          toPickup.minutes + PICKUP_HANDOVER_MINUTES + (dropLeg?.minutes || 0);
        return finish(total, toPickup.meters + (dropLeg?.meters || 0), {
          pickupInText: formatArrivingIn(toPickup.minutes),
        });
      }
    }
  }

  // No rider yet: count the frozen checkout promise down against the clock.
  const quotedAt = quote?.quotedAt ? new Date(quote.quotedAt).getTime() : NaN;
  const qMin = Number(quote?.minMinutes);
  const qMax = Number(quote?.maxMinutes);
  if (Number.isFinite(quotedAt) && Number.isFinite(qMin) && Number.isFinite(qMax)) {
    const targetMs = quotedAt + ((qMin + qMax) / 2) * 60 * 1000;
    const minutes = (targetMs - now) / 60000;
    if (minutes > 0) {
      return {
        ...finish(minutes, null),
        totalDistanceText: quote?.distanceKm ? `${Number(quote.distanceKm).toFixed(1)} km` : "—",
        source: "quote",
      };
    }
    // Promise window has elapsed and we still have no rider fix.
    return { ...empty, arrivingInText: "Soon", source: "quote" };
  }

  return empty;
};

/**
 * What the rider should see for their CURRENT leg only (to pickup, or to drop) —
 * riders navigate one leg at a time, so no handover/second-leg padding.
 */
export const computeRiderEta = ({ rider, dest, route, now = Date.now() }) => {
  const leg = liveLegEstimate({ route, rider, dest });
  if (!leg || !Number.isFinite(leg.minutes)) {
    return {
      minutes: null,
      arrivalTimeText: "--",
      arrivingInText: "--",
      totalDistanceText: "—",
    };
  }
  const arrivalMs = now + leg.minutes * 60 * 1000;
  return {
    minutes: leg.minutes,
    arrivalTimeText: formatArrivalTime(arrivalMs),
    arrivingInText: formatArrivingIn(leg.minutes),
    totalDistanceText: formatDistance(leg.meters),
  };
};
