import mongoose from "mongoose";
import Cart from "../models/cart.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import Order from "../models/order.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import Coupon from "../models/coupon.js";
import { WORKFLOW_STATUS, DEFAULT_SELLER_TIMEOUT_MS } from "../constants/orderWorkflow.js";
import {
  LEDGER_TRANSACTION_TYPE,
  ORDER_PAYMENT_STATUS,
  OWNER_TYPE,
  isWalletRedemptionReducesPayableEnabled,
  isServerSideCouponEngineEnabled,
} from "../constants/finance.js";
import { incrementCouponUsage } from "./finance/couponService.js";
import { freezeFinancialSnapshot } from "./finance/orderFinanceService.js";
import {
  creditWallet,
  debitWallet,
  getCustomerBalance,
  getOrCreateWallet,
} from "./finance/walletService.js";
import { roundCurrency } from "../utils/money.js";
import LedgerEntry from "../models/ledgerEntry.js";
import {
  generateUniqueCheckoutGroupId,
  generateUniquePublicOrderId,
} from "./orderIdService.js";
import { afterPlaceOrderV2 } from "./orderWorkflowService.js";
import {
  computeStockReservationWindow,
  reserveStockForItems,
} from "./stockService.js";
import { isLowStockAlertsEnabled } from "./lowStockAlertService.js";
import {
  checkIdempotency,
  acquireIdempotencyLock,
  storeIdempotencyResult,
  storeIdempotencyError,
  releaseIdempotencyLock,
  isRetryableError,
  validateIdempotencyKey,
} from "./idempotencyService.js";
import { buildCheckoutPricingSnapshot } from "./checkoutPricingService.js";
import { creditCoins, debitCoins, getCoinBalance } from "./coinsService.js";
import {
  computeCashbackForSavings,
  resolveSavingsBase,
} from "./walletCashbackService.js";
import { COIN_CREDIT_TRIGGER, COIN_TRANSACTION_TYPE } from "../constants/coins.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import * as logger from "./logger.js";

const IDEMPOTENCY_RECORD_TTL_MS = 24 * 60 * 60 * 1000;

function normalizePaymentMode(raw) {
  const mode = String(raw || "COD").trim().toUpperCase();
  return mode === "ONLINE" ? "ONLINE" : "COD";
}

function normalizeAddress(address = {}) {
  const normalized = { ...(address || {}) };
  if (address?.location) {
    const lat = Number(address.location.lat);
    const lng = Number(address.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      delete normalized.location;
    } else {
      normalized.location = { lat, lng };
    }
  }
  return normalized;
}

function mapOrderItemsForPersistence(hydratedItems = []) {
  return hydratedItems.map((item) => ({
    product: item.productId,
    name: item.productName,
    quantity: item.quantity,
    price: item.price,
    variantSlot: String(item.variantSku || item.variantSlot || "").trim() || undefined,
    image: item.image || "",
  }));
}

/**
 * Split an integer total (e.g. Athreya Coins earned for a checkout) across
 * several orders in proportion to `weights`, giving the remainder to the last
 * entry so the parts always sum back to `total` exactly. Falls back to an even
 * split when every weight is zero (a fully discounted checkout).
 */
function allocateIntegerByWeight(total, weights = []) {
  const target = Math.max(0, Math.floor(Number(total) || 0));
  const count = weights.length;
  if (count === 0 || target === 0) return new Array(count).fill(0);

  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, Number(weight) || 0), 0);
  const allocations = new Array(count).fill(0);
  let allocated = 0;

  for (let index = 0; index < count - 1; index += 1) {
    const share =
      totalWeight > 0
        ? Math.floor((Math.max(0, Number(weights[index]) || 0) / totalWeight) * target)
        : Math.floor(target / count);
    allocations[index] = share;
    allocated += share;
  }
  allocations[count - 1] = target - allocated;
  return allocations;
}

function placementSource(payload = {}) {
  return Array.isArray(payload.items) && payload.items.length > 0
    ? "DIRECT_ITEMS"
    : "CART";
}

function toPlain(doc) {
  if (!doc) return doc;
  if (typeof doc.toObject === "function") return doc.toObject();
  return doc;
}

function buildResultPayload({ checkoutGroup, orders }) {
  const plainGroup = toPlain(checkoutGroup);
  const plainOrders = Array.isArray(orders) ? orders.map((item) => toPlain(item)) : [];
  return {
    checkoutGroup: plainGroup,
    orders: plainOrders,
    order: plainOrders[0] || null,
  };
}

