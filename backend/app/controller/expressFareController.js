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
  saveExpressFareSettings,
} from "../services/finance/expressFareService.js";

const money = Joi.number().min(0).max(100000);
const serviceSchema = Joi.object({
  enabled: Joi.boolean(),
  serviceFee: money,
}).unknown(false);

/** Every field optional: the admin form may save one section at a time. */
const fareSettingsSchema = Joi.object({
  enabled: Joi.boolean(),
  baseFare: money,
  baseDistanceKm: Joi.number().min(0).max(100),
  perKmRate: money,
  minimumFare: money,
  surgeMultiplier: Joi.number().min(1).max(5),
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

    const distance =
      isAdmin && Number.isFinite(Number(distanceKm))
        ? Math.max(0, Number(distanceKm))
        : await resolveExpressDistanceKm({ pickupAddress, address, sellerId });

    const serviceEnabled = settings.services[service]?.enabled !== false;
    // Admin calculator can simulate a time of day to preview the night charge.
    const at =
      isAdmin && req.body?.at && !Number.isNaN(new Date(req.body.at).getTime())
        ? new Date(req.body.at)
        : new Date();
    const fare = calculateExpressFare({ distanceKm: distance, service, weight, settings, at });

    // Scheduled rider bookings have no "arrives in N mins" promise.
    const eta = timing === "scheduled" ? null : await estimateDeliveryEta({ distanceKm: distance });

    // Riders' earnings are not the customer's business.
    const { rider, ...customerFare } = fare;

    return handleResponse(res, 200, "Express fare quoted", {
      service,
      serviceEnabled,
      distanceKm: fare.distanceKm,
      fare: isAdmin ? fare : customerFare,
      eta: eta ? { label: eta.label, minMinutes: eta.minMinutes, maxMinutes: eta.maxMinutes } : null,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
