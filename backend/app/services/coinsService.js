import CoinWallet from "../models/coinWallet.js";
import CoinTransaction from "../models/coinTransaction.js";
import Setting from "../models/setting.js";
import {
  COIN_CREDIT_TRIGGER,
  COIN_DIRECTION,
  COIN_TRANSACTION_TYPE,
  COIN_WALLET_STATUS,
  DEFAULT_COIN_SETTINGS,
} from "../constants/coins.js";
import { roundCurrency } from "../utils/money.js";

/**
 * Athreya Coins — the customer loyalty currency.
 *
 * Earning:   a configurable percentage of the savings a customer actually
 *            realised on an order (MRP to sale-price discount plus any coupon
 *            discount) is converted into coins. Coins are credited when the
 *            order is delivered (`COIN_CREDIT_TRIGGER.DELIVERY`, the default)
 *            so a cancelled order never mints loyalty.
 * Redeeming: at checkout the customer can spend coins for a rupee discount,
 *            capped at `maxRedeemPercentOfOrder` of the order payable so the
 *            platform never ends up owing the rider/seller more than it
 *            collects.
 *
 * Every movement is written to `CoinTransaction` with an optional
 * `idempotencyKey`, which carries a unique-sparse index — a replayed credit
 * (e.g. a delivery settlement retried by a queue worker) resolves to a no-op
 * instead of double-granting.
 */

