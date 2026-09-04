import handleResponse, { calculateDistance } from "../utils/helper.js";
import { geocodeAddress, geocodePlaceId } from "../services/mapsGeocodeService.js";
import Seller from "../models/seller.js";
import { estimateDeliveryEta } from "../services/deliveryEtaService.js";

/**
 * GET /maps/delivery-eta?lat&lng
 *
 * Distance-derived delivery promise for an arbitrary point, used by the
 * location header so the ETA the customer sees while browsing reflects where
 * they actually are — not a hard-coded "12-15 mins".
 *
 * The quote is anchored on the NEAREST store that serves the point, which is
 * the store an order from here would most likely be picked from. When nothing
 * serves the point we return `serviceable: false` and no ETA rather than a
 * promise we cannot keep.
 */
export const deliveryEtaController = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return handleResponse(res, 400, "lat and lng query params are required");
    }

    const candidates = await Seller.find({
      isActive: true,
      isOpen: true,
      isVerified: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 100000,
        },
      },
    })
      .select("location serviceRadius shopName")
      .limit(20)
      .lean();

    // `$near` already returns nearest-first, so the first store whose service
    // radius covers this point is the closest one that can actually deliver.
    let nearest = null;
    for (const seller of candidates) {
      const coords = seller?.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const distanceKm = calculateDistance(lat, lng, Number(coords[1]), Number(coords[0]));
      if (distanceKm <= Number(seller.serviceRadius || 5)) {
        nearest = { distanceKm, shopName: seller.shopName || null };
        break;
      }
    }

    if (!nearest) {
      return handleResponse(res, 200, "No store serves this location", {
        serviceable: false,
        eta: null,
      });
    }

    const eta = await estimateDeliveryEta({ distanceKm: nearest.distanceKm });

    return handleResponse(res, 200, "Delivery ETA computed", {
      serviceable: true,
      distanceKm: Number(nearest.distanceKm.toFixed(2)),
      eta,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const geocodeAddressController = async (req, res) => {
  try {
    const address = String(req.query.address || "").trim();
    const placeId = String(req.query.placeId || "").trim();
    const country = req.query.country ? String(req.query.country).trim() : undefined;

    if (!placeId && (!address || address.length < 3)) {
      return handleResponse(res, 400, "address or placeId query param is required", {
        error: { code: "ADDRESS_REQUIRED", message: "address query param is required" },
      });
    }

    const result = placeId
      ? await geocodePlaceId(placeId)
      : await geocodeAddress(address, { country });

    return handleResponse(res, 200, "Geocoded", {
      location: { lat: result.lat, lng: result.lng },
      formattedAddress: result.formattedAddress,
      placeId: result.placeId,
      types: result.types,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return handleResponse(res, status, e.message || "Geocoding failed", {
      error: {
        code: e.code || "GEOCODE_FAILED",
        message: e.message || "Geocoding failed",
      },
    });
  }
};
