import Joi from "joi";
import handleResponse from "../utils/helper.js";
import { estimateDeliveryEta } from "../services/deliveryEtaService.js";
import {
  EXPRESS_SERVICE_KEYS,
  EXPRESS_WEIGHT_BANDS,
  calculateExpressFare,
  getExpressFareSettings,
  normalizeExpressFareSettings,
  resolveExpressDistanceKm,
  resolveExpressDistance,
  saveExpressFareSettings,
  estimateExpressEta,
  isWithinExpressRadius,
} from "../services/finance/expressFareService.js";

const money = Joi.number().min(0).max(100000);
const optMoney = Joi.number().min(0).max(100000).allow(null);
const serviceSchema = Joi.object({
  enabled: Joi.boolean(),
  serviceFee: money,
  baseFare: optMoney,
  baseDistanceKm: Joi.number().min(0).max(100).allow(null),
  perKmRate: optMoney,
  minimumFare: optMoney,
}).unknown(false);

/** Every field optional: the admin form may save one section at a time. */
const fareSettingsSchema = Joi.object({
  enabled: Joi.boolean(),
  baseFare: money,
  baseDistanceKm: Joi.number().min(0).max(100),
  perKmRate: money,
  minimumFare: money,
  surgeMultiplier: Joi.number().min(1).max(5),
  schedule: Joi.object({
    instantEnabled: Joi.boolean(),
    scheduleEnabled: Joi.boolean(),
    minLeadMinutes: Joi.number().integer().min(0).max(1440),
    maxDaysAhead: Joi.number().integer().min(0).max(30),
    windowStart: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
    windowEnd: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  }).unknown(false),
  maxDistanceKm: Joi.number().min(0).max(1000),
  distanceFactor: Joi.number().min(1).max(3),
  eta: Joi.object({
    basePrepMinutes: Joi.number().min(0).max(600),
    minutesPerKm: Joi.number().min(0).max(60),
    rangeSpreadMinutes: Joi.number().min(0).max(240),
    minMinutes: Joi.number().min(1).max(1440),
    maxMinutes: Joi.number().min(1).max(1440),
  }).unknown(false),
  nightCharge: Joi.object({
    enabled: Joi.boolean(),
    startHour: Joi.number().integer().min(0).max(23),
    endHour: Joi.number().integer().min(0).max(23),
    amount: money,
  }).unknown(false),
  weightSurcharge: Joi.object(
    Object.fromEntries(EXPRESS_WEIGHT_BANDS.map((b) => [b.key, money])),
  ).unknown(false),
  services: Joi.object(
    Object.fromEntries(EXPRESS_SERVICE_KEYS.map((k) => [k, serviceSchema])),
  ).unknown(false),
  rider: Joi.object({
    basePayout: money,
    perKmPayout: money,
    surchargeSharePercent: Joi.number().min(0).max(100),
  }).unknown(false),
}).unknown(false);

/** GET /orders/express/fare  (admin) */
export const getExpressFare = async (req, res) => {
  try {
    if (req.user?.role !== "admin") return handleResponse(res, 403, "Access denied.");
    const settings = await getExpressFareSettings();
    return handleResponse(res, 200, "Express fare settings fetched", {
      settings,
      weightBands: EXPRESS_WEIGHT_BANDS,
      serviceKeys: EXPRESS_SERVICE_KEYS,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/** PUT /orders/express/fare  (admin) */
export const updateExpressFare = async (req, res) => {
  try {
    if (req.user?.role !== "admin") return handleResponse(res, 403, "Access denied.");

    const { error, value } = fareSettingsSchema.validate(req.body || {}, { stripUnknown: true });
    if (error) {
      return handleResponse(res, 400, error.details.map((d) => d.message).join("; "));
    }
    const nc = value.nightCharge;
    if (nc && nc.enabled && nc.startHour !== undefined && nc.startHour === nc.endHour) {
      return handleResponse(res, 400, "Night charge start and end hour can't be the same");
    }

    const settings = await saveExpressFareSettings(value, { updatedBy: req.user?.id });
    return handleResponse(res, 200, "Express fare updated", { settings });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * POST /orders/express/quote  (customer, admin)
 *
 * The number the booking screen shows. Distance is measured server-side from the
 * same coordinates placement uses, so quote === charge.
 *
 * Admin extras (for the fare calculator): a raw `distanceKm`, and
 * `settingsOverride` to preview an UNSAVED fare table.
 */
export const quoteExpressFare = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const { service, pickupAddress, address, sellerId, weight, timing, distanceKm } = req.body || {};

    if (!EXPRESS_SERVICE_KEYS.includes(service)) {
      return handleResponse(res, 400, "Unknown Athreya Express service");
    }

    let settings = await getExpressFareSettings();
    if (isAdmin && req.body?.settingsOverride && typeof req.body.settingsOverride === "object") {
      settings = normalizeExpressFareSettings({ ...settings, ...req.body.settingsOverride });
    }

    let distanceSource = "manual";
    let distance;
    if (isAdmin && Number.isFinite(Number(distanceKm))) {
      distance = Math.max(0, Number(distanceKm));
    } else {
      const measured = await resolveExpressDistance({ pickupAddress, address, sellerId, factor: settings.distanceFactor });
      distance = measured.km;
      distanceSource = measured.source;
    }

    const serviceEnabled = settings.services[service]?.enabled !== false;
    // Admin calculator can simulate a time of day to preview the night charge.
    const at =
      isAdmin && req.body?.at && !Number.isNaN(new Date(req.body.at).getTime())
        ? new Date(req.body.at)
        : new Date();
    const fare = calculateExpressFare({ distanceKm: distance, service, weight, settings, at });

    // Scheduled rider bookings have no "arrives in N mins" promise.
    const eta = timing === "scheduled" ? null : estimateExpressEta(distance, settings);

    // Riders' earnings are not the customer's business.
    const { rider, ...customerFare } = fare;

    return handleResponse(res, 200, "Express fare quoted", {
      service,
      serviceEnabled,
      distanceKm: fare.distanceKm,
      distanceSource,
      maxDistanceKm: settings.maxDistanceKm,
      schedule: settings.schedule,
      withinRadius: isWithinExpressRadius(distance, settings),
      fare: isAdmin ? fare : customerFare,
      eta: eta ? { label: eta.label, minMinutes: eta.minMinutes, maxMinutes: eta.maxMinutes } : null,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
