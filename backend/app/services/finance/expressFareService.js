import Setting from "../../models/setting.js";
import { calculateDeliveryEta } from "../deliveryEtaService.js";
import { getCachedRoute } from "../mapsRouteService.js";
import Seller from "../../models/seller.js";
import { distanceMeters } from "../../utils/geoUtils.js";
import { roundCurrency, addMoney, ceilKm } from "../../utils/money.js";

/**
 * Athreya Express fare engine.
 *
 * One pure function (`calculateExpressFare`) produces the customer fare AND the
 * rider payout from the admin-managed fare table. The booking screen quote, the
 * amount charged at placement and the rider's payout all call it, so they can
 * never drift apart (the booking screen used to hard-code its own formula and
 * showed a different number than the server charged).
 *
 *   distanceFare   = ceil(max(0, km - baseDistanceKm)) * perKmRate
 *   subtotal       = baseFare + distanceFare + weightSurcharge + serviceFee + nightCharge
 *   surge          = subtotal * (surgeMultiplier - 1)
 *   total          = max(subtotal + surge, minimumFare)
 *
 *   riderPayout    = rider.basePayout + extraKm * rider.perKmPayout
 *                    + surchargeShare% of (weight + service + night + surge)
 */

export const EXPRESS_SERVICE_KEYS = [
  "home_to_home",
  "shop_to_home",
  "cargo_to_home",
  "rider_delivery",
];

/** Order matters: mirrors the weight picker in the customer booking screen. */
export const EXPRESS_WEIGHT_BANDS = [
  { key: "upTo1Kg", label: "Up to 1 kg" },
  { key: "kg1To3", label: "1-3 kg" },
  { key: "kg3To5", label: "3-5 kg" },
  { key: "kg5To10", label: "5-10 kg" },
  { key: "kg10Plus", label: "10-25 kg" },
  { key: "kg25Plus", label: "25 kg+" },
];

/** Rider requests carry a task, not a parcel weight. */
const WEIGHT_APPLIES_TO = new Set(["home_to_home", "shop_to_home", "cargo_to_home"]);

export const DEFAULT_EXPRESS_FARE = {
  enabled: true,
  baseFare: 30,
  baseDistanceKm: 1,
  perKmRate: 10,
  minimumFare: 30,
  surgeMultiplier: 1,
  nightCharge: { enabled: false, startHour: 22, endHour: 6, amount: 20 },
  // Zero by default so switching the fare table on never silently reprices
  // parcels; admin opts in per band.
  weightSurcharge: { upTo1Kg: 0, kg1To3: 0, kg3To5: 0, kg5To10: 0, kg10Plus: 0, kg25Plus: 0 },
  // Each service can override the global fare table. null = use the global value.
  services: {
    home_to_home: { enabled: true, serviceFee: 0, baseFare: null, baseDistanceKm: null, perKmRate: null, minimumFare: null },
    shop_to_home: { enabled: true, serviceFee: 0, baseFare: null, baseDistanceKm: null, perKmRate: null, minimumFare: null },
    cargo_to_home: { enabled: true, serviceFee: 0, baseFare: null, baseDistanceKm: null, perKmRate: null, minimumFare: null },
    rider_delivery: { enabled: true, serviceFee: 0, baseFare: null, baseDistanceKm: null, perKmRate: null, minimumFare: null },
  },
  // Service area: farthest pickup -> drop distance Express will accept (0 = no limit).
  maxDistanceKm: 0,
  // Straight-line km x this = billed/shown km (1.3 approximates road distance).
  distanceFactor: 1,
  // Rider booking timing, controlled by admin.
  schedule: {
    instantEnabled: true,
    scheduleEnabled: true,
    minLeadMinutes: 30, // earliest a scheduled booking may be, from now
    maxDaysAhead: 0, // 0 = today only
    windowStart: "07:00", // scheduled pickups only between these India times
    windowEnd: "22:00",
  },
  // Delivery-time promise for Express: minutes = base + km x minutesPerKm.
  eta: { basePrepMinutes: 10, minutesPerKm: 3, rangeSpreadMinutes: 5, minMinutes: 10, maxMinutes: 180 },
  rider: { basePayout: 30, perKmPayout: 5, surchargeSharePercent: 100 },
};