async function findExistingCheckoutByIdempotency(customerId, idempotencyKey) {
  if (!idempotencyKey) return null;

  const checkoutGroup = await CheckoutGroup.findOne({
    customer: customerId,
    "placement.idempotencyKey": idempotencyKey,
  }).lean();
  if (checkoutGroup) {
    const orders = await Order.find({
      checkoutGroupId: checkoutGroup.checkoutGroupId,
    })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 })
      .lean();
    return { checkoutGroup, orders };
  }

  const legacyOrder = await Order.findOne({
    customer: customerId,
    "placement.idempotencyKey": idempotencyKey,
  }).lean();
  if (!legacyOrder) return null;
  return {
    checkoutGroup: null,
    orders: [legacyOrder],
  };
}

async function resolveOrderItemsInput({
  payload,
  customerId,
  session,
}) {
  let orderItemsInput = Array.isArray(payload.items) ? payload.items.filter(Boolean) : [];
  if (orderItemsInput.length > 0) {
    return {
      orderItemsInput,
      source: "DIRECT_ITEMS",
      cartDocument: null,
    };
  }

  const cart = await Cart.findOne({ customerId }, null, { session });
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    const err = new Error("Cannot place order with empty cart");
    err.statusCode = 400;
    throw err;
  }

  orderItemsInput = cart.items.map((item) => ({
    product: item.productId,
    variantSku: String(item.variantSku || "").trim(),
    quantity: item.quantity,
  }));
  return {
    orderItemsInput,
    source: "CART",
    cartDocument: cart,
  };
}

async function consumeCartItems({
  customerId,
  source,
  orderItemsInput,
  session,
  cartDocument = null,
}) {
  if (source === "CART") {
    const cart = cartDocument || (await Cart.findOne({ customerId }, null, { session }));
    if (!cart) return;
    cart.items = [];
    await cart.save({ session });
    return;
  }

  const cart = cartDocument || (await Cart.findOne({ customerId }, null, { session }));
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return;
  }

  const requestedQtyByLineKey = new Map();
  for (const item of orderItemsInput || []) {
    const productId = String(item.product || item.productId || "");
    if (!productId) continue;
    const variantSku = String(item.variantSku || item.variantSlot || "").trim();
    const quantity = Math.max(Number(item.quantity || 0), 0);
    if (!quantity) continue;
    const key = `${productId}::${variantSku || ""}`;
    requestedQtyByLineKey.set(key, (requestedQtyByLineKey.get(key) || 0) + quantity);
  }

  const remaining = [];
  for (const cartItem of cart.items) {
    const productId = String(cartItem.productId);
    const variantSku = String(cartItem.variantSku || "").trim();
    const key = `${productId}::${variantSku || ""}`;
    const requested = requestedQtyByLineKey.get(key) || 0;
    if (requested <= 0) {
      remaining.push(cartItem);
      continue;
    }
    const quantityLeft = Number(cartItem.quantity || 0) - requested;
    if (quantityLeft > 0) {
      remaining.push({
        productId: cartItem.productId,
        variantSku,
        quantity: quantityLeft,
      });
    }
    requestedQtyByLineKey.delete(key);
  }

  cart.items = remaining;
  await cart.save({ session });
}

function buildCheckoutGroupStatus(paymentMode) {
  return paymentMode === "ONLINE" ? "PAYMENT_PENDING" : "CREATED";
}

/**
 * Audit Phase 4 (H-5) — lazy-seed of canonical customer Wallet from the
 * legacy `User.walletBalance` so the H-5 debit path works for customers
 * whose Wallet doc never received a credit (legacy customers from before
 * Phase 4 P4-3 dual-write).
 *
 * The seed:
 *   - Reads `Wallet.availableBalance` and `User.walletBalance` inside the
 *     same session that the checkout uses.
 *   - If `User.walletBalance > Wallet.availableBalance`, credits the gap
 *     into the canonical Wallet (no User-side mirror because the User row
 *     already has the higher value).
 *   - Writes a `LedgerEntry({type: ADJUSTMENT})` with a stable
 *     `idempotencyKey = WLT-SEED-<userId>` so re-runs across checkouts
 *     are safe — the partial unique index on `LedgerEntry.idempotencyKey`
 *     guarantees the seed happens at most once per customer.
 *
 * Safe to call when:
 *   - `Wallet.availableBalance >= User.walletBalance` (returns 0; no-op).
 *   - `User.walletBalance === 0` (returns 0; no-op).
 *   - `walletAmount` is 0 at the call site (caller should still skip; this
 *     function does not check).
 */
