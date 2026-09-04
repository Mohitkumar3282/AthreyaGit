import Setting from "../models/setting.js";

/**
 * Dynamic delivery-time estimation.
 *
 * Before this service the customer app rendered a hard-coded "12-15 mins"
 * everywhere. The ETA is now derived from the same distance the delivery fee
 * is priced on (seller → customer address, haversine, computed once per seller
 * in `checkoutPricingService`), so a nearby store quotes a short window and a
 * far one quotes a longer one, and the quote re-computes whenever the customer
 * switches delivery address.
 *
 * Model:
 *
 *   minutes = basePrepMinutes                     // picking + packing + handover
 *           + distanceKm * minutesPerKm           // travel
 *           + itemCount * minutesPerItem          // picking effort (default 0)
 *
 *   baseMin = clamp(round(minutes), minMinutes, maxMinutes)
 *   extras  = uniqueShopCount - 1                 // extra pickup stops
 *
 *   min = baseMin + extras * extraShopMinMinutes
 *   max = baseMin + rangeSpreadMinutes + extras * extraShopMaxMinutes
 *
 * A multi-shop basket is one trip with several pickups, so each extra store
 * widens the promise at BOTH ends — the lower bound by `extraShopMinMinutes`
 * and the upper by `extraShopMaxMinutes`. With the shipped defaults that is
 * the published ladder for a nearby basket:
 *
 *   1 shop  -> 10-15 mins
 *   2 shops -> 15-25 mins
 *   3 shops -> 20-35 mins
 *
 * Distance still applies on top, so a far single shop can quote longer than a
 * near two-shop basket. The ladder above is the floor, not a fixed table.
 *
 * Every coefficient is admin-configurable through `Setting.deliveryEta` so ops
 * can retune the promise without a deploy.
 */

export const DEFAULT_ETA_SETTINGS = {
  enabled: true,
  // 10 + a 5 minute spread gives the published "10-15 mins" for a nearby
  // single-shop order once `minMinutes` holds the floor.
  basePrepMinutes: 10,
  minutesPerKm: 3,
  minutesPerItem: 0,
  minMinutes: 10,
  maxMinutes: 180,
  rangeSpreadMinutes: 5,
  // Per EXTRA shop in the same order (store-to-store pickup routing).
  extraShopMinMinutes: 5,
  extraShopMaxMinutes: 10,
};

function toFiniteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeEtaSettings(raw = {}) {
  const source = raw?.deliveryEta && typeof raw.deliveryEta === "object" ? raw.deliveryEta : raw;

  const minMinutes = Math.max(
    1,
    Math.round(toFiniteNumber(source?.minMinutes, DEFAULT_ETA_SETTINGS.minMinutes)),
  );
  const maxMinutes = Math.max(
    minMinutes,
    Math.round(toFiniteNumber(source?.maxMinutes, DEFAULT_ETA_SETTINGS.maxMinutes)),
  );

  return {
    enabled: source?.enabled === undefined ? DEFAULT_ETA_SETTINGS.enabled : !!source.enabled,
    basePrepMinutes: Math.max(
      0,
      toFiniteNumber(source?.basePrepMinutes, DEFAULT_ETA_SETTINGS.basePrepMinutes),
    ),
    minutesPerKm: Math.max(
      0,
      toFiniteNumber(source?.minutesPerKm, DEFAULT_ETA_SETTINGS.minutesPerKm),
    ),
    minutesPerItem: Math.max(
      0,
      toFiniteNumber(source?.minutesPerItem, DEFAULT_ETA_SETTINGS.minutesPerItem),
    ),
    minMinutes,
    maxMinutes,
    rangeSpreadMinutes: Math.max(
      0,
      Math.round(
        toFiniteNumber(source?.rangeSpreadMinutes, DEFAULT_ETA_SETTINGS.rangeSpreadMinutes),
      ),
    ),
    extraShopMinMinutes: Math.max(
      0,
      Math.round(
        toFiniteNumber(source?.extraShopMinMinutes, DEFAULT_ETA_SETTINGS.extraShopMinMinutes),
      ),
    ),
    // Never below the lower-bound increment: an upper bound that grew more
    // slowly than the lower one would invert the window on a big basket.
    extraShopMaxMinutes: Math.max(
      Math.max(
        0,
        Math.round(
          toFiniteNumber(source?.extraShopMinMinutes, DEFAULT_ETA_SETTINGS.extraShopMinMinutes),
        ),
      ),
      Math.round(
        toFiniteNumber(source?.extraShopMaxMinutes, DEFAULT_ETA_SETTINGS.extraShopMaxMinutes),
      ),
    ),
  };
}

