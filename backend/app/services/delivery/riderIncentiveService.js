import Order from "../../models/order.js";
import Delivery from "../../models/delivery.js";
import Transaction from "../../models/transaction.js";
import Setting from "../../models/setting.js";
import { creditWallet } from "../finance/walletService.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE } from "../../constants/finance.js";
import logger from "../logger.js";

/**
 * Rider incentive engine. Every rule is read from Settings.riderIncentives
 * (edited in Admin -> Rider Incentives), so changes apply without a deploy and
 * the Rider App picks them up on its next fetch.
 */

export const DEFAULT_RIDER_INCENTIVES = {
  dailyTargets: {
    enabled: true,
    // Highest reached tier only: 8 orders = 80, 15 = 180, 22+ = 300 (the tier's
    // total, not cumulative).
    tiers: [
      { orders: 8, bonus: 80 },
      { orders: 15, bonus: 180 },
      { orders: 22, bonus: 300 },
    ],
  },
  peakHours: {
    enabled: true,
    windows: [
      { start: "12:00", end: "15:00", bonus: 10 },
      { start: "19:00", end: "22:00", bonus: 15 },
    ],
  },
  weeklyBonus: { enabled: true, minOrders: 100, minRating: 4.8, bonus: 500 },
  // enabled = feature on; active = admin has switched "it is raining" on right now.
  rain: { enabled: true, active: false, bonusPerDelivery: 15 },
  breaks: { enabled: true, durations: [15, 30, 60] },
};

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeIncentiveConfig(raw = {}) {
  const d = DEFAULT_RIDER_INCENTIVES;
  const tiers = Array.isArray(raw.dailyTargets?.tiers) ? raw.dailyTargets.tiers : d.dailyTargets.tiers;
  const windows = Array.isArray(raw.peakHours?.windows) ? raw.peakHours.windows : d.peakHours.windows;
  const durations = Array.isArray(raw.breaks?.durations) ? raw.breaks.durations : d.breaks.durations;
  return {
    dailyTargets: {
      enabled: raw.dailyTargets?.enabled ?? d.dailyTargets.enabled,
      tiers: tiers
        .map((t) => ({ orders: Math.floor(num(t.orders)), bonus: num(t.bonus) }))
        .filter((t) => t.orders > 0 && t.bonus > 0)
        .sort((a, b) => a.orders - b.orders),
    },
    peakHours: {
      enabled: raw.peakHours?.enabled ?? d.peakHours.enabled,
      windows: windows
        .filter((w) => HHMM.test(w.start) && HHMM.test(w.end))
        .map((w) => ({ start: w.start, end: w.end, bonus: Math.max(num(w.bonus), 0) })),
    },
    weeklyBonus: {
      enabled: raw.weeklyBonus?.enabled ?? d.weeklyBonus.enabled,
      minOrders: Math.max(Math.floor(num(raw.weeklyBonus?.minOrders, d.weeklyBonus.minOrders)), 1),
      minRating: Math.max(num(raw.weeklyBonus?.minRating, d.weeklyBonus.minRating), 0),
      bonus: Math.max(num(raw.weeklyBonus?.bonus, d.weeklyBonus.bonus), 0),
    },
    rain: {
      enabled: raw.rain?.enabled ?? d.rain.enabled,
      active: raw.rain?.active ?? d.rain.active,
      bonusPerDelivery: Math.max(num(raw.rain?.bonusPerDelivery, d.rain.bonusPerDelivery), 0),
    },
    breaks: {
      enabled: raw.breaks?.enabled ?? d.breaks.enabled,
      durations: durations.map((m) => Math.floor(num(m))).filter((m) => m > 0 && m <= 240),
    },
  };
}

export async function getIncentiveConfig() {
  const doc = await Setting.findOne({ $or: [{ tenantId: null }, { tenantId: { $exists: false } }] })
    .select("riderIncentives")
    .lean();
  return normalizeIncentiveConfig(doc?.riderIncentives || {});
}