async function seedCanonicalCustomerWalletFromUser({ customerId, user, session }) {
  if (!customerId) return 0;
  const seedIdempotencyKey = `WLT-SEED-${String(customerId)}`;

  // Idempotency pre-check: if the seed has already fired for this customer
  // we MUST NOT call `creditWallet` again, because creditWallet saves the
  // wallet BEFORE attempting the ledger insert and would double-credit if
  // the ledger then collides on the partial unique index. The pre-check
  // makes the helper safe to call on every checkout.
  const existingSeed = await LedgerEntry.findOne(
    { idempotencyKey: seedIdempotencyKey },
    { _id: 1 },
    { session },
  );
  if (existingSeed) return 0;

  const wallet = await getOrCreateWallet(OWNER_TYPE.CUSTOMER, customerId, { session });
  const userBalance = roundCurrency(user?.walletBalance || 0);
  const walletBalance = roundCurrency(wallet.availableBalance || 0);
  const gap = roundCurrency(userBalance - walletBalance);
  if (gap <= 0) return 0;

  await creditWallet({
    ownerType: OWNER_TYPE.CUSTOMER,
    ownerId: customerId,
    amount: gap,
    bucket: "available",
    session,
    ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
    ledgerReference: seedIdempotencyKey,
    ledgerDescription: "Lazy seed of canonical Wallet from legacy User.walletBalance",
    idempotencyKey: seedIdempotencyKey,
    metadata: { reason: "legacy_user_walletbalance_seed" },
    // The User row is already correct — do not double-credit it.
    syncUserWalletBalance: false,
  });
  return gap;
}

function buildCheckoutGroupPaymentStatus(paymentMode) {
  return paymentMode === "ONLINE"
    ? ORDER_PAYMENT_STATUS.CREATED
    : ORDER_PAYMENT_STATUS.PENDING_CASH_COLLECTION;
}

