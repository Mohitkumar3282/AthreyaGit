import Transaction from "../../models/transaction.js";

/**
 * What a seller actually earns from an order: the value of the products they
 * sold (after any admin product commission). Delivery fee, handling/platform
 * fee and tip belong to the rider / platform and are NOT seller revenue.
 *
 * Preference: finance snapshot `sellerPayoutTotal` → `productSubtotal` →
 * `pricing.subtotal` → sum of item price × quantity.
 */
export function sellerShareOfOrder(order) {
  if (!order || typeof order !== "object") return null;
  const pb = order.paymentBreakdown || {};
  for (const v of [pb.sellerPayoutTotal, pb.productSubtotal, order.pricing?.subtotal]) {
    const n = Number(v);
    if (v !== undefined && v !== null && Number.isFinite(n)) return n;
  }
  if (Array.isArray(order.items) && order.items.length) {
    return order.items.reduce(
      (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
      0,
    );
  }
  return null;
}

/** Same rule as sellerShareOfOrder, as a MongoDB aggregation expression. */
export const SELLER_SHARE_EXPR = {
  $ifNull: [
    "$paymentBreakdown.sellerPayoutTotal",
    { $ifNull: ["$paymentBreakdown.productSubtotal", { $ifNull: ["$pricing.subtotal", 0] }] },
  ],
};

const ORDER_FIELDS_FOR_SHARE =
  "orderId paymentBreakdown.sellerPayoutTotal paymentBreakdown.productSubtotal pricing.subtotal items.price items.quantity";

/**
 * A seller's ledger rows. Older "Order Payment" rows were written with the
 * customer's full bill (items + delivery + fees); their amount is replaced
 * here with the seller's share of that order so balances and lists are right.
 */
export async function loadSellerTransactions(sellerId) {
  const rows = await Transaction.find({ user: sellerId, userModel: "Seller" })
    .sort({ createdAt: -1 })
    .populate("order", ORDER_FIELDS_FOR_SHARE)
    .lean();
  return rows.map((t) => {
    if (t.type !== "Order Payment" || !t.order || typeof t.order !== "object") return t;
    const share = sellerShareOfOrder(t.order);
    return share === null ? t : { ...t, amount: share };
  });
}

/** Settled balance minus pending withdrawals, from the corrected ledger. */
export function computeSellerTxnBalances(transactions) {
  const settledBalance = transactions
    .filter((t) => t.status === "Settled")
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const pendingPayouts = transactions
    .filter((t) => t.type === "Withdrawal" && (t.status === "Pending" || t.status === "Processing"))
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);
  const totalWithdrawn = transactions
    .filter((t) => t.type === "Withdrawal" && t.status === "Settled")
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);
  return { settledBalance, pendingPayouts, totalWithdrawn };
}
