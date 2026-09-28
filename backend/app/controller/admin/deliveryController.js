import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import Transaction from "../../models/transaction.js";
import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import { WORKFLOW_STATUS } from "../../constants/orderWorkflow.js";
import { debitWallet, creditWallet } from "../../services/finance/walletService.js";
import { OWNER_TYPE, LEDGER_TRANSACTION_TYPE } from "../../constants/finance.js";

export const getDeliveryPartners = async (req, res) => {
  try {
    const { status, verified } = req.query;
    const query = {};

    if (status === "online") {
      query.isOnline = true;
    } else if (status === "offline") {
      query.isOnline = false;
    }

    if (verified === "true") {
      query.isVerified = true;
    } else if (verified === "false") {
      query.isVerified = false;
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const [deliveryPartners, total] = await Promise.all([
      Delivery.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Delivery.countDocuments(query),
    ]);

    // Real completed-order count per rider on this page — one aggregate for
    // the whole page rather than a query per row.
    let completedById = new Map();
    if (deliveryPartners.length) {
      const counts = await Order.aggregate([
        {
          $match: {
            deliveryBoy: { $in: deliveryPartners.map((d) => d._id) },
            workflowStatus: WORKFLOW_STATUS.DELIVERED,
          },
        },
        { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } },
      ]);
      completedById = new Map(counts.map((c) => [String(c._id), c.count]));
    }
    const items = deliveryPartners.map((d) => ({
      ...d,
      totalOrders: completedById.get(String(d._id)) || 0,
    }));

    return handleResponse(res, 200, "Delivery partners fetched successfully", {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findByIdAndUpdate(
      id,
      { isVerified: true },
      { new: true },
    );

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    return handleResponse(res, 200, "Rider approved successfully", rider);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findByIdAndDelete(id);

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    return handleResponse(
      res,
      200,
      "Rider application rejected and removed",
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Admin reviews a rider flagged for repeated post-acceptance cancellations
 * (see riderCancelAssignmentAtomic + RIDER_CANCELLATION_REVIEW_THRESHOLD).
 * Either dismisses the flag (cancellations were judged justified) or applies
 * an explicit penalty — this is the ONLY place a cancellation penalty is
 * ever applied; nothing in the workflow does it automatically.
 */
export const reviewRiderCancellations = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, amount, reason } = req.body || {};

    const rider = await Delivery.findById(id);
    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    if (action === "penalize") {
      const penaltyAmount = Number(amount);
      if (!Number.isFinite(penaltyAmount) || penaltyAmount <= 0) {
        return handleResponse(res, 400, "A positive penalty amount is required");
      }
      if (!String(reason || "").trim()) {
        return handleResponse(res, 400, "A reason is required to apply a penalty");
      }

      try {
        await debitWallet({
          ownerType: OWNER_TYPE.DELIVERY_PARTNER,
          ownerId: id,
          amount: penaltyAmount,
          ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
          ledgerDescription: `Cancellation policy penalty: ${reason.trim()}`,
        });
      } catch (walletErr) {
        return handleResponse(res, 400, walletErr.message);
      }

      rider.penaltyLog.push({
        amount: penaltyAmount,
        reason: reason.trim(),
        appliedBy: req.user.id,
      });
    } else if (action !== "dismiss") {
      return handleResponse(res, 400, "action must be 'penalize' or 'dismiss'");
    }

    rider.flaggedForReview = false;
    await rider.save();

    return handleResponse(res, 200, "Review recorded", rider);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Admin manually awards an incentive/bonus to a rider — the only producer of
 * "Incentive"/"Bonus" transactions today. There's no automated rule engine
 * (e.g. "₹50 for 10 deliveries in a day") behind this yet; this just makes
 * the existing read-side (earnings dashboard) capable of showing a real
 * non-zero incentive/bonus instead of one nothing can ever create.
 */
export const awardRiderIncentive = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, reason } = req.body || {};

    if (!["Incentive", "Bonus"].includes(type)) {
      return handleResponse(res, 400, "type must be 'Incentive' or 'Bonus'");
    }
    const awardAmount = Number(amount);
    if (!Number.isFinite(awardAmount) || awardAmount <= 0) {
      return handleResponse(res, 400, "A positive amount is required");
    }
    if (!String(reason || "").trim()) {
      return handleResponse(res, 400, "A reason is required");
    }

    const rider = await Delivery.findById(id);
    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    await creditWallet({
      ownerType: OWNER_TYPE.DELIVERY_PARTNER,
      ownerId: id,
      amount: awardAmount,
      ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
      ledgerDescription: `${type}: ${reason.trim()}`,
    });

    // Mirrors it into the legacy Transaction ledger the earnings page reads
    // from, so it actually shows up on the rider's earnings breakdown.
    await Transaction.create({
      user: id,
      userModel: "Delivery",
      type,
      amount: awardAmount,
      status: "Settled",
      reference: `${type.toUpperCase()}-${id}-${Date.now()}`,
      meta: { reason: reason.trim(), awardedBy: req.user.id },
    });

    return handleResponse(res, 200, `${type} awarded successfully`, { riderId: id });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getActiveFleet = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const query = {
      deliveryBoy: { $ne: null },
      status: {
        $in: ["confirmed", "packed", "shipped", "out_for_delivery"],
      },
    };

    const [activeOrders, total] = await Promise.all([
      Order.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("deliveryBoy", "name phone documents vehicleType")
        .populate("seller", "shopName address name")
        .populate("customer", "name phone")
        .lean(),
      Order.countDocuments(query),
    ]);

    const fleetData = activeOrders.map((order) => ({
      id: order.orderId,
      status:
        order.status === "out_for_delivery"
          ? "On the Way"
          : order.status === "packed"
            ? "At Pickup"
            : order.status === "shipped"
              ? "In Transit"
              : "Assigned",
      deliveryBoy: {
        name: order.deliveryBoy?.name || "Unknown",
        phone: order.deliveryBoy?.phone || "N/A",
        id: order.deliveryBoy?._id || "N/A",
        vehicle: order.deliveryBoy?.vehicleType || "N/A",
        image:
          order.deliveryBoy?.documents?.profileImage ||
          "https://via.placeholder.com/200",
      },
      seller: {
        name: order.seller?.shopName || order.seller?.name || "Unknown",
      },
      customer: {
        name: order.customer?.name || "Guest",
        phone: order.customer?.phone || "N/A",
      },
      lastUpdate: order.updatedAt,
    }));

    return handleResponse(res, 200, "Active fleet fetched successfully", {
      items: fleetData,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
