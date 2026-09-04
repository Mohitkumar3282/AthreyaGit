import Setting from "../models/setting.js";
import { percentOf, roundCurrency } from "../utils/money.js";

/**
 * Wallet Cashback — the retention loop.
 *
 * After an order is delivered, a flat percentage (1% by default) of the
 * savings the customer actually realised on it is credited straight to their
 * rupee Wallet balance. That balance is then spendable at checkout, where it
 * is deducted from the final order amount.
 *
 * Deliberately boring: no tiers, no expiry, no points. One rate, one balance,
 * one redemption path — the money moves through the existing audited
 * `Wallet` / `LedgerEntry` pipeline rather than a parallel currency.
 *
 * Savings base = catalog savings (MRP minus the price paid) + coupon discount.
 * It excludes the wallet redemption itself, so spending wallet balance cannot
 * mint more wallet balance.
 *
 * Rounding is done in paise via `percentOf`, so ₹20 of savings yields exactly
 * ₹0.20 rather than a truncated ₹0.
 */

export const DEFAULT_CASHBACK_SETTINGS = {
  // OFF by default: Athreya Coins is the live retention loop and already
  // returns 1% of savings (1 coin per ₹1 saved, 1 coin = 1 paisa). Enabling
  // both would reward the same savings twice. Kept configurable so the
  // platform can switch from coins to plain rupee cashback without a deploy.
  enabled: false,
  // Percentage of realised savings credited back to the wallet.
  ratePercent: 1,
  // Smallest credit worth writing a ledger row for. Below this the cashback
  // is skipped entirely rather than crediting a fraction of a paisa.
  minCashbackAmount: 0.01,
  // 0 = uncapped.
  maxCashbackPerOrder: 0,
};

function toFiniteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeCashbackSettings(raw = {}) {
  const source =
    raw && raw.walletCashback && typeof raw.walletCashback === "object"
      ? raw.walletCashback
      : raw || {};

  return {
    enabled:
      source.enabled === undefined ? DEFAULT_CASHBACK_SETTINGS.enabled : !!source.enabled,
    ratePercent: Math.min(
      100,
      Math.max(0, toFiniteNumber(source.ratePercent, DEFAULT_CASHBACK_SETTINGS.ratePercent)),
    ),
    minCashbackAmount: Math.max(
      0,
      toFiniteNumber(source.minCashbackAmount, DEFAULT_CASHBACK_SETTINGS.minCashbackAmount),
    ),
    maxCashbackPerOrder: Math.max(
      0,
      toFiniteNumber(
        source.maxCashbackPerOrder,
        DEFAULT_CASHBACK_SETTINGS.maxCashbackPerOrder,
      ),
    ),
  };
}

export async function getCashbackSettings({ session = null } = {}) {
  try {
    const query = Setting.findOne({}, { walletCashback: 1 }).lean();
    if (session) query.session(session);
    const setting = await query;
    return normalizeCashbackSettings(setting || {});
  } catch {
    // A settings read failure must never break checkout or delivery.
    return normalizeCashbackSettings({});
  }
}

/**
 * Cashback in rupees for a given savings amount.
 *
 *   ₹20 saved  -> ₹0.20
 *   ₹100 saved -> ₹1.00
 */
export function computeCashbackForSavings(
  savingsAmount,
  settings = DEFAULT_CASHBACK_SETTINGS,
) {
  const config = normalizeCashbackSettings(settings);
  if (!config.enabled || config.ratePercent <= 0) return 0;

  const savings = Math.max(0, toFiniteNumber(savingsAmount, 0));
  if (savings <= 0) return 0;

  let cashback = percentOf(savings, config.ratePercent);
  if (config.maxCashbackPerOrder > 0) {
    cashback = Math.min(cashback, roundCurrency(config.maxCashbackPerOrder));
  }
  if (cashback < config.minCashbackAmount) return 0;

  return roundCurrency(cashback);
}

/**
 * Savings an order actually delivered to the customer: catalog discount
 * (MRP minus price paid) plus any coupon discount.
 *
 * Accepts either a payment breakdown or a persisted order — both expose the
 * same two fields, on `paymentBreakdown` for an order.
 */
export function resolveSavingsBase(source = {}) {
  const breakdown = source?.paymentBreakdown || source || {};
  return roundCurrency(
    Math.max(0, Number(breakdown.productSavings || 0)) +
      Math.max(0, Number(breakdown.discountTotal || 0)),
  );
}

export default {
  computeCashbackForSavings,
  getCashbackSettings,
  normalizeCashbackSettings,
  resolveSavingsBase,
  DEFAULT_CASHBACK_SETTINGS,
};