function toNonNegativeInt(value) {
  const num = Math.floor(Number(value || 0));
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function toFiniteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeCoinSettings(raw = {}) {
  const source =
    raw && raw.athreyaCoins && typeof raw.athreyaCoins === "object" ? raw.athreyaCoins : raw || {};

  // A coin is worth a paisa, so this floors at one paisa — never zero, which
  // would make the coins-to-rupees conversion divide by zero.
  const rupeeValuePerCoin = Math.max(
    0.01,
    toFiniteNumber(source.rupeeValuePerCoin, DEFAULT_COIN_SETTINGS.rupeeValuePerCoin),
  );

  const creditOn =
    source.creditOn === COIN_CREDIT_TRIGGER.PLACEMENT
      ? COIN_CREDIT_TRIGGER.PLACEMENT
      : COIN_CREDIT_TRIGGER.DELIVERY;

  return {
    enabled: source.enabled === undefined ? DEFAULT_COIN_SETTINGS.enabled : !!source.enabled,
    coinsPerRupeeSaved: Math.max(
      0,
      toFiniteNumber(source.coinsPerRupeeSaved, DEFAULT_COIN_SETTINGS.coinsPerRupeeSaved),
    ),
    rupeeValuePerCoin,
    minRedeemCoins: Math.max(
      0,
      Math.floor(toFiniteNumber(source.minRedeemCoins, DEFAULT_COIN_SETTINGS.minRedeemCoins)),
    ),
    maxRedeemPercentOfOrder: Math.min(
      100,
      Math.max(
        0,
        toFiniteNumber(
          source.maxRedeemPercentOfOrder,
          DEFAULT_COIN_SETTINGS.maxRedeemPercentOfOrder,
        ),
      ),
    ),
    maxEarnPerOrder: Math.max(
      0,
      Math.floor(toFiniteNumber(source.maxEarnPerOrder, DEFAULT_COIN_SETTINGS.maxEarnPerOrder)),
    ),
    creditOn,
  };
}

export async function getCoinSettings({ session = null } = {}) {
  try {
    const query = Setting.findOne({}, { athreyaCoins: 1 }).lean();
    if (session) query.session(session);
    const setting = await query;
    return normalizeCoinSettings(setting || {});
  } catch {
    // A settings read failure must never break checkout — fall back to defaults.
    return normalizeCoinSettings({});
  }
}

export function coinsToRupees(coins, settings = DEFAULT_COIN_SETTINGS) {
  const config = normalizeCoinSettings(settings);
  return roundCurrency(toNonNegativeInt(coins) * config.rupeeValuePerCoin);
}

export function rupeesToCoins(rupees, settings = DEFAULT_COIN_SETTINGS) {
  const config = normalizeCoinSettings(settings);
  const amount = Math.max(0, toFiniteNumber(rupees, 0));
  return Math.floor(amount / config.rupeeValuePerCoin);
}

/**
 * How many coins an order's realised savings are worth.
 *
 * "Every ₹1 you save = 1 Paisa Coin" — so this is a direct multiplication
 * rather than a percentage. Expressing it directly (instead of as
 * `savings * rate% / rupeeValuePerCoin`) keeps the headline promise
 * readable in the code and avoids a float division by 0.01.
 *
 * `savingsAmount` is in rupees: (MRP minus paid) plus coupon discount.
 * Partial rupees are floored — ₹36.80 of savings grants 36 coins, never 36.8.
 */
export function computeCoinsForSavings(savingsAmount, settings = DEFAULT_COIN_SETTINGS) {
  const config = normalizeCoinSettings(settings);
  if (!config.enabled) return 0;

  const savings = Math.max(0, toFiniteNumber(savingsAmount, 0));
  if (savings <= 0 || config.coinsPerRupeeSaved <= 0) return 0;

  let coins = Math.floor(savings * config.coinsPerRupeeSaved);
  if (config.maxEarnPerOrder > 0) {
    coins = Math.min(coins, config.maxEarnPerOrder);
  }
  return Math.max(0, coins);
}

/**
 * Clamp a requested redemption to what is actually spendable on this order.
 *
 * Returns the accepted coin count plus the rupee discount it buys. A request
 * that lands below `minRedeemCoins` is rejected outright (returns 0) rather
 * than silently rounded, so the UI and the server agree on the threshold.
 */
export function computeRedeemableCoins({
  requestedCoins = 0,
  balance = 0,
  orderAmount = 0,
  settings = DEFAULT_COIN_SETTINGS,
} = {}) {
  const config = normalizeCoinSettings(settings);
  const empty = { coins: 0, rupeeValue: 0, cappedBy: null, config };

  if (!config.enabled) return { ...empty, cappedBy: "DISABLED" };

  const requested = toNonNegativeInt(requestedCoins);
  if (requested <= 0) return empty;

  const available = toNonNegativeInt(balance);
  if (available <= 0) return { ...empty, cappedBy: "BALANCE" };

  const payable = Math.max(0, toFiniteNumber(orderAmount, 0));
  if (payable <= 0) return { ...empty, cappedBy: "ORDER_AMOUNT" };

  const percentCapRupees = roundCurrency((payable * config.maxRedeemPercentOfOrder) / 100);
  const capRupees = Math.min(percentCapRupees, payable);
  const capCoins = Math.floor(capRupees / config.rupeeValuePerCoin);

  const coins = Math.min(requested, available, capCoins);
  let cappedBy = null;
  if (coins < requested) {
    cappedBy = coins === available ? "BALANCE" : "ORDER_CAP";
  }

  if (coins < config.minRedeemCoins) {
    return { coins: 0, rupeeValue: 0, cappedBy: coins > 0 ? "MIN_REDEEM" : cappedBy, config };
  }

  return {
    coins,
    rupeeValue: roundCurrency(coins * config.rupeeValuePerCoin),
    cappedBy,
    config,
  };
}

/**
 * Largest redemption this customer could make on an order of `orderAmount`.
 * Used by the checkout UI to drive the "use max coins" affordance.
 */
export function computeMaxRedeemableCoins({
  balance = 0,
  orderAmount = 0,
  settings = DEFAULT_COIN_SETTINGS,
} = {}) {
  return computeRedeemableCoins({
    requestedCoins: toNonNegativeInt(balance),
    balance,
    orderAmount,
    settings,
  });
}

export async function getOrCreateCoinWallet(customerId, { session = null } = {}) {
  if (!customerId) throw new Error("customerId is required");

  const options = session ? { session } : {};
  let wallet = await CoinWallet.findOne({ customer: customerId }, null, options);
  if (!wallet) {
    const created = await CoinWallet.create(
      [{ customer: customerId, balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0 }],
      options,
    );
    wallet = created[0];
  }
  return wallet;
}

/** Never throws — a coins read must not be able to break a profile fetch. */
export async function getCoinBalance(customerId, { session = null } = {}) {
  if (!customerId) return 0;
  try {
    const query = CoinWallet.findOne({ customer: customerId }, { balance: 1 }).lean();
    if (session) query.session(session);
    const wallet = await query;
    return toNonNegativeInt(wallet && wallet.balance);
  } catch {
    return 0;
  }
}

export async function getCoinSummary(customerId, { session = null } = {}) {
  const settings = await getCoinSettings({ session });
  if (!customerId) {
    return { balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0, rupeeValue: 0, settings };
  }

  let wallet = null;
  try {
    const query = CoinWallet.findOne(
      { customer: customerId },
      { balance: 1, lifetimeEarned: 1, lifetimeRedeemed: 1, status: 1 },
    ).lean();
    if (session) query.session(session);
    wallet = await query;
  } catch {
    wallet = null;
  }

  const balance = toNonNegativeInt(wallet && wallet.balance);
  return {
    balance,
    lifetimeEarned: toNonNegativeInt(wallet && wallet.lifetimeEarned),
    lifetimeRedeemed: toNonNegativeInt(wallet && wallet.lifetimeRedeemed),
    status: (wallet && wallet.status) || COIN_WALLET_STATUS.ACTIVE,
    rupeeValue: coinsToRupees(balance, settings),
    settings,
  };
}

async function findTransactionByIdempotencyKey(idempotencyKey, { session = null } = {}) {
  if (!idempotencyKey) return null;
  const query = CoinTransaction.findOne({ idempotencyKey }).lean();
  if (session) query.session(session);
  return query;
}

async function recordMovement({
  customerId,
  coins,
  type,
  direction,
  description = "",
  order = null,
  orderId = null,
  checkoutGroupId = null,
  idempotencyKey = null,
  meta = {},
  settings = null,
  session = null,
}) {
  const amount = toNonNegativeInt(coins);
  if (amount <= 0) {
    return { applied: false, coins: 0, balance: await getCoinBalance(customerId, { session }) };
  }

  const existing = await findTransactionByIdempotencyKey(idempotencyKey, { session });
  if (existing) {
    return {
      applied: false,
      duplicate: true,
      coins: existing.coins,
      balance: existing.balanceAfter,
      transaction: existing,
    };
  }

  const config = settings ? normalizeCoinSettings(settings) : await getCoinSettings({ session });
  const wallet = await getOrCreateCoinWallet(customerId, { session });

  if (wallet.status !== COIN_WALLET_STATUS.ACTIVE) {
    const error = new Error("Athreya Coins wallet is not active");
    error.statusCode = 400;
    throw error;
  }

  const before = toNonNegativeInt(wallet.balance);
  const isCredit = direction === COIN_DIRECTION.CREDIT;

  if (!isCredit && before < amount) {
    const error = new Error("Insufficient Athreya Coins balance");
    error.statusCode = 400;
    throw error;
  }

  const after = isCredit ? before + amount : before - amount;
  wallet.balance = after;
  if (isCredit) {
    wallet.lifetimeEarned = toNonNegativeInt(wallet.lifetimeEarned) + amount;
    wallet.lastEarnedAt = new Date();
  } else {
    wallet.lifetimeRedeemed = toNonNegativeInt(wallet.lifetimeRedeemed) + amount;
    wallet.lastRedeemedAt = new Date();
  }
  await wallet.save({ session });

  const created = await CoinTransaction.create(
    [
      {
        customer: customerId,
        type,
        direction,
        coins: amount,
        rupeeValue: coinsToRupees(amount, config),
        balanceBefore: before,
        balanceAfter: after,
        order,
        orderId,
        checkoutGroupId,
        description,
        idempotencyKey: idempotencyKey || null,
        meta,
      },
    ],
    session ? { session } : {},
  );

  return { applied: true, coins: amount, balance: after, transaction: created[0], wallet };
}

export async function creditCoins({
  customerId,
  coins,
  type = COIN_TRANSACTION_TYPE.EARN,
  description = "",
  order = null,
  orderId = null,
  checkoutGroupId = null,
  idempotencyKey = null,
  meta = {},
  settings = null,
  session = null,
}) {
  return recordMovement({
    customerId,
    coins,
    type,
    direction: COIN_DIRECTION.CREDIT,
    description,
    order,
    orderId,
    checkoutGroupId,
    idempotencyKey,
    meta,
    settings,
    session,
  });
}

export async function debitCoins({
  customerId,
  coins,
  type = COIN_TRANSACTION_TYPE.REDEEM,
  description = "",
  order = null,
  orderId = null,
  checkoutGroupId = null,
  idempotencyKey = null,
  meta = {},
  settings = null,
  session = null,
}) {
  return recordMovement({
    customerId,
    coins,
    type,
    direction: COIN_DIRECTION.DEBIT,
    description,
    order,
    orderId,
    checkoutGroupId,
    idempotencyKey,
    meta,
    settings,
    session,
  });
}

export async function listCoinTransactions(customerId, { page = 1, limit = 20 } = {}) {
  const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (currentPage - 1) * perPage;

  const [rows, total] = await Promise.all([
    CoinTransaction.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    CoinTransaction.countDocuments({ customer: customerId }),
  ]);

  return {
    items: rows.map((row) => ({
      _id: row._id,
      type: row.type,
      direction: row.direction,
      coins: row.coins,
      rupeeValue: row.rupeeValue,
      balanceAfter: row.balanceAfter,
      orderId: row.orderId,
      description: row.description,
      // The savings the grant was minted from, so the wallet can show
      // "You saved ₹25 on Order #AD12345" next to the coins.
      savingsBase: Number(row.meta?.savingsBase || 0),
      date: row.createdAt,
    })),
    total,
    page: currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
  };
}

export default {
  coinsToRupees,
  computeCoinsForSavings,
  computeMaxRedeemableCoins,
  computeRedeemableCoins,
  creditCoins,
  debitCoins,
  getCoinBalance,
  getCoinSettings,
  getCoinSummary,
  getOrCreateCoinWallet,
  listCoinTransactions,
  normalizeCoinSettings,
  rupeesToCoins,
};