const num = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const bool = (value, fallback) => (value === undefined || value === null ? fallback : !!value);

/** Coerces any partial / dirty document into a complete, clamped fare table. */
export function normalizeExpressFareSettings(raw = {}) {
  const src = raw?.expressFare && typeof raw.expressFare === "object" ? raw.expressFare : raw || {};
  const d = DEFAULT_EXPRESS_FARE;

  const services = {};
  for (const key of EXPRESS_SERVICE_KEYS) {
    const s = src.services?.[key] || {};
    const opt = (v, round) =>
      v === null || v === undefined || v === "" ? null : round ? roundCurrency(num(v, 0)) : num(v, 0);
    services[key] = {
      enabled: bool(s.enabled, d.services[key].enabled),
      serviceFee: roundCurrency(num(s.serviceFee, d.services[key].serviceFee)),
      baseFare: opt(s.baseFare, true),
      baseDistanceKm: opt(s.baseDistanceKm, false),
      perKmRate: opt(s.perKmRate, true),
      minimumFare: opt(s.minimumFare, true),
    };
  }

  const weightSurcharge = {};
  for (const { key } of EXPRESS_WEIGHT_BANDS) {
    weightSurcharge[key] = roundCurrency(num(src.weightSurcharge?.[key], d.weightSurcharge[key]));
  }

  return {
    enabled: bool(src.enabled, d.enabled),
    baseFare: roundCurrency(num(src.baseFare, d.baseFare)),
    baseDistanceKm: num(src.baseDistanceKm, d.baseDistanceKm),
    perKmRate: roundCurrency(num(src.perKmRate, d.perKmRate)),
    minimumFare: roundCurrency(num(src.minimumFare, d.minimumFare)),
    surgeMultiplier: num(src.surgeMultiplier, d.surgeMultiplier, { min: 1, max: 5 }),
    nightCharge: {
      enabled: bool(src.nightCharge?.enabled, d.nightCharge.enabled),
      startHour: Math.round(num(src.nightCharge?.startHour, d.nightCharge.startHour, { max: 23 })),
      endHour: Math.round(num(src.nightCharge?.endHour, d.nightCharge.endHour, { max: 23 })),
      amount: roundCurrency(num(src.nightCharge?.amount, d.nightCharge.amount)),
    },
    weightSurcharge,
    services,
    schedule: {
      instantEnabled: bool(src.schedule?.instantEnabled, d.schedule.instantEnabled),
      scheduleEnabled: bool(src.schedule?.scheduleEnabled, d.schedule.scheduleEnabled),
      minLeadMinutes: Math.round(num(src.schedule?.minLeadMinutes, d.schedule.minLeadMinutes, { max: 1440 })),
      maxDaysAhead: Math.round(num(src.schedule?.maxDaysAhead, d.schedule.maxDaysAhead, { max: 30 })),
      windowStart: HHMM.test(src.schedule?.windowStart || "") ? src.schedule.windowStart : d.schedule.windowStart,
      windowEnd: HHMM.test(src.schedule?.windowEnd || "") ? src.schedule.windowEnd : d.schedule.windowEnd,
    },
    maxDistanceKm: num(src.maxDistanceKm, d.maxDistanceKm, { max: 1000 }),
    distanceFactor: num(src.distanceFactor, d.distanceFactor, { min: 1, max: 3 }),
    eta: {
      basePrepMinutes: num(src.eta?.basePrepMinutes, d.eta.basePrepMinutes, { max: 600 }),
      minutesPerKm: num(src.eta?.minutesPerKm, d.eta.minutesPerKm, { max: 60 }),
      rangeSpreadMinutes: Math.round(num(src.eta?.rangeSpreadMinutes, d.eta.rangeSpreadMinutes, { max: 240 })),
      minMinutes: Math.max(1, Math.round(num(src.eta?.minMinutes, d.eta.minMinutes, { max: 1440 }))),
      maxMinutes: Math.max(1, Math.round(num(src.eta?.maxMinutes, d.eta.maxMinutes, { max: 1440 }))),
    },
    rider: {
      basePayout: roundCurrency(num(src.rider?.basePayout, d.rider.basePayout)),
      perKmPayout: roundCurrency(num(src.rider?.perKmPayout, d.rider.perKmPayout)),
      surchargeSharePercent: num(src.rider?.surchargeSharePercent, d.rider.surchargeSharePercent, {
        max: 100,
      }),
    },
    updatedAt: src.updatedAt || null,
    updatedBy: src.updatedBy || null,
  };
}

