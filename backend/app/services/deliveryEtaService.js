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
 *   min = clamp(round(minutes), minMinutes, maxMinutes)
 *   max = min + rangeSpreadMinutes
 *
 * Every coefficient is admin-configurable through `Setting.deliveryEta` so ops
 * can retune the promise without a deploy.
 */

export const DEFAULT_ETA_SETTINGS = {
  enabled: true,
  basePrepMinutes: 8,
  minutesPerKm: 3,
  minutesPerItem: 0,
  minMinutes: 8,
  maxMinutes: 180,
  rangeSpreadMinutes: 5,
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
  settings = DEFAULT_ETA_SETTINGS,
} = {}) {
  const config = normalizeEtaSettings(settings);
  const normalizedDistance = Math.max(0, toFiniteNumber(distanceKm, 0));
  const normalizedItemCount = Math.max(0, Math.floor(toFiniteNumber(itemCount, 0)));

  const travelMinutes = normalizedDistance * config.minutesPerKm;
  const pickingMinutes = normalizedItemCount * config.minutesPerItem;
  const rawMinutes = config.basePrepMinutes + travelMinutes + pickingMinutes;

  const minMinutes = Math.min(
    Math.max(Math.round(rawMinutes), config.minMinutes),
    config.maxMinutes,
  );
  const maxMinutes = minMinutes + config.rangeSpreadMinutes;

  return {
    enabled: config.enabled,
    distanceKm: Number(normalizedDistance.toFixed(3)),
    minMinutes,
    maxMinutes,
    label: formatEtaLabel(minMinutes, maxMinutes),
    breakdown: {
      basePrepMinutes: config.basePrepMinutes,
      travelMinutes: Number(travelMinutes.toFixed(2)),
      pickingMinutes: Number(pickingMinutes.toFixed(2)),
      minutesPerKm: config.minutesPerKm,
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
  session = null,
} = {}) {
  const settings = await getEtaSettings({ session });
  if (!settings.enabled) return null;
  return calculateDeliveryEta({ distanceKm, itemCount, settings });
}

export default {
  calculateDeliveryEta,
  estimateDeliveryEta,
  formatEtaLabel,
  getEtaSettings,
  normalizeEtaSettings,
  DEFAULT_ETA_SETTINGS,
};
