import Setting from "../../models/setting.js";
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
  { key: "kg10Plus", label: "10 kg+" },
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
  weightSurcharge: { upTo1Kg: 0, kg1To3: 0, kg3To5: 0, kg5To10: 0, kg10Plus: 0 },
  services: {
    home_to_home: { enabled: true, serviceFee: 0 },
    shop_to_home: { enabled: true, serviceFee: 0 },
    cargo_to_home: { enabled: true, serviceFee: 0 },
    rider_delivery: { enabled: true, serviceFee: 0 },
  },
  rider: { basePayout: 30, perKmPayout: 5, surchargeSharePercent: 100 },
};

const num = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const bool = (value, fallback) => (value === undefined || value === null ? fallback : !!value);

/** Coerces any partial / dirty document into a complete, clamped fare table. */
export function normalizeExpressFareSettings(raw = {}) {
  const src = raw?.expressFare && typeof raw.expressFare === "object" ? raw.expressFare : raw || {};
  const d = DEFAULT_EXPRESS_FARE;

  const services = {};
  for (const key of EXPRESS_SERVICE_KEYS) {
    const s = src.services?.[key] || {};
    services[key] = {
      enabled: bool(s.enabled, d.services[key].enabled),
      serviceFee: roundCurrency(num(s.serviceFee, d.services[key].serviceFee)),
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

  const extraKm = dist > cfg.baseDistanceKm ? ceilKm(dist - cfg.baseDistanceKm) : 0;
  const distanceFare = roundCurrency(extraKm * cfg.perKmRate);

  const band = WEIGHT_APPLIES_TO.has(service) ? resolveWeightBand(weight) : null;
  const weightSurcharge = band ? cfg.weightSurcharge[band.key] : 0;

  const serviceFee = cfg.services[service]?.serviceFee || 0;
  const nightCharge = isNightHour(at, cfg.nightCharge) ? cfg.nightCharge.amount : 0;

  const subtotal = addMoney(cfg.baseFare, distanceFare, weightSurcharge, serviceFee, nightCharge);
  const surgeAmount =
    cfg.surgeMultiplier > 1 ? roundCurrency(subtotal * (cfg.surgeMultiplier - 1)) : 0;
  const beforeMinimum = addMoney(subtotal, surgeAmount);
  const total = Math.max(beforeMinimum, cfg.minimumFare);
  const minimumFareTopUp = roundCurrency(total - beforeMinimum);

  const surchargePool = addMoney(weightSurcharge, serviceFee, nightCharge, surgeAmount);
  const surchargeShare = roundCurrency((surchargePool * cfg.rider.surchargeSharePercent) / 100);
  const riderDistance = roundCurrency(extraKm * cfg.rider.perKmPayout);

  return {
    service,
    distanceKm: Number(dist.toFixed(3)),
    extraKm,
    baseFare: cfg.baseFare,
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
export async function resolveExpressDistanceKm({ pickupAddress, address, sellerId } = {}) {
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

export default {
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
