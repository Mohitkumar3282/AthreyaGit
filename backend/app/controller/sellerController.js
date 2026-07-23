import Seller from "../models/seller.js";
import Transaction from "../models/transaction.js";
import { handleResponse, calculateDistance } from "../utils/helper.js";
import mongoose from "mongoose";
import { invalidateSellerName } from "../services/entityNameCache.js";
import { buildKey, getOrSet, getTTL, delPattern } from "../services/cacheService.js";

/* ===============================
   GET NEARBY SELLERS
================================ */
export const getNearbySellers = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      const cacheKey = buildKey("sellers", "all_active");
      const sellers = await getOrSet(
        cacheKey,
        async () => {
          return Seller.find({
            isActive: true,
            isOpen: true,
            isVerified: true
          }).lean();
        },
        getTTL("nearbySellers")
      );
      return handleResponse(
        res,
        200,
        "All active sellers fetched successfully",
        sellers,
      );
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    const rLat = customerLat.toFixed(4);
    const rLng = customerLng.toFixed(4);
    const cacheKey = buildKey("sellers", "nearby_full", `${rLat}:${rLng}`);

    const nearbySellers = await getOrSet(
      cacheKey,
      async () => {
        const sellers = await Seller.find({
          isActive: true,
          isOpen: true,
          isVerified: true,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [customerLng, customerLat],
              },
              $maxDistance: 100000, // 100km max search area for performance
            },
          },
        }).lean();

        return sellers.filter((seller) => {
          const sellerLng = seller.location.coordinates[0];
          const sellerLat = seller.location.coordinates[1];
          const distance = calculateDistance(
            customerLat,
            customerLng,
            sellerLat,
            sellerLng,
          );

          // Add distance to seller object for frontend
          seller.distance = distance;

          return distance <= (seller.serviceRadius || 5);
        });
      },
      getTTL("nearbySellers")
    );

    return handleResponse(
      res,
      200,
      "Nearby sellers fetched successfully",
      nearbySellers,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REQUEST WITHDRAWAL (Seller)
================================ */
export const requestWithdrawal = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return handleResponse(res, 400, "Please enter a valid amount");
    }

    // 1. Calculate current available balance
    // Consistent with getSellerEarnings logic in sellerStatsController.js
    const transactions = await Transaction.find({
      user: sellerId,
      userModel: "Seller",
    })
      .select("status amount type")
      .lean();

    const settledBalance = transactions
      .filter((t) => t.status === "Settled")
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const pendingPayouts = transactions
      .filter(
        (t) =>
          t.type === "Withdrawal" &&
          (t.status === "Pending" || t.status === "Processing"),
      )
      .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

    const availableBalance = settledBalance - pendingPayouts;

    if (amount > availableBalance) {
      return handleResponse(
        res,
        400,
        `Insufficient balance. Available: ₹${availableBalance}`,
      );
    }

    // 2. Create Withdrawal Transaction
    // Withdrawals have negative amounts per the model comment
    const withdrawal = await Transaction.create({
      user: sellerId,
      userModel: "Seller",
      type: "Withdrawal",
      amount: -Math.abs(amount),
      status: "Pending",
      reference: `WDR-${Date.now()}`,
    });

    return handleResponse(
      res,
      201,
      "Withdrawal request submitted successfully",
      withdrawal,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PROFILE
================================ */
export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    return handleResponse(
      res,
      200,
      "Seller profile fetched successfully",
      seller,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE SELLER PROFILE
================================ */
export const updateSellerProfile = async (req, res) => {
  try {
    const {
      name, shopName, phone, address, locality, pincode, city, state, lat, lng, radius,
      shopBanner, shopLogo, shopGallery, storeFrontImage, storeInteriorImages,
      businessDescription, storeTimings, contactNumber, minimumOrderAmount,
      deliveryFee, freeDeliveryAbove, hygieneAssured, rating, reviewCount, isOpen, category, isActive
    } = req.body;

    // Find seller
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    // Update fields if provided
    if (name !== undefined) seller.name = name;
    if (shopName !== undefined) seller.shopName = shopName;
    if (phone !== undefined) seller.phone = phone;
    if (address !== undefined) seller.address = address;
    if (locality !== undefined) seller.locality = locality;
    if (pincode !== undefined) seller.pincode = pincode;
    if (city !== undefined) seller.city = city;
    if (state !== undefined) seller.state = state;
    if (category !== undefined) seller.category = category;

    // Extended fields
    if (shopBanner !== undefined) seller.shopBanner = shopBanner;
    if (shopLogo !== undefined) seller.shopLogo = shopLogo;
    if (shopGallery !== undefined) seller.shopGallery = shopGallery;
    if (storeFrontImage !== undefined) seller.storeFrontImage = storeFrontImage;
    if (storeInteriorImages !== undefined) seller.storeInteriorImages = storeInteriorImages;
    if (businessDescription !== undefined) seller.businessDescription = businessDescription;
    if (storeTimings !== undefined) seller.storeTimings = storeTimings;
    if (contactNumber !== undefined) seller.contactNumber = contactNumber;
    if (minimumOrderAmount !== undefined) seller.minimumOrderAmount = Number(minimumOrderAmount);
    if (deliveryFee !== undefined) seller.deliveryFee = Number(deliveryFee);
    if (freeDeliveryAbove !== undefined) seller.freeDeliveryAbove = Number(freeDeliveryAbove);
    if (hygieneAssured !== undefined) seller.hygieneAssured = Boolean(hygieneAssured);
    if (rating !== undefined) seller.rating = Number(rating);
    if (reviewCount !== undefined) seller.reviewCount = Number(reviewCount);
    if (isOpen !== undefined) seller.isOpen = Boolean(isOpen);
    if (isActive !== undefined) seller.isActive = Boolean(isActive);

    // Validate and update geo data
    if (lat !== undefined && lng !== undefined) {
      if (lat < -90 || lat > 90)
        return handleResponse(res, 400, "Invalid latitude");
      if (lng < -180 || lng > 180)
        return handleResponse(res, 400, "Invalid longitude");

      seller.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
    }

    if (radius !== undefined) {
      if (radius < 1 || radius > 100)
        return handleResponse(res, 400, "Radius must be between 1 and 100 km");
      seller.serviceRadius = Number(radius);
    }

    const updatedSeller = await seller.save();

    // Invalidate cached seller name in case shopName changed
    invalidateSellerName(req.user.id).catch((err) => {
      console.warn("[Seller] Name cache invalidation failed:", err.message);
    });

    // Invalidate nearby sellers cache so changes reflect immediately
    delPattern(buildKey("sellers", "nearby_full", "*")).catch((err) => {
      console.warn("[Seller] Cache invalidation failed:", err.message);
    });

    return handleResponse(
      res,
      200,
      "Profile updated successfully",
      updatedSeller,
    );
  } catch (error) {
    // Handle duplicate phone error
    if (error.code === 11000) {
      return handleResponse(res, 400, "Phone number already in use");
    }
    return handleResponse(res, 500, error.message);
  }
};
