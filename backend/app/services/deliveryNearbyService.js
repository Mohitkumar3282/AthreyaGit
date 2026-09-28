import mongoose from "mongoose";
import Delivery from "../models/delivery.js";
import Seller from "../models/seller.js";
import Order from "../models/order.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { distanceMeters } from "../utils/geoUtils.js";

/** When true, only verified riders receive broadcasts (stricter). Default: do not require. */
const requireVerifiedForBroadcast = () =>
  process.env.DELIVERY_BROADCAST_REQUIRE_VERIFIED === "true";

const HAVERSINE_FALLBACK_LIMIT = () =>
  parseInt(process.env.DELIVERY_BROADCAST_HAVERSINE_LIMIT || "2000", 10);

/**
 * A rider already juggling this many un-finished orders (assigned, at the
 * store, or out for delivery) is skipped when building a NEW broadcast pool —
 * they can still finish what they have, they just don't get piled on further.
 */
const MAX_ACTIVE_ORDERS_PER_RIDER = () =>
  parseInt(process.env.DELIVERY_MAX_ACTIVE_ORDERS_PER_RIDER || "2", 10);

/**
 * Of the riders left after the capacity filter, only the nearest N are
 * actually notified for a given broadcast attempt — this is what makes
 * assignment "smart" (closest + least-loaded first) instead of ringing
 * every phone in the radius at once. If nobody from this shortlist accepts,
 * the existing retry job widens the radius and re-ranks on the next attempt.
 */
const BROADCAST_TOP_N = () =>
  parseInt(process.env.DELIVERY_BROADCAST_TOP_N || "6", 10);

/** Workflow states that mean a rider is still working an order. */
const ACTIVE_ORDER_STATUSES = [
  WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  WORKFLOW_STATUS.PICKUP_READY,
  WORKFLOW_STATUS.OUT_FOR_DELIVERY,
];

function buildDeliveryFilter() {
  const q = { isOnline: true };
  if (requireVerifiedForBroadcast()) {
    q.isVerified = true;
  }
  return q;
}

/** Same candidates, now paired with their real (Haversine) distance in meters. */
function filterByHaversine(candidates, lat, lng, maxDistanceM) {
  const out = [];
  for (const d of candidates) {
    const c = d.location?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const [dlng, dlat] = c;
    if (!Number.isFinite(dlat) || !Number.isFinite(dlng)) continue;
    if (Math.abs(dlat) < 1e-5 && Math.abs(dlng) < 1e-5) continue;
    const distanceM = distanceMeters(dlat, dlng, lat, lng);
    if (distanceM <= maxDistanceM) {
      out.push({ id: d._id.toString(), distanceM });
    }
  }
  return out;
}

/**
 * Given riders already known to be within range, drop anyone at/over their
 * active-order cap, then return only the nearest `BROADCAST_TOP_N` of what's
 * left — the pool that actually gets pinged for this broadcast attempt.
 */
async function rankAndSelectRiders(idsWithDistance, excludeIds = []) {
  const excludeSet = new Set((excludeIds || []).map((id) => String(id)));
  const candidates = idsWithDistance.filter((c) => !excludeSet.has(c.id));
  if (!candidates.length) return [];

  const maxActive = MAX_ACTIVE_ORDERS_PER_RIDER();
  let activeCountById = new Map();
  if (maxActive > 0) {
    try {
      const counts = await Order.aggregate([
        {
          $match: {
            deliveryBoy: {
              $in: candidates.map((c) => new mongoose.Types.ObjectId(c.id)),
            },
            workflowStatus: { $in: ACTIVE_ORDER_STATUSES },
          },
        },
        { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } },
      ]);
      activeCountById = new Map(counts.map((c) => [String(c._id), c.count]));
    } catch (e) {
      console.warn("[deliveryNearby] active-order count query failed:", e.message);
    }
  }

  const eligible = candidates.filter((c) => {
    if (maxActive <= 0) return true;
    return (activeCountById.get(c.id) || 0) < maxActive;
  });

  eligible.sort((a, b) => a.distanceM - b.distanceM);

  const topN = BROADCAST_TOP_N();
  const shortlist = topN > 0 ? eligible.slice(0, topN) : eligible;
  return shortlist.map((c) => c.id);
}

/**
 * Delivery partner IDs whose last known location is within the seller's
 * `serviceRadius` (km) of the seller store — ranked by distance and
 * capped to the nearest, least-loaded riders (see `rankAndSelectRiders`).
 * Uses MongoDB $near first; if that returns no rows, falls back to Haversine
 * (helps when geo index / $near is strict or data is borderline).
 */
export async function getDeliveryPartnerIdsWithinSellerRadius(sellerId, { excludeIds } = {}) {
  if (!sellerId) return [];

  const seller = await Seller.findById(sellerId)
    .select("location serviceRadius")
    .lean();

  if (!seller?.location?.coordinates?.length) return [];

  const [lng, lat] = seller.location.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return [];

  const radiusKm = Math.min(
    Math.max(Number(seller.serviceRadius) || 5, 1),
    100,
  );
  const maxDistanceM = radiusKm * 1000;

  const base = buildDeliveryFilter();

  let ranked = [];
  try {
    const candidates = await Delivery.find({
      ...base,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: maxDistanceM,
        },
      },
    })
      .select("_id location")
      .lean();

    ranked = await rankAndSelectRiders(
      filterByHaversine(candidates, lat, lng, maxDistanceM),
      excludeIds,
    );
  } catch (e) {
    console.warn(
      "[deliveryNearby] $near query failed, using Haversine fallback:",
      e.message,
    );
  }

  if (ranked.length) return ranked;

  try {
    const rough = await Delivery.find({
      ...base,
      "location.coordinates": { $exists: true },
    })
      .select("_id location")
      .limit(HAVERSINE_FALLBACK_LIMIT())
      .lean();

    return await rankAndSelectRiders(
      filterByHaversine(rough, lat, lng, maxDistanceM),
      excludeIds,
    );
  } catch (e) {
    console.warn("[deliveryNearby] Haversine fallback failed:", e.message);
    return [];
  }
}

/**
 * Generic nearby rider search by coordinates — ranked by distance and capped
 * to the nearest, least-loaded riders (see `rankAndSelectRiders`).
 */
export async function getDeliveryPartnerIdsWithinRadius(lat, lng, radiusKm = 5, { excludeIds } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const maxDistanceM = radiusKm * 1000;
  const base = buildDeliveryFilter();

  let ranked = [];
  try {
    const candidates = await Delivery.find({
      ...base,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: maxDistanceM,
        },
      },
    })
      .select("_id location")
      .lean();

    ranked = await rankAndSelectRiders(
      filterByHaversine(candidates, lat, lng, maxDistanceM),
      excludeIds,
    );
  } catch (e) {
    console.warn("[deliveryNearby] $near fallback search failed:", e.message);
  }

  if (ranked.length) return ranked;

  try {
    const rough = await Delivery.find({
      ...base,
      "location.coordinates": { $exists: true },
    })
      .select("_id location")
      .limit(HAVERSINE_FALLBACK_LIMIT())
      .lean();

    return await rankAndSelectRiders(
      filterByHaversine(rough, lat, lng, maxDistanceM),
      excludeIds,
    );
  } catch (e) {
    return [];
  }
}

/**
 * Finds riders near a customer's location for return pickup.
 */
export async function getDeliveryPartnerIdsWithinCustomerRadius(customerLocation, radiusKm = 5, opts) {
  const lat = customerLocation?.lat;
  const lng = customerLocation?.lng;
  return getDeliveryPartnerIdsWithinRadius(lat, lng, radiusKm, opts);
}