export async function getEtaSettings({ session = null } = {}) {
  try {
    const query = Setting.findOne({}, { deliveryEta: 1 }).lean();
    if (session) query.session(session);
    const setting = await query;
    return normalizeEtaSettings(setting || {});
  } catch {
    // ETA must never be the reason a checkout preview fails.
    return { ...DEFAULT_ETA_SETTINGS };
  }
}

export function formatEtaLabel(minMinutes, maxMinutes) {
  const min = Math.max(1, Math.round(Number(minMinutes) || 0));
  const max = Math.max(min, Math.round(Number(maxMinutes) || min));
  if (min === max) return `${min} mins`;
  return `${min}-${max} mins`;
}

/**
 * Pure ETA calculation — no I/O, so it is directly unit-testable and can be
 * reused by any caller that already holds the settings object.
 */
export function calculateDeliveryEta({
  distanceKm = 0,
  itemCount = 0,
  shopCount = 1,
  settings = DEFAULT_ETA_SETTINGS,
} = {}) {
  const config = normalizeEtaSettings(settings);
  const normalizedDistance = Math.max(0, toFiniteNumber(distanceKm, 0));
  const normalizedItemCount = Math.max(0, Math.floor(toFiniteNumber(itemCount, 0)));
  // An order always has at least one pickup, so 0 and 1 behave identically.
  const normalizedShopCount = Math.max(1, Math.floor(toFiniteNumber(shopCount, 1)));
  const extraShops = normalizedShopCount - 1;

  const travelMinutes = normalizedDistance * config.minutesPerKm;
  const pickingMinutes = normalizedItemCount * config.minutesPerItem;
  const rawMinutes = config.basePrepMinutes + travelMinutes + pickingMinutes;

  const baseMinMinutes = Math.min(
    Math.max(Math.round(rawMinutes), config.minMinutes),
    config.maxMinutes,
  );

  // Store-to-store routing for the extra pickups. The upper bound grows faster
  // than the lower one, because multi-stop routing is what actually varies.
  const extraMinMinutes = extraShops * config.extraShopMinMinutes;
  const extraMaxMinutes = extraShops * config.extraShopMaxMinutes;

  const minMinutes = Math.min(baseMinMinutes + extraMinMinutes, config.maxMinutes);
  const maxMinutes = Math.max(
    minMinutes,
    Math.min(baseMinMinutes + config.rangeSpreadMinutes + extraMaxMinutes, config.maxMinutes),
  );

  return {
    enabled: config.enabled,
    distanceKm: Number(normalizedDistance.toFixed(3)),
    shopCount: normalizedShopCount,
    minMinutes,
    maxMinutes,
    label: formatEtaLabel(minMinutes, maxMinutes),
    breakdown: {
      basePrepMinutes: config.basePrepMinutes,
      travelMinutes: Number(travelMinutes.toFixed(2)),
      pickingMinutes: Number(pickingMinutes.toFixed(2)),
      minutesPerKm: config.minutesPerKm,
      extraShops,
      extraShopMinMinutes: extraMinMinutes,
      extraShopMaxMinutes: extraMaxMinutes,
      clampedToMin: Math.round(rawMinutes) < config.minMinutes,
      clampedToMax: Math.round(rawMinutes) > config.maxMinutes,
    },
  };
}

/**
 * Settings-loading wrapper used by the checkout pipeline.
 * Returns `null` when the feature is disabled so callers can fall back to
 * whatever static copy they rendered before.
 */
export async function estimateDeliveryEta({
  distanceKm = 0,
  itemCount = 0,
  shopCount = 1,
  session = null,
} = {}) {
  const settings = await getEtaSettings({ session });
  if (!settings.enabled) return null;
  return calculateDeliveryEta({ distanceKm, itemCount, shopCount, settings });
}

export default {
  calculateDeliveryEta,
  estimateDeliveryEta,
  formatEtaLabel,
  getEtaSettings,
  normalizeEtaSettings,
  DEFAULT_ETA_SETTINGS,
};
