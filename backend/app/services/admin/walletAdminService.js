import Transaction from "../../models/transaction.js";
import Payout from "../../models/payout.js";
import Seller from "../../models/seller.js";
import Order from "../../models/order.js";
import { PAYOUT_TYPE } from "../../constants/finance.js";
import Notification from "../../models/notification.js";
import { getAdminFinanceSummary } from "../finance/walletService.js";
import { getLedgerEntries } from "../finance/ledgerService.js";

export async function getAdminWalletOverview({ page, limit }) {
  const stats = await getAdminFinanceSummary();
  const ledger = await getLedgerEntries({ page, limit });
  const transactionItems = ledger.items.map((entry) => ({
    id: entry.transactionId || entry.reference || String(entry._id),
    type: entry.type,
    amount:
      entry.direction === "DEBIT"
        ? -Math.abs(entry.amount || 0)
        : Math.abs(entry.amount || 0),
    status: entry.status,
    sender: entry.direction === "DEBIT" ? entry.actorType : "System/Order",
    recipient: entry.direction === "CREDIT" ? entry.actorType : "Platform Wallet",
    date: new Date(entry.createdAt).toLocaleDateString(),
    time: new Date(entry.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    notes: entry.description || entry.type,
    method: entry.paymentMode || "N/A",
  }));

  return {
    stats: {
      totalPlatformEarning: stats.totalPlatformEarning,
      totalAdminEarning: stats.totalAdminEarning,
      availableBalance: stats.availableBalance,
      sellerPendingPayouts: stats.sellerPendingPayouts,
      deliveryPendingPayouts: stats.deliveryPendingPayouts,
      systemFloat: stats.systemFloatCOD,
    },
    transactions: {
      items: transactionItems,
      page: ledger.page,
      limit: ledger.limit,
      total: ledger.total,
      totalPages: ledger.totalPages,
    },
  };
}

export async function getDeliveryTransactionsData({ page, limit, skip }) {
  const query = { userModel: "Delivery" };
  const transactions = await Transaction.find(query)
    .populate("user", "name phone documents")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Transaction.countDocuments(query);

  return {
    items: transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getSellerWithdrawalsData({ page, limit, skip }) {
  const query = { userModel: "Seller", type: "Withdrawal" };

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name shopName phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    items: transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

const PAYOUT_STATUS_LABEL = {
  PENDING: "Pending",
  PROCESSING: "Pending",
  COMPLETED: "Settled",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

/**
 * Seller Payments feed. Seller earnings are created as SELLER payouts when an
 * order is delivered (finance/orderFinanceService), not as legacy
 * Transactions — so this merges both sources: payouts become "Seller Earning"
 * rows (with the order's sale value, platform commission and net payable),
 * and legacy Transactions keep supplying withdrawals / refunds.
 */
export async function getSellerTransactionsData({ page, limit, skip }) {
  const fetchWindow = skip + limit; // newest-first merge of two collections
  const txnQuery = { userModel: "Seller" };
  const payoutQuery = { payoutType: PAYOUT_TYPE.SELLER };

  const [transactions, txnTotal, payouts, payoutTotal] = await Promise.all([
    Transaction.find(txnQuery)
      .populate("user", "name shopName phone bankDetails")
      .populate({
        path: "order",
        select: "orderId pricing",
        populate: { path: "items.product", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(fetchWindow)
      .lean(),
    Transaction.countDocuments(txnQuery),
    Payout.find(payoutQuery).sort({ createdAt: -1 }).limit(fetchWindow).lean(),
    Payout.countDocuments(payoutQuery),
  ]);

  const sellerIds = [...new Set(payouts.map((p) => String(p.beneficiaryId)))];
  const orderIds = payouts.flatMap((p) => p.relatedOrderIds || []);
  const [sellers, orders] = await Promise.all([
    Seller.find({ _id: { $in: sellerIds } }).select("name shopName phone bankDetails").lean(),
    Order.find({ _id: { $in: orderIds } })
      .select("orderId pricing paymentBreakdown items financeFlags")
      .populate("items.product", "name")
      .lean(),
  ]);
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  const payoutRows = payouts.map((p) => {
    const order = orderById.get(String((p.relatedOrderIds || [])[0])) || null;
    const breakdown = order?.paymentBreakdown || {};
    const held = order?.financeFlags?.sellerPayoutHeld === true && p.status === "PENDING";
    return {
      _id: p._id,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      type: "Seller Earning",
      // Net amount owed to the seller for this order.
      amount: Number(p.amount || 0),
      // Order's product value and the platform's commission on it.
      grossAmount: Number(breakdown.productSubtotal ?? order?.pricing?.subtotal ?? p.amount ?? 0),
      commissionAmount: Number(breakdown.adminProductCommissionTotal || 0),
      status: held ? "On Hold" : PAYOUT_STATUS_LABEL[p.status] || p.status,
      notes: held ? "Held until the order's return window ends" : undefined,
      user: sellerById.get(String(p.beneficiaryId)) || null,
      order,
    };
  });

  const merged = [...payoutRows, ...transactions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + limit);

  const total = txnTotal + payoutTotal;
  return {
    items: merged,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getDeliveryWithdrawalsData({ page, limit, skip }) {
  const query = { userModel: "Delivery", type: "Withdrawal" };

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    items: transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function updateWithdrawalStatusById({ id, status, reason }) {
  if (!["Settled", "Failed", "Processing"].includes(status)) {
    throw new Error("Invalid status");
  }

  const transaction = await Transaction.findById(id).populate("user", "name");
  if (!transaction) {
    return null;
  }

  transaction.status = status;
  if (reason) {
    transaction.notes = reason;
  }

  await transaction.save();
  return transaction;
}

export async function settleDeliveryTransactionById(id) {
  const transaction = await Transaction.findByIdAndUpdate(
    id,
    { status: "Settled" },
    { new: true },
  ).populate("user", "name");

  if (!transaction) {
    return null;
  }

  await Notification.create({
    recipient: transaction.user._id,
    recipientModel: "Delivery",
    title: "Payment Settled",
    message: `Your payment of \u20B9${transaction.amount} has been settled.`,
    type: "payment",
    data: { transactionId: transaction._id },
  });

  return transaction;
}

export async function bulkSettleDeliveryTransactions() {
  return Transaction.updateMany(
    { userModel: "Delivery", status: "Pending" },
    { status: "Settled" },
  );
}
