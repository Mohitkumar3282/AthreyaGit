import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";
import Seller from "../models/seller.js";
import User from "../models/customer.js";
import Delivery from "../models/delivery.js";
import Order from "../models/order.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { distanceMeters } from "../utils/geoUtils.js";
import { getOrCreateFinanceSettings } from "../services/finance/financeSettingsService.js";
import {
  calculateCustomerDeliveryFee,
  calculateRiderPayout,
} from "../services/finance/pricingService.js";
import { resolveExpressDistance } from "../services/finance/expressFareService.js";

/**
 * Helpers behind the admin "Create WhatsApp Order" form:
 *   - searchable customer / shop lookup
 *   - automatic delivery charge from the real road distance
 *   - smart rider suggestions (nearest, least busy)
 */

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ACTIVE_STATUSES = [
  WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  WORKFLOW_STATUS.PICKUP_READY,
  WORKFLOW_STATUS.OUT_FOR_DELIVERY,
];

const validPoint = (p) =>
  p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

const sellerPoint = (seller) => {
  const c = seller?.location?.coordinates;
  return Array.isArray(c) && c.length >= 2 && (Math.abs(c[0]) > 1e-5 || Math.abs(c[1]) > 1e-5)
    ? { lat: Number(c[1]), lng: Number(c[0]) }
    : null;
};

const addressView = (a, index) => ({
  index,
  label: a.label || "other",
  address: a.fullAddress || a.formattedAddress || a.address || "",
  city: a.city || "",
  location: validPoint(a.location) ? { lat: Number(a.location.lat), lng: Number(a.location.lng) } : null,
});

/** Customer's saved addresses (from either the list or the legacy single field). */
export function customerAddressList(customerDoc) {
  if (Array.isArray(customerDoc?.addresses) && customerDoc.addresses.length > 0) {
    return customerDoc.addresses.map(addressView);
  }
  const a = customerDoc?.address;
  if (a && typeof a === "object") return [addressView(a, 0)];
  if (typeof a === "string" && a.trim()) return [addressView({ fullAddress: a }, 0)];
  return [];
}

/** Road distance seller -> drop, falling back to straight line. */
export async function manualOrderDistance(sellerDoc, dropLocation) {
  const from = sellerPoint(sellerDoc);
  if (!from || !validPoint(dropLocation)) return { km: 0, source: "unknown" };
  const r = await resolveExpressDistance({
    pickupAddress: { location: from },
    address: { location: dropLocation },
    sellerId: sellerDoc._id,
    factor: 1,
  });
  return { km: r.km, source: r.source };
}

/**
 * Riders ranked for a shop: online, not on break, nearest first with a penalty
 * for each order they are already carrying.
 */
export async function rankRidersForSeller(sellerDoc, { limit = 15, codAmount = 0 } = {}) {
  const from = sellerPoint(sellerDoc);
  const riders = await Delivery.find({
    isOnline: true,
    $or: [{ breakUntil: null }, { breakUntil: { $lte: new Date() } }, { breakUntil: { $exists: false } }],
  })
    .select("name phone vehicleType rating location lastLocationAt isVerified cashLimit")
    .limit(300)
    .lean();
  if (!riders.length) return [];

  const ids = riders.map((r) => r._id);
  const [counts, wallets] = await Promise.all([
    Order.aggregate([
      { $match: { deliveryBoy: { $in: ids }, workflowStatus: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: "$deliveryBoy", n: { $sum: 1 } } },
    ]),
    mongoose.connection
      .collection("wallets")
      .find({ ownerType: "DELIVERY_PARTNER", ownerId: { $in: ids } })
      .project({ ownerId: 1, cashInHand: 1 })
      .toArray(),
  ]);
  const active = new Map(counts.map((c) => [String(c._id), c.n]));
  const cash = new Map(wallets.map((w) => [String(w.ownerId), Number(w.cashInHand || 0)]));

  const ranked = riders.map((r) => {
    const c = r.location?.coordinates;
    const hasFix = Array.isArray(c) && c.length >= 2 && (Math.abs(c[0]) > 1e-5 || Math.abs(c[1]) > 1e-5);
    const distanceKm =
      from && hasFix
        ? Number((distanceMeters(from.lat, from.lng, Number(c[1]), Number(c[0])) / 1000).toFixed(2))
        : null;
    const activeOrders = active.get(String(r._id)) || 0;
    const held = cash.get(String(r._id)) || 0;
    const limitAmt = Number(r.cashLimit || 0);
    const cashLimitReached = limitAmt > 0 && codAmount > 0 && held + codAmount > limitAmt;
    // Unknown position ranks after riders we can place on the map.
    const score = (distanceKm ?? 50) + activeOrders * 1.5 + (cashLimitReached ? 100 : 0);
    return {
      id: String(r._id),
      name: r.name,
      phone: r.phone,
      vehicleType: r.vehicleType,
      rating: r.rating,
      distanceKm,
      activeOrders,
      cashLimitReached,
      score,
    };
  });
  ranked.sort((a, b) => a.score - b.score);
  const out = ranked.slice(0, limit);
  if (out[0] && !out[0].cashLimitReached) out[0].recommended = true;
  return out;
}

