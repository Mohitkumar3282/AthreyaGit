import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import Seller from "../../models/seller.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import {
  getActiveSellersData,
  getSellerLocationsData,
  getSellerOptions,
} from "../../services/admin/sellerDirectoryService.js";

export const getSellerLocations = async (req, res) => {
  try {
    const {
      q = "",
      category = "all",
      city = "all",
      lifecycle = "all",
      mapLimit: rawMapLimit = "500",
      sort = "orders_desc",
    } = req.query;

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const data = await getSellerLocationsData({
      q,
      category,
      city,
      lifecycle,
      mapLimit: rawMapLimit,
      sort,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Seller locations fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getActiveSellers = async (req, res) => {
  try {
    const { q = "", category = "all", sort = "recent" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const data = await getActiveSellersData({
      q,
      category,
      sort,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Active sellers fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSellers = async (req, res) => {
  try {
    const sellers = await getSellerOptions();
    return handleResponse(res, 200, "Sellers fetched", sellers);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSellerById = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findById(id).lean();
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    // Get order stats for this seller
    const orderStatsArray = await Order.aggregate([
      { $match: { seller: seller._id } },
      {
        $group: {
          _id: "$seller",
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          },
          pendingOrders: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "confirmed", "packed", "out_for_delivery"]] },
                1, 0
              ]
            }
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                { $ifNull: ["$pricing.total", 0] },
                0
              ]
            }
          }
        }
      }
    ]);

    const orderStats = orderStatsArray[0] || {
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0
    };

    // Get product stats
    const productStatsArray = await Product.aggregate([
      { $match: { sellerId: seller._id } },
      {
        $group: {
          _id: "$sellerId",
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
          }
        }
      }
    ]);

    const productStats = productStatsArray[0] || {
      totalProducts: 0,
      activeProducts: 0
    };

    const joinedDate = new Date(seller.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const responseData = {
      ...seller,
      id: String(seller._id),
      joinedDate,
      walletBalance: seller.walletBalance || 0,
      totalOrders: orderStats.totalOrders,
      deliveredOrders: orderStats.deliveredOrders,
      cancelledOrders: orderStats.cancelledOrders,
      pendingOrders: orderStats.pendingOrders,
      totalRevenue: orderStats.totalRevenue,
      totalProducts: productStats.totalProducts,
      activeProducts: productStats.activeProducts,
      coords: {
        lat: seller.location?.coordinates[1] || 0,
        lng: seller.location?.coordinates[0] || 0
      }
    };

    return handleResponse(res, 200, "Seller details fetched successfully", responseData);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateSellerByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const seller = await Seller.findById(id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    // Apply updates
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        seller[key] = updateData[key];
      }
    });

    if (updateData.lat !== undefined && updateData.lng !== undefined) {
      seller.location = {
        type: "Point",
        coordinates: [Number(updateData.lng), Number(updateData.lat)],
      };
    }

    const updatedSeller = await seller.save();
    return handleResponse(res, 200, "Seller updated successfully by admin", updatedSeller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