export async function getExpressFareSettings({ session = null } = {}) {
  try {
    const query = Setting.findOne({}, { expressFare: 1 }).lean();
    if (session) query.session(session);
    return normalizeExpressFareSettings((await query) || {});
  } catch {
    // A settings read must never be the reason a booking fails.
    return normalizeExpressFareSettings({});
  }
}

/**
 * Persist the fare table. Merges onto the current values before normalising, so
 * a partial payload (one field edited) can't blank the rest.
 */
export async function saveExpressFareSettings(patch = {}, { updatedBy = null } = {}) {
  const current = await getExpressFareSettings();
  const merged = {
    ...current,
    ...patch,
    nightCharge: { ...current.nightCharge, ...(patch.nightCharge || {}) },
    weightSurcharge: { ...current.weightSurcharge, ...(patch.weightSurcharge || {}) },
    rider: { ...current.rider, ...(patch.rider || {}) },
    eta: { ...current.eta, ...(patch.eta || {}) },
    schedule: { ...current.schedule, ...(patch.schedule || {}) },
    services: Object.fromEntries(
      EXPRESS_SERVICE_KEYS.map((k) => [
        k,
        { ...current.services[k], ...(patch.services?.[k] || {}) },
      ]),
    ),
  };
  const next = normalizeExpressFareSettings(merged);
  next.updatedAt = new Date();
  next.updatedBy = updatedBy ? String(updatedBy) : null;

  await Setting.findOneAndUpdate({}, { $set: { expressFare: next } }, { upsert: true, new: true });
  return next;
}

/** Matches the label the customer picked ("1-3 kg") to a configured band. */
export function resolveWeightBand(weight) {
  if (!weight) return null;
  const text = String(weight).trim().toLowerCase();
  // "10 kg+" was the top band before 25 kg+ existed; keep it priced as 10-25 kg.
  if (text === "10 kg+") return EXPRESS_WEIGHT_BANDS.find((b) => b.key === "kg10Plus");
  return EXPRESS_WEIGHT_BANDS.find((b) => b.label.toLowerCase() === text) || null;
}

/** Hour of day in India, independent of the server's timezone. */
function istHour(at) {
  try {
    const h = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }).format(at);
    const n = Number(h);
    return Number.isFinite(n) ? n : at.getUTCHours();
  } catch {
    return at.getUTCHours();
  }
}

export function isNightHour(at, night) {
  if (!night?.enabled) return false;
  const h = istHour(at);
  const { startHour, endHour } = night;
  if (startHour === endHour) return false;
  // 22 -> 6 wraps past midnight.
  return startHour < endHour ? h >= startHour && h < endHour : h >= startHour || h < endHour;
}

export function isExpressServiceEnabled(settings, service) {
  const cfg = normalizeExpressFareSettings(settings);
  return cfg.services[service]?.enabled !== false;
}

/**
 * @returns {{
 *   total:number, baseFare:number, distanceFare:number, extraKm:number,
 *   weightSurcharge:number, weightBand:string|null, serviceFee:number,
 *   nightCharge:number, surgeAmount:number, minimumFareTopUp:number,
 *   distanceKm:number, service:string,
 *   rider:{ base:number, distance:number, surchargeShare:number, total:number }
 * }}
 */
