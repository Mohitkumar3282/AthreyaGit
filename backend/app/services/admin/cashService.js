import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import Transaction from "../../models/transaction.js";
import Notification from "../../models/notification.js";
import { reconcileCodCash } from "../finance/orderFinanceService.js";
import { roundCurrency } from "../../utils/money.js";

export async function getDeliveryCashBalancesData({ page, limit, skip }) {
  const ridersPipeline = [
    // Only real, approved riders (deleted / never-approved accounts were
    // cluttering the Collect Cash list).
    { $match: { deletedAt: null, isVerified: true } },
    {
      $lookup: {
        from: "transactions",
        localField: "_id",
        foreignField: "user",
        as: "allTransactions",
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "deliveryBoy",
        as: "allOrders",
      },
    },
    {
      $project: {
        name: 1,
        phone: 1,
        avatar: 1,
        limit: { $ifNull: ["$limit", 5000] },
        documents: 1,
        // COD cash the rider has collected and not yet handed over — the same
        // figure the rider sees on their COD Cash page (was read from the
        // legacy transaction log, which new COD collections never reach).
        currentCash: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$allOrders",
                  as: "order",
                  cond: {
                    $and: [
                      { $eq: ["$$order.paymentMode", "COD"] },
                      { $ne: ["$$order.status", "cancelled"] },
                      { $eq: ["$$order.financeFlags.codMarkedCollected", true] },
                    ],
                  },
                },
              },
              as: "o",
              in: { $ifNull: ["$$o.paymentBreakdown.codPendingAmount", 0] },
            },
          },
        },
        // COD orders the rider is carrying now (assigned, not yet delivered).
        pendingOrders: {
          $size: {
            $filter: {
              input: "$allOrders",
              as: "order",
              cond: {
                $and: [
                  {
                    $in: [
                      "$$order.workflowStatus",
                      ["DELIVERY_ASSIGNED", "PICKUP_READY", "OUT_FOR_DELIVERY"],
                    ],
                  },
                  { $eq: ["$$order.paymentMode", "COD"] },
                ],
              },
            },
          },
        },
        totalOrders: {
          $size: {
            $filter: {
              input: "$allOrders",
              as: "order",
              cond: { $eq: ["$$order.status", "delivered"] },
            },
          },
        },
        lastSettlementTxn: {
          $arrayElemAt: [
            {
              $sortArray: {
                input: {
                  $filter: {
                    input: "$allTransactions",
                    as: "transaction",
                    cond: {
                      $eq: ["$$transaction.type", "Cash Settlement"],
                    },
                  },
                },
                sortBy: { createdAt: -1 },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        id: "$_id",
        name: 1,
        phone: 1,
        // Profile photo or nothing (the page shows a default icon). No
        // third-party avatar URL built from the rider's name.
        avatar: { $ifNull: ["$documents.profileImage", null] },
        currentCash: 1,
        limit: 1,
        status: {
          $cond: [
            { $gt: ["$currentCash", 4500] },
            "critical",
            {
              $cond: [
                { $gt: ["$currentCash", 3000] },
                "warning",
                "safe",
              ],
            },
          ],
        },
        pendingOrders: 1,
        totalOrders: 1,
        lastSettlement: {
          $ifNull: ["$lastSettlementTxn.createdAt", "Never"],
        },
      },
    },
    {
      $facet: {
        meta: [{ $count: "total" }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const [aggregateResult] = await Delivery.aggregate(ridersPipeline);
  const meta = aggregateResult?.meta?.[0];
  // Round to paise (summing decimals gave values like 57.400000000000006).
  const riders = (aggregateResult?.items ?? []).map((rider) => ({
    ...rider,
    currentCash: roundCurrency(rider.currentCash || 0),
  }));
  const total = meta?.total ?? 0;

  const totalInHand = roundCurrency(
    riders.reduce((accumulator, rider) => accumulator + (rider.currentCash || 0), 0),
  );
  const overLimitCount = riders.filter(
    (rider) => (rider.currentCash || 0) >= (rider.limit || 5000),
  ).length;

  return {
    items: riders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalInHand,
      overLimitCount,
      avgBalance: riders.length ? roundCurrency(totalInHand / riders.length) : 0,
    },
  };
}

export async function settleRiderCashEntry({ riderId, amount, method }) {
  if (!riderId || !amount || amount <= 0) {
    throw new Error("Missing riderId or invalid amount");
  }

  const rider = await Delivery.findById(riderId);
  if (!rider) {
    return null;
  }

  // Settle against the rider's real COD orders (oldest first) so the rider's
  // cash-in-hand, each order's COD remitted amount and the platform wallet
  // all update \u2014 the same path the rider's own "submit cash" uses. It used to
  // only write a log row, leaving the cash still showing as held.
  const codOrders = await Order.find({
    deliveryBoy: riderId,
    paymentMode: "COD",
    status: { $ne: "cancelled" },
    "financeFlags.codMarkedCollected": true,
    "paymentBreakdown.codPendingAmount": { $gt: 0 },
  })
    .select("orderId paymentBreakdown.codPendingAmount")
    .sort({ createdAt: 1 })
    .lean();

  const totalHeld = roundCurrency(
    codOrders.reduce((sum, o) => sum + Number(o?.paymentBreakdown?.codPendingAmount || 0), 0),
  );
  const requested = roundCurrency(amount);
  if (totalHeld <= 0) {
    const err = new Error("This rider has no collected COD cash to settle.");
    err.statusCode = 400;
    throw err;
  }
  if (requested > totalHeld) {
    const err = new Error(`This rider holds only \u20B9${totalHeld}. Enter up to that amount.`);
    err.statusCode = 400;
    throw err;
  }

  let remaining = requested;
  const settledOrders = [];
  for (const order of codOrders) {
    if (remaining <= 0) break;
    const pending = roundCurrency(order?.paymentBreakdown?.codPendingAmount || 0);
    const settleAmount = roundCurrency(Math.min(pending, remaining));
    if (settleAmount <= 0) continue;
    await reconcileCodCash(order._id, settleAmount, riderId, {
      metadata: { source: "admin_cash_collection", method: method || "Cash" },
    });
    remaining = roundCurrency(remaining - settleAmount);
    settledOrders.push({ orderId: order.orderId, amount: settleAmount });
  }

  // Settlement record (drives "Last settle date" and the settlement history).
  const settlement = await Transaction.create({
    user: riderId,
    userModel: "Delivery",
    type: "Cash Settlement",
    amount: -Math.abs(requested),
    status: "Settled",
    reference: `CSH-SET-${Date.now()}`,
    notes: `Method: ${method || "Cash"}`,
    meta: { source: "admin_cash_collection", orders: settledOrders.map((o) => o.orderId) },
  });

  await Notification.create({
    recipient: riderId,
    recipientModel: "Delivery",
    title: "Cash Settled",
    message: `Admin has collected \u20B9${requested} cash from you. Your balance is updated.`,
    type: "payment",
    data: { transactionId: settlement._id },
  });

  return settlement;
}

/** Delivered COD orders whose cash the rider still holds (eye-icon details). */
export async function getRiderCashDetailsData(riderId) {
  const orders = await Order.find({
    deliveryBoy: riderId,
    paymentMode: "COD",
    status: { $ne: "cancelled" },
    "financeFlags.codMarkedCollected": true,
    "paymentBreakdown.codPendingAmount": { $gt: 0 },
  })
    .select("orderId paymentBreakdown.codPendingAmount deliveredAt createdAt")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return orders.map((order) => {
    const when = order.deliveredAt || order.createdAt;
    return {
      id: order.orderId,
      amount: roundCurrency(order.paymentBreakdown?.codPendingAmount || 0),
      time: new Date(when).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      }),
      date: when,
    };
  });
}

export async function getCashSettlementHistoryData({ page, limit, skip }) {
  const query = { userModel: "Delivery", type: "Cash Settlement" };

  const [history, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  const items = history.map((entry) => ({
    id: (entry.reference || entry._id).toString(),
    rider: entry.user?.name || "Unknown Rider",
    amount: Math.abs(entry.amount),
    date: entry.createdAt,
    method: entry.notes?.replace("Method: ", "") || "Cash Submission",
    status: "completed",
  }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