// ---- IST (Asia/Kolkata, UTC+5:30) calendar helpers -------------------------
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const toIst = (date) => new Date(date.getTime() + IST_OFFSET_MS); // read with getUTC*
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (ist) =>
  `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;

function istDayStart(date = new Date()) {
  const ist = toIst(date);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}
function istWeekStart(date = new Date()) {
  const ist = toIst(date);
  const sinceMonday = (ist.getUTCDay() + 6) % 7;
  return new Date(istDayStart(date).getTime() - sinceMonday * 86400000);
}
const minutesOfDay = (ist) => ist.getUTCHours() * 60 + ist.getUTCMinutes();
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

export function activePeakWindow(config, date = new Date()) {
  if (!config.peakHours.enabled) return null;
  const now = minutesOfDay(toIst(date));
  return (
    config.peakHours.windows.find((w) => {
      const s = toMin(w.start);
      const e = toMin(w.end);
      return s <= e ? now >= s && now < e : now >= s || now < e;
    }) || null
  );
}

// ---- awarding --------------------------------------------------------------
// Transaction.reference is unique, so creating the row first makes every award
// idempotent; the wallet is only credited by whoever created the row.
async function award({ riderId, type, amount, reference, reason, order = null }) {
  if (!(amount > 0)) return 0;
  try {
    await Transaction.create({
      user: riderId,
      userModel: "Delivery",
      order: order?._id,
      type,
      amount,
      status: "Settled",
      reference,
      meta: { reason, auto: true },
    });
  } catch (err) {
    if (err?.code === 11000) return 0; // already awarded
    throw err;
  }
  await creditWallet({
    ownerType: OWNER_TYPE.DELIVERY_PARTNER,
    ownerId: riderId,
    amount,
    ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
    ledgerDescription: `${type}: ${reason}`,
    idempotencyKey: `inc:${reference}`,
  });
  return amount;
}

/** Called after a delivery is settled. Never throws into the settlement flow. */
export async function awardDeliveryIncentives(order) {
  try {
    const riderId = order?.deliveryBoy;
    if (!riderId) return;
    const config = await getIncentiveConfig();
    const when = order.deliveredAt ? new Date(order.deliveredAt) : new Date();
    const orderRef = order.orderId || String(order._id);

    // Per-delivery: peak hour + rain
    const peak = activePeakWindow(config, when);
    if (peak && peak.bonus > 0) {
      await award({
        riderId, order, type: "Incentive", amount: peak.bonus,
        reference: `INC-PEAK-${orderRef}`,
        reason: `Peak-hour delivery (${peak.start}-${peak.end})`,
      });
    }
    if (config.rain.enabled && config.rain.active && config.rain.bonusPerDelivery > 0) {
      await award({
        riderId, order, type: "Incentive", amount: config.rain.bonusPerDelivery,
        reference: `INC-RAIN-${orderRef}`,
        reason: "Rain delivery incentive",
      });
    }

    // Daily target: highest tier only -> pay the difference up to that tier's total.
    if (config.dailyTargets.enabled && config.dailyTargets.tiers.length) {
      const dayStart = istDayStart(when);
      const delivered = await Order.countDocuments({
        deliveryBoy: riderId,
        status: "delivered",
        deliveredAt: { $gte: dayStart, $lt: new Date(dayStart.getTime() + 86400000) },
      });
      const tier = [...config.dailyTargets.tiers].reverse().find((t) => delivered >= t.orders);
      if (tier) {
        const prefix = `INC-DAILY-${riderId}-${dayKey(toIst(when))}-`;
        const paidRows = await Transaction.find({
          user: riderId,
          userModel: "Delivery",
          reference: { $regex: `^${prefix}` },
        }).select("amount").lean();
        const paid = paidRows.reduce((s, r) => s + r.amount, 0);
        await award({
          riderId, type: "Bonus", amount: tier.bonus - paid,
          reference: `${prefix}${tier.orders}`,
          reason: `Daily target: ${tier.orders}+ orders`,
        });
      }
    }

    // Weekly bonus (Mon-Sun IST): once per week
    const wb = config.weeklyBonus;
    if (wb.enabled && wb.bonus > 0) {
      const weekStart = istWeekStart(when);
      const [count, rider] = await Promise.all([
        Order.countDocuments({
          deliveryBoy: riderId,
          status: "delivered",
          deliveredAt: { $gte: weekStart, $lt: new Date(weekStart.getTime() + 7 * 86400000) },
        }),
        Delivery.findById(riderId).select("rating").lean(),
      ]);
      if (count >= wb.minOrders && Number(rider?.rating || 0) >= wb.minRating) {
        await award({
          riderId, type: "Bonus", amount: wb.bonus,
          reference: `INC-WEEK-${riderId}-${dayKey(toIst(weekStart))}`,
          reason: `Weekly bonus: ${wb.minOrders}+ orders & ${wb.minRating}+ rating`,
        });
      }
    }
  } catch (err) {
    logger.error("Rider incentive award failed", { orderId: order?.orderId, error: err.message });
  }
}

// ---- rider-facing status ---------------------------------------------------
export async function getRiderIncentiveStatus(riderId) {
  const config = await getIncentiveConfig();
  const now = new Date();
  const [today, week, rider] = await Promise.all([
    Order.countDocuments({ deliveryBoy: riderId, status: "delivered", deliveredAt: { $gte: istDayStart(now) } }),
    Order.countDocuments({ deliveryBoy: riderId, status: "delivered", deliveredAt: { $gte: istWeekStart(now) } }),
    Delivery.findById(riderId).select("rating breakUntil").lean(),
  ]);
  const nextTier = config.dailyTargets.tiers.find((t) => today < t.orders) || null;
  const reachedTier = [...config.dailyTargets.tiers].reverse().find((t) => today >= t.orders) || null;
  const breakUntil = rider?.breakUntil && new Date(rider.breakUntil) > now ? rider.breakUntil : null;
  return {
    config,
    today: { delivered: today, reachedTier, nextTier },
    week: { delivered: week, rating: Number(rider?.rating || 0) },
    peakNow: activePeakWindow(config, now),
    rainActive: !!(config.rain.enabled && config.rain.active),
    breakUntil,
  };
}

// ---- breaks ----------------------------------------------------------------
export async function startBreak(riderId, minutes) {
  const config = await getIncentiveConfig();
  if (!config.breaks.enabled) {
    const e = new Error("Breaks are currently disabled");
    e.statusCode = 403;
    throw e;
  }
  if (!config.breaks.durations.includes(Number(minutes))) {
    const e = new Error(`Break must be one of: ${config.breaks.durations.join(", ")} minutes`);
    e.statusCode = 400;
    throw e;
  }
  const active = await Order.countDocuments({
    deliveryBoy: riderId,
    status: { $in: ["confirmed", "packed", "out_for_delivery"] },
  });
  if (active > 0) {
    const e = new Error("Finish your current delivery before taking a break");
    e.statusCode = 409;
    throw e;
  }
  const breakUntil = new Date(Date.now() + Number(minutes) * 60000);
  await Delivery.updateOne({ _id: riderId }, { $set: { breakUntil } });
  return breakUntil;
}

export async function endBreak(riderId) {
  await Delivery.updateOne({ _id: riderId }, { $set: { breakUntil: null } });
}