export function calculateExpressFare({
  distanceKm = 0,
  service = "home_to_home",
  weight = null,
  settings = DEFAULT_EXPRESS_FARE,
  at = new Date(),
} = {}) {
  const cfg = normalizeExpressFareSettings(settings);
  const dist = Math.max(0, Number(distanceKm) || 0);

  // Per-service charges fall back to the global table when left blank.
  const svc = cfg.services[service] || {};
  const baseFareCfg = svc.baseFare ?? cfg.baseFare;
  const baseDistanceCfg = svc.baseDistanceKm ?? cfg.baseDistanceKm;
  const perKmCfg = svc.perKmRate ?? cfg.perKmRate;
  const minimumFareCfg = svc.minimumFare ?? cfg.minimumFare;

  const extraKm = dist > baseDistanceCfg ? ceilKm(dist - baseDistanceCfg) : 0;
  const distanceFare = roundCurrency(extraKm * perKmCfg);

  const band = WEIGHT_APPLIES_TO.has(service) ? resolveWeightBand(weight) : null;
  const weightSurcharge = band ? cfg.weightSurcharge[band.key] : 0;

  const serviceFee = cfg.services[service]?.serviceFee || 0;
  const nightCharge = isNightHour(at, cfg.nightCharge) ? cfg.nightCharge.amount : 0;

  const subtotal = addMoney(baseFareCfg, distanceFare, weightSurcharge, serviceFee, nightCharge);
  const surgeAmount =
    cfg.surgeMultiplier > 1 ? roundCurrency(subtotal * (cfg.surgeMultiplier - 1)) : 0;
  const beforeMinimum = addMoney(subtotal, surgeAmount);
  const total = Math.max(beforeMinimum, minimumFareCfg);
  const minimumFareTopUp = roundCurrency(total - beforeMinimum);

  const surchargePool = addMoney(weightSurcharge, serviceFee, nightCharge, surgeAmount);
  const surchargeShare = roundCurrency((surchargePool * cfg.rider.surchargeSharePercent) / 100);
  const riderDistance = roundCurrency(extraKm * cfg.rider.perKmPayout);

  return {
    service,
    distanceKm: Number(dist.toFixed(3)),
    extraKm,
    baseFare: baseFareCfg,
    distanceFare,
    weightBand: band ? band.label : null,
    weightSurcharge,
    serviceFee,
    nightCharge,
    surgeAmount,
    minimumFareTopUp,
    total: roundCurrency(total),
    rider: {
      base: cfg.rider.basePayout,
      distance: riderDistance,
      surchargeShare,
      total: addMoney(cfg.rider.basePayout, riderDistance, surchargeShare),
    },
  };
}

/**
 * Straight-line pickup -> drop distance in km, exactly as placement measures it.
 * Falls back to seller -> drop when the pickup point has no coordinates. Shared
 * by the quote endpoint and placement so both bill the same distance.
 */
export async function resolveExpressDistanceKm(args = {}) {
  return (await resolveExpressDistance(args)).km;
}

/**
 * Billed distance. Uses the real ROAD distance from Google Directions (what
 * Google Maps shows) when both points are known and the API answers; otherwise
 * falls back to the straight-line distance x the admin "road distance factor".
 * Quote and placement both call this, so the customer is charged what was shown.
 */