/** GET /orders/manual/lookup?type=customer|seller&q= */
export const lookupForManualOrder = async (req, res) => {
  try {
    const { type, q = "" } = req.query;
    const term = String(q).trim();
    const rx = term ? new RegExp(escapeRegex(term), "i") : null;

    if (type === "customer") {
      if (req.user.role !== "admin") return handleResponse(res, 403, "Access denied.");
      const filter = rx ? { $or: [{ name: rx }, { phone: rx }, { email: rx }] } : {};
      const users = await User.find(filter)
        .select("name phone email addresses address")
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean();
      return handleResponse(
        res,
        200,
        "Customers",
        users.map((u) => ({
          id: String(u._id),
          name: u.name || "Customer",
          phone: u.phone || "",
          addresses: customerAddressList(u),
        })),
      );
    }

    if (type === "seller") {
      const filter = { isVerified: true, isActive: true };
      if (req.user.role === "seller") filter._id = req.user.id;
      if (rx) filter.$or = [{ shopName: rx }, { name: rx }, { phone: rx }, { locality: rx }];
      const sellers = await Seller.find(filter)
        .select("shopName name phone locality location isOpen")
        .sort({ shopName: 1 })
        .limit(20)
        .lean();
      return handleResponse(
        res,
        200,
        "Sellers",
        sellers.map((s) => ({
          id: String(s._id),
          shopName: s.shopName || s.name || "Shop",
          phone: s.phone || "",
          locality: s.locality || "",
          isOpen: s.isOpen !== false,
          hasLocation: !!sellerPoint(s),
        })),
      );
    }

    return handleResponse(res, 400, "type must be customer or seller");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/** POST /orders/manual/quote  { customerId, sellerId, addressIndex? | address? } */
export const quoteManualOrder = async (req, res) => {
  try {
    const { customerId, sellerId, addressIndex, address } = req.body || {};
    const sId = req.user.role === "seller" ? req.user.id : sellerId;
    if (!sId || !mongoose.isValidObjectId(sId)) return handleResponse(res, 400, "Seller is required");

    const seller = await Seller.findById(sId).lean();
    if (!seller) return handleResponse(res, 404, "Seller not found");

    let customerAddresses = [];
    let drop = null;
    let dropText = "";

    if (address && typeof address === "object" && validPoint(address.location)) {
      drop = { lat: Number(address.location.lat), lng: Number(address.location.lng) };
      dropText = address.address || "";
    } else if (customerId && mongoose.isValidObjectId(customerId)) {
      const customer = await User.findById(customerId).select("addresses address").lean();
      customerAddresses = customerAddressList(customer);
      const picked = customerAddresses[Number.isInteger(Number(addressIndex)) ? Number(addressIndex) : 0];
      if (picked?.location) {
        drop = picked.location;
        dropText = picked.address;
      }
    }

    const settings = await getOrCreateFinanceSettings();
    if (!drop) {
      const base = calculateCustomerDeliveryFee(0, settings);
      return handleResponse(res, 200, "Quote (no customer location)", {
        hasLocation: false,
        distanceKm: 0,
        distanceSource: "unknown",
        deliveryFee: base.deliveryFeeCharged,
        riderEarns: null,
        message: "This customer has no saved address with a map location, so only the base charge is shown. Pick or add an address with a map location for an exact charge.",
        customerAddresses,
      });
    }

    const { km, source } = await manualOrderDistance(seller, drop);
    const fee = calculateCustomerDeliveryFee(km, settings);
    const rider = calculateRiderPayout(km, settings);
    return handleResponse(res, 200, "Quote", {
      hasLocation: true,
      distanceKm: km,
      distanceSource: source,
      deliveryFee: fee.deliveryFeeCharged,
      riderEarns: Number(
        ((rider.riderPayoutBase || 0) + (rider.riderPayoutDistance || 0) + (rider.riderPayoutBonus || 0)).toFixed(2),
      ),
      address: dropText,
      customerAddresses,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/** GET /orders/manual/rider-suggestions?sellerId=&cod= */
export const suggestRidersForManualOrder = async (req, res) => {
  try {
    const sId = req.user.role === "seller" ? req.user.id : req.query.sellerId;
    if (!sId || !mongoose.isValidObjectId(sId)) return handleResponse(res, 400, "Seller is required");
    const seller = await Seller.findById(sId).select("location shopName").lean();
    if (!seller) return handleResponse(res, 404, "Seller not found");
    const riders = await rankRidersForSeller(seller, { codAmount: Number(req.query.cod || 0) });
    return handleResponse(res, 200, "Rider suggestions", riders);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