export async function placeOrderAtomic({
  customerId,
  payload,
  idempotencyKey = null,
  retryCount = 0,
}) {
  const normalizedPayload = {
    ...(payload || {}),
    paymentMode: normalizePaymentMode(payload?.paymentMode),
  };

  if (idempotencyKey) {
    if (!validateIdempotencyKey(idempotencyKey)) {
      const error = new Error("Invalid idempotency key format");
      error.statusCode = 400;
      throw error;
    }

    const idempotencyCheck = await checkIdempotency(idempotencyKey, normalizedPayload);
    if (idempotencyCheck.exists && !idempotencyCheck.checksumMismatch) {
      if (idempotencyCheck.result.status === "error") {
        const error = new Error(idempotencyCheck.result.error.message);
        error.statusCode = idempotencyCheck.result.error.statusCode || 500;
        throw error;
      }
      return {
        ...idempotencyCheck.result.data,
        duplicate: true,
      };
    }
    if (idempotencyCheck.checksumMismatch) {
      const error = new Error("Idempotency key reused with different payload");
      error.statusCode = 422;
      throw error;
    }
    if (idempotencyCheck.inProgress) {
      const error = new Error("Request is being processed");
      error.statusCode = 409;
      throw error;
    }

    const lockAcquired = await acquireIdempotencyLock(idempotencyKey);
    if (!lockAcquired) {
      const error = new Error("Request is being processed");
      error.statusCode = 409;
      throw error;
    }
  }

  const existingByIdempotency = await findExistingCheckoutByIdempotency(customerId, idempotencyKey);
  if (existingByIdempotency) {
    const existingResult = buildResultPayload({
      checkoutGroup: existingByIdempotency.checkoutGroup,
      orders: existingByIdempotency.orders,
    });
    if (idempotencyKey) {
      await storeIdempotencyResult(idempotencyKey, existingResult, normalizedPayload);
    }
    return { ...existingResult, duplicate: true };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: parseInt(process.env.CHECKOUT_TRANSACTION_TIMEOUT_MS || "20000", 10),
    });

    const paymentMode = normalizePaymentMode(normalizedPayload.paymentMode);
    const normalizedAddress = normalizeAddress(normalizedPayload.address);
    const idempotencyKeyExpiry = idempotencyKey
      ? new Date(Date.now() + IDEMPOTENCY_RECORD_TTL_MS)
      : null;
    const source = placementSource(normalizedPayload);
    const walletAmount = Math.max(0, Number(normalizedPayload.walletAmount || 0));
    const tipAmount = Math.max(0, Number(normalizedPayload.tipAmount || 0));
    const coinsRedeemRequested = Math.max(
      0,
      Math.floor(Number(normalizedPayload.coinsRedeem || 0)),
    );

    // 1. Fetch user and validate wallet
    // Audit Phase 4 (M-4): read the canonical wallet balance (Wallet first,
    // User.walletBalance fallback) so customers whose canonical wallet was
    // credited via `walletService.creditWallet` but whose User mirror is
    // stale can still redeem. `getCustomerBalance` is a no-throw helper —
    // we still need `user` further down for the legacy direct-debit path,
    // so we fetch both.
    const user = await User.findById(customerId).session(session);
    if (walletAmount > 0) {
      if (!user) throw new Error("User not found");
      const canonicalBalance = await getCustomerBalance(customerId, { session });
      if (canonicalBalance < walletAmount) {
        throw new Error("Insufficient wallet balance");
      }
    }

    // Athreya Coins: reject outright only when the customer asks for more
    // coins than they hold. Requests that merely exceed the per-order cap
    // are clamped (not rejected) inside `buildCheckoutPricingSnapshot`, so
    // a stale checkout page still places a valid order at a smaller
    // discount rather than failing at the final step.
    if (coinsRedeemRequested > 0) {
      const coinBalance = await getCoinBalance(customerId, { session });
      if (coinBalance < coinsRedeemRequested) {
        const error = new Error("Insufficient Athreya Coins balance");
        error.statusCode = 400;
        throw error;
      }
    }

    const {
      orderItemsInput,
      source: resolvedSource,
      cartDocument,
    } = await resolveOrderItemsInput({
      payload: normalizedPayload,
      customerId,
      session,
    });

    // Audit Phase 4 (C-1): when WALLET_REDEMPTION_REDUCES_PAYABLE is on,
    // pass walletAmount through to the snapshot so the per-seller
    // grandTotal is reduced proportionately. When the flag is off the
    // snapshot ignores it (`grandTotal` stays at the pre-wallet value)
    // and the legacy direct-debit path below preserves bit-for-bit
    // current behaviour.
    //
    // Audit Phase 5 (C-2 + H-6 + H-7): when SERVER_SIDE_COUPON_ENGINE is
    // on, pass couponCode/couponId/customerId so the snapshot ignores
    // the client-supplied `discountTotal` and recomputes the discount
    // from the server-hydrated cart, applying free-delivery rebates
    // server-side. When the flag is off, only `discountTotal` flows
    // through — preserving legacy bit-for-bit behaviour.
    const pricingSnapshot = await buildCheckoutPricingSnapshot({
      orderItems: orderItemsInput,
      address: normalizedAddress,
      tipAmount,
      discountTotal: Math.max(0, Number(normalizedPayload.discountTotal || 0)),
      walletAmount,
      couponCode: normalizedPayload.couponCode || null,
      couponId: normalizedPayload.couponId || null,
      coinsRedeem: coinsRedeemRequested,
      customerId,
      session,
    });

    // The snapshot is the authority on how many coins were actually
    // accepted — the debit below and the per-order persistence both read
    // from it, so the ledger can never drift from the priced discount.
    const coinsRedeemed = Math.max(0, Math.floor(Number(pricingSnapshot.coins?.redeemed || 0)));
    const coinsDiscount = roundCurrency(pricingSnapshot.coins?.discount || 0);
    const coinsEarned = Math.max(0, Math.floor(Number(pricingSnapshot.coins?.earned || 0)));
    const coinsSavingsBase = roundCurrency(pricingSnapshot.coins?.savingsBase || 0);
    const coinSettings = pricingSnapshot.coins?.settings || null;
    const creditCoinsAtPlacement =
      coinSettings?.creditOn === COIN_CREDIT_TRIGGER.PLACEMENT;

    // Wallet Cashback is quoted now and paid on delivery. Freezing the rate
    // on each order means a later rate change cannot alter what an
    // already-placed order promised.
    const cashbackRatePercent = Number(pricingSnapshot.cashback?.ratePercent || 0);

    const checkoutGroupId = await generateUniqueCheckoutGroupId({ session });
    const checkoutReservation = computeStockReservationWindow(paymentMode);
    const checkoutGroup = new CheckoutGroup({
      checkoutGroupId,
      customer: customerId,
      paymentMode,
      paymentStatus: buildCheckoutGroupPaymentStatus(paymentMode),
      status: buildCheckoutGroupStatus(paymentMode),
      stockReservation: checkoutReservation,
      pricingSummary: pricingSnapshot.aggregateBreakdown,
      walletAmount,
      sellerCount: pricingSnapshot.sellerCount,
      itemCount: pricingSnapshot.itemCount,
      addressSnapshot: normalizedAddress,
      placement: {
        idempotencyKey: idempotencyKey || undefined,
        idempotencyKeyExpiry,
        createdFrom: resolvedSource || source,
      },
      expiresAt: checkoutReservation.expiresAt || null,
      metadata: {
        timeSlot: normalizedPayload.timeSlot || "now",
        tipAmount,
        deliveryEta: pricingSnapshot.deliveryEta || null,
        cashback: {
          amount: roundCurrency(pricingSnapshot.cashback?.amount || 0),
          savingsBase: roundCurrency(pricingSnapshot.cashback?.savingsBase || 0),
          ratePercent: cashbackRatePercent,
        },
        coins: {
          requested: coinsRedeemRequested,
          redeemed: coinsRedeemed,
          discount: coinsDiscount,
          earned: coinsEarned,
          savingsBase: coinsSavingsBase,
        },
      },
    });
    await checkoutGroup.save({ session });

    // Athreya Coins earned is a checkout-level number; split it across the
    // orders in this checkout by grandTotal so the per-order records sum
    // back to exactly what the customer was promised at preview time.
    const coinsEarnedPerOrder = allocateIntegerByWeight(
      coinsEarned,
      pricingSnapshot.sellerBreakdownEntries.map((entry) =>
        Number(entry?.breakdown?.grandTotal || 0),
      ),
    );

    // Wallet Cashback is likewise a checkout-level number. Each order carries
    // the cashback for its OWN savings, recomputed per seller, so a partial
    // cancellation only forfeits that order's share rather than the whole
    // checkout's.
    const cashbackSettings = pricingSnapshot.cashback?.settings || null;

    const orders = [];
    const pendingLowStockAlerts = [];
    const sellerTimeoutMs = DEFAULT_SELLER_TIMEOUT_MS();
    const shouldStartSellerWorkflow = paymentMode === "COD";

    for (let index = 0; index < pricingSnapshot.sellerBreakdownEntries.length; index += 1) {
      const entry = pricingSnapshot.sellerBreakdownEntries[index];
      const orderId = await generateUniquePublicOrderId({ session });
      const orderReservation = computeStockReservationWindow(paymentMode);
      const sellerPendingUntil = shouldStartSellerWorkflow
        ? new Date(Date.now() + sellerTimeoutMs)
        : null;
      const orderExpiresAt = orderReservation.expiresAt || sellerPendingUntil || null;

      const sellerLowStockAlerts = await reserveStockForItems({
        items: entry.items,
        sellerId: entry.sellerId,
        orderId,
        session,
        paymentMode,
      });
      if (Array.isArray(sellerLowStockAlerts) && sellerLowStockAlerts.length > 0) {
        pendingLowStockAlerts.push(...sellerLowStockAlerts);
      }

      // Audit Phase 4 (C-1): per-seller wallet allocation is now produced
      // by `buildCheckoutPricingSnapshot` (post-tip, post-handling) so we
      // can read it directly. Falling back to the old proportionate
      // formula keeps backwards compat in case the snapshot omits the
      // field for an exotic call path.
      const breakdownWalletAmount = Number(entry.breakdown?.walletAmount || 0);
      const orderGrandTotal = Number(entry.breakdown?.grandTotal || 0);
      const groupGrandTotal = Number(pricingSnapshot.aggregateBreakdown?.grandTotal || 1);
      const proportionateWallet = breakdownWalletAmount > 0
        ? breakdownWalletAmount
        : (orderGrandTotal / groupGrandTotal) * walletAmount;

      // Audit Phase 5 (C-2 + C-4): persist the canonical coupon ref +
      // frozen rule snapshot on every order in the checkout. Per-user
      // usage counts in `couponService.computeOrderDiscount` use
      // `Order.coupon` to count real usages instead of the legacy
      // hard-coded zero. Only populated when SERVER_SIDE_COUPON_ENGINE
      // is on AND a coupon was validated — otherwise both fields stay
      // null so historical/off-flag orders are unaffected.
      // Per-order cashback: this order's own realised savings at the frozen
      // rate. Summing these across a multi-seller checkout can differ from
      // the checkout-level quote by at most a paisa of rounding, and being
      // right per order matters more for partial cancellations.
      const orderSavingsBase = resolveSavingsBase(entry.breakdown);
      const cashbackPerOrder = computeCashbackForSavings(
        orderSavingsBase,
        cashbackSettings || undefined,
      );

      const persistedCouponId = pricingSnapshot.couponSnapshot?.couponId || null;
      const persistedCouponSnapshot = pricingSnapshot.couponSnapshot || undefined;

      const order = new Order({
        orderId,
        customer: customerId,
        seller: entry.sellerId,
        items: mapOrderItemsForPersistence(entry.items),
        address: normalizedAddress,
        paymentMode,
        paymentStatus:
          paymentMode === "ONLINE"
            ? ORDER_PAYMENT_STATUS.CREATED
            : ORDER_PAYMENT_STATUS.PENDING_CASH_COLLECTION,
        payment: {
          method: paymentMode === "ONLINE" ? "online" : "cash",
          status: "pending",
        },
        pricing: {
          ...entry.breakdown, // This might overwrite fields, be careful
          tip: entry.breakdown.tipTotal,
          total: entry.breakdown.grandTotal,
          walletAmount: proportionateWallet,
        },
        coupon: persistedCouponId,
        ...(persistedCouponSnapshot ? { couponSnapshot: persistedCouponSnapshot } : {}),
        status: "pending",
        orderStatus: "pending",
        timeSlot: normalizedPayload.timeSlot || "now",
        // Freeze the distance-derived delivery promise the customer accepted.
        deliveryEta: pricingSnapshot.deliveryEta
          ? {
              minMinutes: pricingSnapshot.deliveryEta.minMinutes,
              maxMinutes: pricingSnapshot.deliveryEta.maxMinutes,
              label: pricingSnapshot.deliveryEta.label,
              distanceKm: entry.distanceKm,
              quotedAt: new Date(),
            }
          : undefined,
        cashback: {
          amount: cashbackPerOrder,
          savingsBase: orderSavingsBase,
          ratePercent: cashbackRatePercent,
          credited: false,
          creditedAt: null,
          reversed: false,
        },
        coins: {
          earned: coinsEarnedPerOrder[index] || 0,
          // Coins land on delivery unless the platform is configured to
          // credit at placement (`COIN_CREDIT_TRIGGER.PLACEMENT`).
          earnedCredited: creditCoinsAtPlacement && (coinsEarnedPerOrder[index] || 0) > 0,
          earnedCreditedAt: creditCoinsAtPlacement ? new Date() : null,
          savingsBase: roundCurrency(
            Number(entry.breakdown?.productSavings || 0) +
              Number(entry.breakdown?.discountTotal || 0),
          ),
          redeemed: Math.max(0, Math.floor(Number(entry.breakdown?.coinsRedeemed || 0))),
          redeemedValue: roundCurrency(entry.breakdown?.coinsDiscount || 0),
          redeemedReversed: false,
        },
        workflowVersion: 2,
        workflowStatus: shouldStartSellerWorkflow
          ? WORKFLOW_STATUS.SELLER_PENDING
          : WORKFLOW_STATUS.CREATED,
        sellerPendingExpiresAt: sellerPendingUntil,
        expiresAt: orderExpiresAt,
        stockReservation: orderReservation,
        checkoutGroupId,
        checkoutGroupSize: pricingSnapshot.sellerCount,
        checkoutGroupIndex: index,
        placement: {
          idempotencyKey: idempotencyKey || undefined,
          idempotencyKeyExpiry,
          createdFrom: resolvedSource || source,
        },
        settlementStatus: {
          overall: "PENDING",
          sellerPayout: "PENDING",
          riderPayout: "PENDING",
          adminEarningCredited: false,
        },
      });

      freezeFinancialSnapshot(order, entry.breakdown);
      await order.save({ session });
      orders.push(order);
    }

    checkoutGroup.orderIds = orders.map((order) => order._id);
    checkoutGroup.publicOrderIds = orders.map((order) => order.orderId);
    checkoutGroup.sellerBreakdown = orders.map((order, index) => ({
      seller: order.seller,
      order: order._id,
      publicOrderId: order.orderId,
      itemCount: order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      subtotal: Number(order.paymentBreakdown?.productSubtotal || 0),
      sellerPayout: Number(order.paymentBreakdown?.sellerPayoutTotal || 0),
      riderTipAmount: Number(order.paymentBreakdown?.riderTipAmount || 0),
      adminCommission: Number(order.paymentBreakdown?.adminProductCommissionTotal || 0),
      grandTotal: Number(order.paymentBreakdown?.grandTotal || 0),
    }));
    await checkoutGroup.save({ session });

    // Deduct wallet balance if used.
    //
    // Audit Phase 4 (C-1 + H-5):
    //   - When the flag is on, the wallet debit routes through
    //     `walletService.debitWallet`. That helper writes a `LedgerEntry`
    //     (type: WALLET_PAYMENT) inside the same session, debits the
    //     canonical `Wallet({ownerType:"CUSTOMER"})` row, and mirrors the
    //     delta into `User.walletBalance` via `$inc`. The legacy
    //     `Transaction({type:"Wallet Payment"})` row is still written for
    //     backward-compat with admin dashboards that still consume the
    //     legacy collection (the collection deprecation is a later phase).
    //   - For legacy customers whose `Wallet.availableBalance` is below
    //     `User.walletBalance` (their wallet was credited only on the User
    //     side before Phase 4 P4-3 dual-write landed), we lazy-seed the
    //     canonical Wallet up to the User value inside the same session
    //     using an idempotent ledger key (`WLT-SEED-<userId>`). The seed
    //     does NOT touch User.walletBalance (the User row is already
    //     correct) and is a no-op for fresh customers.
    //   - When the flag is OFF the legacy code path is preserved bit-for-bit
    //     so rollback is an env flip.
    if (walletAmount > 0) {
      if (isWalletRedemptionReducesPayableEnabled()) {
        await seedCanonicalCustomerWalletFromUser({ customerId, user, session });
        await debitWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: customerId,
          amount: walletAmount,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_PAYMENT,
          ledgerReference: `WLT-CHOUT-${checkoutGroupId}`,
          ledgerDescription: "Wallet redeemed at checkout",
          idempotencyKey: `WLT-CHOUT-${checkoutGroupId}`,
          metadata: { checkoutGroupId },
        });
      } else {
        user.walletBalance -= walletAmount;
        await user.save({ session });
      }

      // Legacy `Transaction` row: kept under both code paths so existing
      // admin dashboards and the `walletLedgerVerifierJob` baseline view
      // are unaffected. The collection deprecation is a later phase.
      //
      // NOTE the array wrapper. `Model.create(doc, options)` only honours
      // `options` when `doc` is an ARRAY — given a plain object Mongoose
      // treats every argument as a document to insert, so `{ session }`
      // became a second (empty) Transaction and blew up validation with
      // "user/userModel/type/amount/reference is required", while the
      // session was silently dropped from the real insert.
      await Transaction.create([
        {
          user: customerId,
          userModel: "User",
          type: "Wallet Payment",
          amount: -walletAmount,
          status: "Settled",
          reference: `WLT-CHOUT-${checkoutGroupId}`,
          meta: { checkoutGroupId },
        },
      ], { session });
    }

    // Athreya Coins movements — inside the same transaction as the orders,
    // so a rollback can never leave a customer debited for an order that
    // does not exist. Both calls carry a checkout-scoped idempotency key
    // (unique-sparse index on CoinTransaction), which makes a retried
    // placement a no-op rather than a double spend / double grant.
    if (coinsRedeemed > 0) {
      await debitCoins({
        customerId,
        coins: coinsRedeemed,
        type: COIN_TRANSACTION_TYPE.REDEEM,
        description: "Athreya Coins redeemed at checkout",
        checkoutGroupId,
        orderId: orders[0]?.orderId || null,
        order: orders[0]?._id || null,
        idempotencyKey: `COIN-REDEEM-${checkoutGroupId}`,
        meta: { checkoutGroupId, discount: coinsDiscount },
        settings: coinSettings,
        session,
      });
    }

    if (creditCoinsAtPlacement && coinsEarned > 0) {
      await creditCoins({
        customerId,
        coins: coinsEarned,
        type: COIN_TRANSACTION_TYPE.EARN,
        description: "Athreya Coins earned on order",
        checkoutGroupId,
        orderId: orders[0]?.orderId || null,
        order: orders[0]?._id || null,
        idempotencyKey: `COIN-EARN-${checkoutGroupId}`,
        meta: { checkoutGroupId, savingsBase: coinsSavingsBase },
        settings: coinSettings,
        session,
      });
    }

    const transactionRows = orders.map((order) => ({
      user: order.seller,
      userModel: "Seller",
      order: order._id,
      type: "Order Payment",
      amount: Number(order.paymentBreakdown?.grandTotal || order.pricing?.total || 0),
      status: "Pending",
      reference: order.orderId,
      meta: {
        checkoutGroupId,
      },
    }));
    if (transactionRows.length > 0) {
      await Transaction.create(transactionRows, { session, ordered: true });
    }

    await consumeCartItems({
      customerId,
      source: resolvedSource || source,
      orderItemsInput,
      session,
      cartDocument,
    });

    // Audit Phase 5 (M-3): atomic, usage-limit-aware coupon increment
    // INSIDE the transaction. When SERVER_SIDE_COUPON_ENGINE is on, the
    // server is the authority on whether a coupon applies (we already
    // re-validated it inside `buildCheckoutPricingSnapshot`), so the
    // increment is now part of the same atomic write set as the order
    // documents. The increment is conditional — if `usageLimit` is set
    // and already reached, the document is left untouched. The order
    // proceeds regardless (legacy semantics) so a race-condition winner
    // doesn't lock out the loser at checkout; accounting is honest at
    // the coupon level. When the flag is OFF, this block is a no-op
    // and the legacy post-commit fire-and-forget block (below) runs
    // instead.
    if (
      isServerSideCouponEngineEnabled() &&
      pricingSnapshot.couponSnapshot?.couponId
    ) {
      await incrementCouponUsage({
        couponId: pricingSnapshot.couponSnapshot.couponId,
        session,
      });
    }

    await session.commitTransaction();

    // Phase 2 P2-7: atomic, usage-limit-aware coupon increment.
    //
    // The previous unconditional `$inc: { usedCount: 1 }` could push
    // `usedCount` past `usageLimit` under concurrent checkouts (two carts
    // both pass the read-time check at line ~95 of couponController.js
    // before either increments). The aggregation-pipeline update below
    // performs a conditional increment: if `usageLimit` is set and would
    // be exceeded, the document is left untouched. The order itself was
    // already placed (the check at validation time is best-effort), but
    // accounting now stays honest.
    //
    // Audit Phase 5 (M-3): when SERVER_SIDE_COUPON_ENGINE is on, the
    // increment is already performed transactionally above so this
    // post-commit fire-and-forget path becomes a no-op. When the flag
    // is OFF (legacy behaviour), we keep the post-commit increment so
    // the wire-level semantics of the legacy code path are preserved
    // bit-for-bit.
    const couponId = normalizedPayload.couponId;
    if (couponId && !isServerSideCouponEngineEnabled()) {
      Coupon.updateOne(
        { _id: couponId },
        [
          {
            $set: {
              usedCount: {
                $cond: [
                  {
                    $or: [
                      { $not: ["$usageLimit"] },
                      {
                        $lt: [
                          { $ifNull: ["$usedCount", 0] },
                          "$usageLimit",
                        ],
                      },
                    ],
                  },
                  { $add: [{ $ifNull: ["$usedCount", 0] }, 1] },
                  { $ifNull: ["$usedCount", 0] },
                ],
              },
            },
          },
        ],
      ).catch(() => {});
    }

    const resultPayload = buildResultPayload({
      checkoutGroup,
      orders,
    });

    if (idempotencyKey) {
      await storeIdempotencyResult(idempotencyKey, resultPayload, normalizedPayload);
    }

    if (shouldStartSellerWorkflow) {
      for (const order of orders) {
        void afterPlaceOrderV2(order).catch((error) => {
          logger.warn("[placeOrderAtomic] afterPlaceOrderV2 failed", {
            orderId: order.orderId,
            message: error.message,
          });
        });
      }
    }

    for (const order of orders) {
      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PLACED, {
        orderId: order.orderId,
        checkoutGroupId,
        customerId,
        userId: customerId,
      });
      if (order.seller) {
        emitNotificationEvent(NOTIFICATION_EVENTS.NEW_ORDER, {
          orderId: order.orderId,
          checkoutGroupId,
          sellerId: order.seller,
          customerId,
        });
      }
    }

    if (pendingLowStockAlerts.length > 0 && await isLowStockAlertsEnabled()) {
      pendingLowStockAlerts.forEach((alertPayload) => {
        emitNotificationEvent(NOTIFICATION_EVENTS.LOW_STOCK_ALERT, alertPayload);
      });
    }

    return { ...resultPayload, duplicate: false };
  } catch (error) {
    await session.abortTransaction();

    if (idempotencyKey) {
      if (isRetryableError(error)) {
        await releaseIdempotencyLock(idempotencyKey);
      } else {
        await storeIdempotencyError(idempotencyKey, error, normalizedPayload);
      }
    }

    if (error?.code === 11000) {
      if (idempotencyKey) {
        const existing = await findExistingCheckoutByIdempotency(customerId, idempotencyKey);
        if (existing) {
          const existingResult = buildResultPayload({
            checkoutGroup: existing.checkoutGroup,
            orders: existing.orders,
          });
          await storeIdempotencyResult(idempotencyKey, existingResult, normalizedPayload);
          return { ...existingResult, duplicate: true };
        }
      }

      if (retryCount < 2 && /orderId|checkoutGroupId/i.test(String(error.message || ""))) {
        return placeOrderAtomic({
          customerId,
          payload: normalizedPayload,
          idempotencyKey,
          retryCount: retryCount + 1,
        });
      }
    }

    throw error;
  } finally {
    session.endSession();
  }
}

export default {
  placeOrderAtomic,
};
