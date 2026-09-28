/**
 * DeliveryEarningsService
 *
 * Owns the read-side aggregations for the delivery partner's dashboard:
 *   - getDeliveryStats         ← getDeliveryStats handler
 *   - getDeliveryEarnings      ← getDeliveryEarnings handler
 *   - getDeliveryCodCashSummary ← getDeliveryCodCashSummary handler
 *
 * Framework-agnostic. Inputs are primitives; output shapes match the
 * existing HTTP response payloads byte-for-byte so frontend consumers see
 * no change.
 *
 * Throws errors with `err.statusCode` for the auth-failure cases the COD
 * summary handler used to handle inline.
 */

import mongoose from "mongoose";
import Order from "../../models/order.js";
import Transaction from "../../models/transaction.js";
import Wallet from "../../models/wallet.js";
import { roundCurrency } from "../../utils/money.js";
import { buildKey, getOrSet, getTTL } from "../cacheService.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toDeliveryBoyId(rawId) {
  if (rawId == null) {
    throw svcErr("Unauthorized", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw svcErr("Invalid user id", 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

/**
 * Dashboard summary: total deliveries, today's earnings, incentives, cash in hand.
 * Cached for ~30s (`deliveryStats` TTL) to absorb dashboard polling.
 */
export async function getDeliveryStats(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "stats", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryStats(deliveryBoyId),
    getTTL("deliveryStats"),
  );
}

async function computeDeliveryStats(deliveryBoyId) {
  const orders = await Order.find({
    deliveryBoy: deliveryBoyId,
    status: "delivered",
  })
    .select("_id")
    .lean();
  const totalDeliveries = orders.length;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const allTransactions = await Transaction.find({
    user: deliveryBoyId,
    userModel: "Delivery",
    createdAt: { $gte: startOfToday },
  }).lean();

  const todayEarnings = allTransactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Delivery Earning" ||
          t.type === "Incentive" ||
          t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const incentives = allTransactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Incentive" || t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();
  const cashCollected = roundCurrency(wallet?.cashInHand || 0);

  return {
    today: todayEarnings,
    deliveries: totalDeliveries,
    incentives,
    cashCollected,
  };
}

/** Start-of-range cutoff for each earnings tab — "today" is local midnight, others are trailing windows. */
function periodStart(period) {
  const d = new Date();
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "monthly") {
    d.setDate(d.getDate() - 30);
    return d;
  }
  // "weekly" (default)
  d.setDate(d.getDate() - 7);
  return d;
}

// Chart trend window: "today"/"weekly" both show a 7-day trailing trend for
// context (the tab still controls the totals above), "monthly" widens to 30.
function chartDaysForPeriod(period) {
  return period === "monthly" ? 30 : 7;
}

/**
 * Earnings page payload: totals for the selected period, a trailing chart,
 * and the latest 20 transactions. Cached per-period for ~30s
 * (`deliveryEarnings` TTL) to absorb dashboard polling.
 */
export async function getDeliveryEarnings(rawId, period = "weekly") {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const normalizedPeriod = ["today", "weekly", "monthly"].includes(period)
    ? period
    : "weekly";
  const cacheKey = buildKey(
    "delivery",
    "earnings",
    String(deliveryBoyId),
    normalizedPeriod,
  );
  return getOrSet(
    cacheKey,
    () => computeDeliveryEarnings(deliveryBoyId, normalizedPeriod),
    getTTL("deliveryEarnings"),
  );
}

async function computeDeliveryEarnings(deliveryBoyId, period = "weekly") {
  const rangeStart = periodStart(period);

  const transactions = await Transaction.find({
    user: deliveryBoyId,
    userModel: "Delivery",
    createdAt: { $gte: rangeStart },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    // Narrow projection on populated order keeps the response small and
    // avoids accidental N+1 over un-needed fields.
    .populate("order", "orderId pricing paymentBreakdown");

  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();

  const totalEarnings = transactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Delivery Earning" ||
          t.type === "Incentive" ||
          t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const tipsReceived = transactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce(
      (acc, t) =>
        acc +
        Number(
          t?.meta?.tipAmount ??
            t?.order?.paymentBreakdown?.riderTipAmount ??
            t?.order?.pricing?.tip ??
            0,
        ),
      0,
    );

  const onlinePay = transactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce((acc, t) => acc + t.amount, 0);

  const incentives = transactions
    .filter(
      (t) =>
        (t.type === "Incentive" || t.type === "Bonus") && t.status === "Settled",
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const cashCollected = roundCurrency(wallet?.cashInHand || 0);

  // Chart always shows a trailing trend window — "today" still gets 7 days
  // of context around it, "monthly" widens to 30.
  const chartDays = chartDaysForPeriod(period);
  const chartRangeStart = new Date();
  chartRangeStart.setDate(chartRangeStart.getDate() - (chartDays - 1));
  chartRangeStart.setHours(0, 0, 0, 0);

  const dailyAggregation = await Transaction.aggregate([
    {
      $match: {
        user: deliveryBoyId,
        userModel: "Delivery",
        status: "Settled",
        createdAt: { $gte: chartRangeStart },
        type: { $in: ["Delivery Earning", "Incentive", "Bonus"] },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const chartData = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const foundAt = dailyAggregation.find((a) => a._id === dateStr);
    chartData.push({
      name: chartDays > 7 ? String(d.getDate()) : DAY_NAMES[d.getDay()],
      earnings: foundAt ? foundAt.amount : 0,
      incentives: 0,
    });
  }

  return {
    period,
    totalEarnings,
    onlinePay,
    incentives,
    tipsReceived,
    cashCollected,
    chartData,
    transactions: transactions.slice(0, 20),
  };
}

/**
 * COD cash summary: system float, cash in hand, per-order toRemit/toCollect.
 * Cached for ~30s (`deliveryCodSummary` TTL).
 */
export async function getDeliveryCodCashSummary(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "codSummary", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryCodCashSummary(deliveryBoyId),
    getTTL("deliveryCodSummary"),
  );
}

async function computeDeliveryCodCashSummary(deliveryBoyId) {
  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();

  const orders = await Order.find({
    deliveryBoy: deliveryBoyId,
    paymentMode: "COD",
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "cancelled" },
  })
    .select(
      "orderId status orderStatus deliveredAt createdAt financeFlags paymentBreakdown pricing",
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const normalized = orders.map((order) => {
    const codMarkedCollected = Boolean(
      order.financeFlags?.codMarkedCollected,
    );
    const gross = roundCurrency(
      order.paymentBreakdown?.grandTotal ?? order.pricing?.total ?? 0,
    );
    const riderCommission = roundCurrency(
      order.paymentBreakdown?.riderPayoutTotal ?? 0,
    );

    const estimatedNet = roundCurrency(Math.max(gross - riderCommission, 0));
    const pendingNet = roundCurrency(
      order.paymentBreakdown?.codPendingAmount ?? 0,
    );
    const contribution = codMarkedCollected ? pendingNet : estimatedNet;

    return {
      orderId: order.orderId,
      status: order.status,
      orderStatus: order.orderStatus,
      deliveredAt: order.deliveredAt || null,
      createdAt: order.createdAt || null,
      codMarkedCollected,
      amountGross: gross,
      riderCommission,
      amountNetExpected: estimatedNet,
      amountNetPending: pendingNet,
      systemFloatContribution: contribution,
    };
  });

  const systemFloatCOD = roundCurrency(
    normalized.reduce(
      (sum, row) => sum + Number(row.systemFloatContribution || 0),
      0,
    ),
  );

  const toRemit = normalized
    .filter(
      (row) => row.codMarkedCollected && Number(row.amountNetPending || 0) > 0,
    )
    .slice(0, 50);

  const toCollect = normalized
    .filter(
      (row) =>
        !row.codMarkedCollected && Number(row.amountNetExpected || 0) > 0,
    )
    .slice(0, 50);

  return {
    systemFloatCOD,
    cashInHand: roundCurrency(wallet?.cashInHand || 0),
    toRemit,
    toCollect,
  };
}

export default {
  getDeliveryStats,
  getDeliveryEarnings,
  getDeliveryCodCashSummary,
};