export async function resolveExpressDistance({ pickupAddress, address, sellerId, factor = 1 } = {}) {
  const valid = (x) =>
    x && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng));
  const p = pickupAddress?.location;
  const a = address?.location;
  if (valid(p) && valid(a)) {
    try {
      const route = await Promise.race([
        getCachedRoute(
          { lat: Number(p.lat), lng: Number(p.lng) },
          { lat: Number(a.lat), lng: Number(a.lng) },
          "driving",
        ),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (route && !route.degraded && Number(route.distanceMeters) > 0) {
        return {
          km: Number((route.distanceMeters / 1000).toFixed(3)),
          source: "road",
          routeMinutes: route.duration ? Math.round(route.duration / 60) : null,
        };
      }
    } catch {
      /* fall back to straight line */
    }
  }
  const k = Math.max(Number(factor) || 1, 1);
  const raw = await measureExpressDistanceKm({ pickupAddress, address, sellerId });
  return { km: Number((raw * k).toFixed(3)), source: "straight", routeMinutes: null };
}

async function measureExpressDistanceKm({ pickupAddress, address, sellerId } = {}) {
  const p = pickupAddress?.location;
  const a = address?.location;
  const valid = (x) =>
    x && typeof x.lat === "number" && typeof x.lng === "number" && Number.isFinite(x.lat) && Number.isFinite(x.lng);

  if (valid(p) && valid(a)) {
    return Number((distanceMeters(Number(p.lat), Number(p.lng), Number(a.lat), Number(a.lng)) / 1000).toFixed(3));
  }
  if (!valid(a) || !sellerId) return 0;

  const seller = await Seller.findById(sellerId).select("location").lean();
  const coords = seller?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  const [lng, lat] = coords;
  return Number((distanceMeters(Number(a.lat), Number(a.lng), Number(lat), Number(lng)) / 1000).toFixed(3));
}

/**
 * Validates a rider booking's timing against the admin schedule rules.
 * Returns an error message, or null when the booking is allowed.
 */
export function validateExpressTiming({ timing, scheduledAt, settings, now = new Date() } = {}) {
  const sc = normalizeExpressFareSettings(settings).schedule;
  if (timing !== "scheduled") {
    return sc.instantEnabled ? null : "Instant rider booking is currently unavailable. Please schedule a time.";
  }
  if (!sc.scheduleEnabled) return "Scheduling is currently unavailable. Please book an instant rider.";
  const when = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(when.getTime())) return "Please choose a valid pickup time.";
  if (when.getTime() < now.getTime() + sc.minLeadMinutes * 60000) {
    return `Pick a time at least ${sc.minLeadMinutes} minutes from now.`;
  }
  const istNow = new Date(now.getTime() + 5.5 * 3600000);
  const istWhen = new Date(when.getTime() + 5.5 * 3600000);
  const dayDiff = Math.round(
    (Date.UTC(istWhen.getUTCFullYear(), istWhen.getUTCMonth(), istWhen.getUTCDate()) -
      Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())) / 86400000,
  );
  if (dayDiff > sc.maxDaysAhead) {
    return sc.maxDaysAhead === 0
      ? "Scheduled pickups can only be booked for today."
      : `Scheduled pickups can be booked up to ${sc.maxDaysAhead} day(s) ahead.`;
  }
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const mins = istWhen.getUTCHours() * 60 + istWhen.getUTCMinutes();
  if (mins < toMin(sc.windowStart) || mins > toMin(sc.windowEnd)) {
    return `Scheduled pickups are available between ${sc.windowStart} and ${sc.windowEnd}.`;
  }
  return null;
}

/** Express delivery-time promise from the admin 'eta' settings (per-km timing). */
export function estimateExpressEta(distanceKm, settings) {
  const cfg = normalizeExpressFareSettings(settings);
  return calculateDeliveryEta({ distanceKm, settings: cfg.eta });
}

/** Is this trip inside the admin-set service radius? (0 = unlimited) */
export function isWithinExpressRadius(distanceKm, settings) {
  const cfg = normalizeExpressFareSettings(settings);
  return cfg.maxDistanceKm <= 0 || Number(distanceKm) <= cfg.maxDistanceKm;
}

export default {
  resolveExpressDistance,
  validateExpressTiming,
  estimateExpressEta,
  isWithinExpressRadius,
  calculateExpressFare,
  getExpressFareSettings,
  saveExpressFareSettings,
  normalizeExpressFareSettings,
  resolveExpressDistanceKm,
  resolveWeightBand,
  isExpressServiceEnabled,
  isNightHour,
  DEFAULT_EXPRESS_FARE,
  EXPRESS_SERVICE_KEYS,
  EXPRESS_WEIGHT_BANDS,
};
